"""
Core configuration for CommuGraph backend.

Uses Pydantic Settings for environment variable management.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Create a .env file in the backend directory for local development.
    """

    # Application
    APP_NAME: str = "CommuGraph API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # API Configuration
    API_V1_PREFIX: str = "/api"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative frontend port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # File Upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "/tmp/commugraph/uploads"

    # Session/Cache
    SESSION_DIR: str = "/tmp/commugraph/sessions"
    SESSION_EXPIRY_HOURS: int = 24

    # LLM Configuration (for Phase 3)
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEFAULT_LLM_MODEL: str = "gpt-4-turbo-preview"

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


# Global settings instance
settings = Settings()
