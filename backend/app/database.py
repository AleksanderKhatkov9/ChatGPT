"""Persistence entrypoint. Connections are opened per operation, not cached globally."""

from app.db import MySqlSession, MySqlSessionFactory

__all__ = ["MySqlSession", "MySqlSessionFactory"]
