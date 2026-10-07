from typing import Any

from app.contracts import ChatRecord, MessageRecord, SessionFactory
from app.errors import DatabaseError


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


class MySqlChatStore:
    def __init__(self, sessions: SessionFactory):
        self._sessions = sessions

    def list_chats(self) -> list[ChatRecord]:
        query = """
            SELECT
                c.id,
                c.topic,
                c.created_at,
                COALESCE(
                    (SELECT MAX(l.created_at) FROM chat_logs l WHERE l.chat_id = c.id),
                    c.created_at
                ) AS updated_at
            FROM chats c
            ORDER BY updated_at DESC, c.id DESC
        """
        with self._sessions.open() as db:
            rows = db.fetch_all(query)
        return [self._chat(row) for row in rows]

    def get_chat(self, chat_id: int) -> ChatRecord | None:
        with self._sessions.open() as db:
            row = db.fetch_one(
                "SELECT id, topic, created_at, created_at AS updated_at FROM chats WHERE id = %s",
                (chat_id,),
            )
        if row is None:
            return None
        return self._chat(row)

    def create_chat(self, topic: str, user_id: int | None) -> ChatRecord:
        with self._sessions.open() as db:
            if user_id is None:
                chat_id = db.execute(
                    "INSERT INTO chats (topic) VALUES (%s)",
                    (topic,),
                )
            else:
                chat_id = db.execute(
                    "INSERT INTO chats (topic, user_id) VALUES (%s, %s)",
                    (topic, user_id),
                )
        chat = self.get_chat(int(chat_id))
        if chat is None:
            raise DatabaseError("Chat was not created")
        return chat

    def rename_chat(self, chat_id: int, topic: str) -> bool:
        with self._sessions.open() as db:
            db.execute(
                "UPDATE chats SET topic = %s WHERE id = %s",
                (topic, chat_id),
            )
            return db.rowcount > 0

    def delete_chat(self, chat_id: int) -> bool:
        with self._sessions.open() as db:
            db.execute("DELETE FROM chats WHERE id = %s", (chat_id,))
            return db.rowcount > 0

    def list_messages(self, chat_id: int) -> list[MessageRecord]:
        with self._sessions.open() as db:
            rows = db.fetch_all(
                """
                SELECT role, content, created_at
                FROM chat_logs
                WHERE chat_id = %s
                ORDER BY id ASC
                """,
                (chat_id,),
            )
        return [
            MessageRecord(
                role=row["role"],
                content=row["content"],
                created_at=_iso(row.get("created_at")),
            )
            for row in rows
        ]

    def add_message(self, chat_id: int, role: str, content: str) -> None:
        with self._sessions.open() as db:
            db.execute(
                "INSERT INTO chat_logs (chat_id, role, content) VALUES (%s, %s, %s)",
                (chat_id, role, content),
            )

    @staticmethod
    def _chat(row: dict[str, Any]) -> ChatRecord:
        return ChatRecord(
            id=int(row["id"]),
            topic=row.get("topic") or "Новый чат",
            created_at=_iso(row.get("created_at")),
            updated_at=_iso(row.get("updated_at")),
        )
