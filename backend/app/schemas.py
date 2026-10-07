from typing import List, Optional

from pydantic import BaseModel, Field


class MessageItem(BaseModel):
    role: str
    content: str


class ChatCreateRequest(BaseModel):
    topic: Optional[str] = "Новый чат"
    user_id: Optional[int] = None


class ChatRenameRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=255)


class SendMessageRequest(BaseModel):
    content: str
    model: Optional[str] = None
    temperature: Optional[float] = 0.7


class ChatRequest(BaseModel):
    chat_id: Optional[int] = None
    messages: List[MessageItem]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7


class ChatOut(BaseModel):
    id: int
    topic: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MessageOut(BaseModel):
    role: str
    content: str
    created_at: Optional[str] = None
