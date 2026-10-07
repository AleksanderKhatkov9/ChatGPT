import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str
    default_model: str
    db_name: str
    db_host: str
    db_user: str
    db_password: str


def load_settings() -> Settings:
    load_dotenv(_ENV_PATH)
    return Settings(
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        default_model=os.getenv("DEFAULT_MODEL", "deepseek-coder:6.7b"),
        db_name=os.getenv("DB_NAME", "careerbot"),
        db_host=os.getenv("DB_HOST", "127.0.0.1"),
        db_user=os.getenv("DB_USER", "root"),
        db_password=os.getenv("DB_PASSWORD", ""),
    )
