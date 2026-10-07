from collections.abc import AsyncIterator, Sequence
from contextlib import AbstractContextManager
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class ChatRecord:
    id: int
    topic: str
    created_at: str | None
    updated_at: str | None


@dataclass(frozen=True)
class MessageRecord:
    role: str
    content: str
    created_at: str | None


class Session(Protocol):
    @property
    def rowcount(self) -> int: ...

    def fetch_all(
        self, query: str, params: Sequence[Any] | None = None
    ) -> list[dict[str, Any]]: ...

    def fetch_one(
        self, query: str, params: Sequence[Any] | None = None
    ) -> dict[str, Any] | None: ...

    def execute(self, query: str, params: Sequence[Any] | None = None) -> int: ...


class SessionFactory(Protocol):
    def open(self) -> AbstractContextManager[Session]: ...


class ChatStore(Protocol):
    def list_chats(self) -> list[ChatRecord]: ...

    def get_chat(self, chat_id: int) -> ChatRecord | None: ...

    def create_chat(self, topic: str, user_id: int | None) -> ChatRecord: ...

    def rename_chat(self, chat_id: int, topic: str) -> bool: ...

    def delete_chat(self, chat_id: int) -> bool: ...

    def list_messages(self, chat_id: int) -> list[MessageRecord]: ...

    def add_message(self, chat_id: int, role: str, content: str) -> None: ...


class LlmClient(Protocol):
    async def list_models(self) -> list[str]: ...

    def stream_chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
    ) -> AsyncIterator[str]: ...
