class AppError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class ChatNotFound(AppError):
    pass


class InvalidChatRequest(AppError):
    pass


class UpstreamError(AppError):
    pass


class DatabaseError(AppError):
    pass
