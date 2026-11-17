"""Application settings loaded from environment variables and a local .env file."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    """Runtime settings for the API and its MariaDB connection."""

    app_name: str = os.getenv("APP_NAME", "ACME Salary Management")
    db_host: str = os.getenv("SALARY_DB_HOST", "127.0.0.1")
    db_port: int = int(os.getenv("SALARY_DB_PORT", "3306"))
    db_user: str = os.getenv("SALARY_DB_USER", "salary_app")
    db_password: str = os.getenv("SALARY_DB_PASSWORD", "salary_local")
    db_name: str = os.getenv("SALARY_DB_NAME", "acme_salary")
    cors_origins: tuple[str, ...] = tuple(os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")


settings = Settings()
