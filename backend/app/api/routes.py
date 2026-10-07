import json

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_chat_service, get_settings
from app.config import Settings
from app.contracts import ChatRecord, MessageRecord
from app.errors import AppError, InvalidChatRequest
from app.schemas import (
    ChatCreateRequest,
    ChatOut,
    ChatRenameRequest,
    ChatRequest,
    MessageOut,
    SendMessageRequest,
)
from app.services.chat_service import ChatService

router = APIRouter()


def _health(settings: Settings) -> dict:
    return {
        "status": "ok",
        "message": "ChatBot API is running",
        "model": settings.default_model,
        "ollama": settings.ollama_base_url,
    }


def _chat_out(chat: ChatRecord) -> ChatOut:
    return ChatOut(
        id=chat.id,
        topic=chat.topic,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
    )


def _message_out(message: MessageRecord) -> MessageOut:
    return MessageOut(
        role=message.role,
        content=message.content,
        created_at=message.created_at,
    )


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/")
def root(settings: Settings = Depends(get_settings)):
    return _health(settings)


@router.get("/api/health")
def health(settings: Settings = Depends(get_settings)):
    return _health(settings)


@router.get("/api/models")
async def list_models(service: ChatService = Depends(get_chat_service)):
    return {"models": await service.list_models()}


@router.get("/api/chats", response_model=list[ChatOut])
def list_chats(service: ChatService = Depends(get_chat_service)):
    return [_chat_out(chat) for chat in service.list_chats()]


@router.post("/api/chats", response_model=ChatOut)
def create_chat(
    req: ChatCreateRequest,
    service: ChatService = Depends(get_chat_service),
):
    return _chat_out(service.create_chat(req.topic, req.user_id))


@router.patch("/api/chats/{chat_id}", response_model=ChatOut)
def rename_chat(
    chat_id: int,
    req: ChatRenameRequest,
    service: ChatService = Depends(get_chat_service),
):
    return _chat_out(service.rename_chat(chat_id, req.topic))


@router.delete("/api/chats/{chat_id}", status_code=204)
def delete_chat(chat_id: int, service: ChatService = Depends(get_chat_service)):
    service.delete_chat(chat_id)
    return Response(status_code=204)


@router.get("/api/chats/{chat_id}/messages", response_model=list[MessageOut])
def list_messages(chat_id: int, service: ChatService = Depends(get_chat_service)):
    return [_message_out(message) for message in service.list_messages(chat_id)]


@router.post("/api/chats/{chat_id}/messages")
async def send_message(
    chat_id: int,
    req: SendMessageRequest,
    service: ChatService = Depends(get_chat_service),
):
    turn = await run_in_threadpool(
        service.prepare_user_turn, chat_id, req.content, req.model
    )
    temperature = 0.7 if req.temperature is None else req.temperature

    async def events():
        try:
            async for token in service.stream_reply(turn, temperature):
                yield _sse({"type": "token", "text": token})
            yield _sse({"type": "done"})
        except AppError as exc:
            yield _sse({"type": "error", "detail": exc.detail})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/chat/create")
def create_chat_legacy(
    req: ChatCreateRequest,
    service: ChatService = Depends(get_chat_service),
):
    chat = service.create_chat(req.topic, req.user_id)
    return {"chat_id": chat.id, "topic": chat.topic}


@router.post("/api/chat")
async def chat_legacy(
    req: ChatRequest,
    service: ChatService = Depends(get_chat_service),
):
    if not req.chat_id:
        raise InvalidChatRequest("chat_id is required")
    temperature = 0.7 if req.temperature is None else req.temperature
    reply = await service.complete_transcript(
        req.chat_id, req.messages, req.model, temperature
    )
    return {"reply": reply}


@router.get("/api/chat/{chat_id}/logs")
def chat_logs_legacy(chat_id: int, service: ChatService = Depends(get_chat_service)):
    return {
        "messages": [
            _message_out(message).model_dump()
            for message in service.list_messages(chat_id)
        ]
    }
