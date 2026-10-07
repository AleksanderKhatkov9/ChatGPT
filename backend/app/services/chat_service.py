from collections.abc import AsyncIterator
from dataclasses import dataclass

from starlette.concurrency import run_in_threadpool

from app.contracts import ChatRecord, ChatStore, LlmClient, MessageRecord
from app.errors import ChatNotFound, InvalidChatRequest, UpstreamError
from app.schemas import MessageItem

HISTORY_LIMIT = 40
DEFAULT_TOPICS = {"", "new chat", "новый чат"}


@dataclass(frozen=True)
class PreparedTurn:
    chat_id: int
    model: str
    messages: list[dict[str, str]]


class ChatService:
    def __init__(self, store: ChatStore, llm: LlmClient, default_model: str):
        self._store = store
        self._llm = llm
        self._default_model = default_model

    @property
    def default_model(self) -> str:
        return self._default_model

    def list_chats(self) -> list[ChatRecord]:
        return self._store.list_chats()

    def create_chat(self, topic: str | None, user_id: int | None) -> ChatRecord:
        clean = (topic or "").strip() or "Новый чат"
        return self._store.create_chat(clean[:255], user_id)

    def rename_chat(self, chat_id: int, topic: str) -> ChatRecord:
        clean = topic.strip()
        if not clean:
            raise InvalidChatRequest("Topic is empty")
        if not self._store.rename_chat(chat_id, clean[:255]):
            raise ChatNotFound(f"Chat {chat_id} not found")
        chat = self._store.get_chat(chat_id)
        if chat is None:
            raise ChatNotFound(f"Chat {chat_id} not found")
        return chat

    def delete_chat(self, chat_id: int) -> None:
        if not self._store.delete_chat(chat_id):
            raise ChatNotFound(f"Chat {chat_id} not found")

    def list_messages(self, chat_id: int) -> list[MessageRecord]:
        if self._store.get_chat(chat_id) is None:
            raise ChatNotFound(f"Chat {chat_id} not found")
        return self._store.list_messages(chat_id)

    def prepare_user_turn(
        self, chat_id: int, content: str, model: str | None
    ) -> PreparedTurn:
        text = content.strip()
        if not text:
            raise InvalidChatRequest("Message is empty")
        if len(text) > 32000:
            raise InvalidChatRequest("Message is too long")

        chosen = self._resolve_model(model)
        chat = self._store.get_chat(chat_id)
        if chat is None:
            raise ChatNotFound(f"Chat {chat_id} not found")

        self._store.add_message(chat_id, "user", text)
        if (chat.topic or "").strip().lower() in DEFAULT_TOPICS:
            self._store.rename_chat(chat_id, _title_from(text))

        history = self._store.list_messages(chat_id)
        transcript = [
            {"role": item.role, "content": item.content}
            for item in history
            if item.role in {"system", "user", "assistant"} and item.content
        ][-HISTORY_LIMIT:]
        return PreparedTurn(chat_id=chat_id, model=chosen, messages=transcript)

    async def stream_reply(
        self, turn: PreparedTurn, temperature: float
    ) -> AsyncIterator[str]:
        parts: list[str] = []
        try:
            async for token in self._llm.stream_chat(
                turn.model, turn.messages, temperature
            ):
                parts.append(token)
                yield token
        finally:
            reply = "".join(parts).strip()
            if reply:
                await run_in_threadpool(
                    self._store.add_message, turn.chat_id, "assistant", reply
                )

    async def complete_transcript(
        self,
        chat_id: int,
        messages: list[MessageItem],
        model: str | None,
        temperature: float,
    ) -> str:
        if not messages:
            raise InvalidChatRequest("messages are required")
        if self._store.get_chat(chat_id) is None:
            raise ChatNotFound(f"Chat {chat_id} not found")

        chosen = self._resolve_model(model)
        last = messages[-1]
        if last.role == "user" and last.content.strip():
            self._store.add_message(chat_id, "user", last.content.strip())

        transcript = [
            {"role": item.role, "content": item.content}
            for item in messages
            if item.role in {"system", "user", "assistant"} and item.content
        ][-HISTORY_LIMIT:]

        parts: list[str] = []
        async for token in self._llm.stream_chat(chosen, transcript, temperature):
            parts.append(token)
        reply = "".join(parts).strip()
        if not reply:
            raise UpstreamError("Empty reply from Ollama")
        self._store.add_message(chat_id, "assistant", reply)
        return reply

    async def list_models(self) -> list[str]:
        names = await self._llm.list_models()
        return [name for name in names if not _is_cloud(name)]

    def _resolve_model(self, model: str | None) -> str:
        chosen = (model or self._default_model).strip()
        if not chosen:
            raise InvalidChatRequest("Model is not set")
        if _is_cloud(chosen):
            raise InvalidChatRequest(
                f"Model '{chosen}' is a cloud model. Choose a local Ollama model."
            )
        return chosen


def _is_cloud(model: str) -> bool:
    lowered = model.lower()
    return lowered.endswith(":cloud") or lowered.endswith("-cloud")


def _title_from(content: str) -> str:
    line = " ".join(content.strip().split())
    if not line:
        return "Новый чат"
    if len(line) <= 80:
        return line
    return line[:79].rstrip() + "…"
