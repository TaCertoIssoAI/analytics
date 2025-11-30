from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Configurações da aplicação carregadas do .env"""

    # Google Cloud
    PROJECT_ID: str = "sitegrupysanca"
    DATASET_ID: str = "analytics_whatsapp"
    TABLE_ID: str = "analises_complexas"
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:8080"

    # URLs
    VERIFICATION_URL_BASE: str = "/verificacao"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Retorna instância singleton das configurações"""
    return Settings()


settings = get_settings()
