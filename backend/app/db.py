from collections.abc import Sequence
from typing import Any

import mysql.connector
from mysql.connector import Error as MySqlError

from app.config import Settings
from app.errors import DatabaseError


class MySqlSession:
    def __init__(self, settings: Settings):
        self._settings = settings
        self.connection = None
        self.cursor = None

    def __enter__(self) -> "MySqlSession":
        try:
            self.connection = mysql.connector.connect(
                database=self._settings.db_name,
                user=self._settings.db_user,
                password=self._settings.db_password,
                host=self._settings.db_host,
                autocommit=False,
                charset="utf8mb4",
                collation="utf8mb4_unicode_ci",
            )
        except MySqlError as exc:
            raise DatabaseError(f"Cannot connect to MySQL: {exc}") from exc
        self.cursor = self.connection.cursor(dictionary=True, buffered=True)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        try:
            if self.connection is not None and self.connection.is_connected():
                if exc_type:
                    self.connection.rollback()
                else:
                    self.connection.commit()
        finally:
            if self.cursor is not None:
                self.cursor.close()
                self.cursor = None
            if self.connection is not None and self.connection.is_connected():
                self.connection.close()
            self.connection = None

    @property
    def rowcount(self) -> int:
        if self.cursor is None:
            return 0
        return int(self.cursor.rowcount or 0)

    def fetch_all(
        self, query: str, params: Sequence[Any] | None = None
    ) -> list[dict[str, Any]]:
        self._execute(query, params)
        return list(self.cursor.fetchall())

    def fetch_one(
        self, query: str, params: Sequence[Any] | None = None
    ) -> dict[str, Any] | None:
        self._execute(query, params)
        row = self.cursor.fetchone()
        return row

    def execute(self, query: str, params: Sequence[Any] | None = None) -> int:
        self._execute(query, params)
        self.connection.commit()
        return int(self.cursor.lastrowid or 0)

    def _execute(self, query: str, params: Sequence[Any] | None) -> None:
        if self.cursor is None or self.connection is None:
            raise DatabaseError("No active DB connection")
        try:
            self.cursor.execute(query, params or ())
        except MySqlError as exc:
            self.connection.rollback()
            raise DatabaseError(str(exc)) from exc


class MySqlSessionFactory:
    def __init__(self, settings: Settings):
        self._settings = settings

    def open(self) -> MySqlSession:
        return MySqlSession(self._settings)
