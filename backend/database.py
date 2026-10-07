"""Compatibility module. Use app.db from the backend package."""

from app.db import MySqlSession, MySqlSessionFactory

__all__ = ["MySqlSession", "MySqlSessionFactory"]
