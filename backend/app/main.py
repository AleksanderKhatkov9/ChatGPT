from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import load_settings
from app.db import MySqlSessionFactory
from app.errors import (
    AppError,
    ChatNotFound,
    DatabaseError,
    InvalidChatRequest,
    UpstreamError,
)
from app.llm.ollama import OllamaClient
from app.repositories.chat_store import MySqlChatStore
from app.services.chat_service import ChatService

_STATUS = {
    ChatNotFound: 404,
    InvalidChatRequest: 400,
    UpstreamError: 502,
    DatabaseError: 500,
}


def _status_for(exc: AppError) -> int:
    for error_type, code in _STATUS.items():
        if isinstance(exc, error_type):
            return code
    return 500


def create_app() -> FastAPI:
    settings = load_settings()
    service = ChatService(
        store=MySqlChatStore(MySqlSessionFactory(settings)),
        llm=OllamaClient(settings.ollama_base_url),
        default_model=settings.default_model,
    )

    app = FastAPI(title="CareerBot")
    app.state.settings = settings
    app.state.chat_service = service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError):
        return JSONResponse(
            status_code=_status_for(exc),
            content={"detail": exc.detail},
        )

    return app


app = create_app()
