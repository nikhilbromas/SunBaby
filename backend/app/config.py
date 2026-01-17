"""
Configuration management for the Dynamic Bill Preview System.
Handles environment variables and application settings.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database Configuration
    DB_SERVER: str = os.getenv("DB_SERVER", "localhost")
    DB_NAME: str = os.getenv("DB_NAME", "SunBabyDB")
    DB_USER: str = os.getenv("DB_USER", "sa")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_DRIVER: str = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
    DB_TRUSTED_CONNECTION: bool = os.getenv("DB_TRUSTED_CONNECTION", "False").lower() == "true"
    
    # API Configuration
    API_TITLE: str = "Dynamic Bill Preview API"
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(',') if origin.strip()]
    
    # Security Configuration
    ALLOWED_TABLES: list[str] = os.getenv("ALLOWED_TABLES", "").split(",") if os.getenv("ALLOWED_TABLES") else []
    MAX_QUERY_ROWS: int = int(os.getenv("MAX_QUERY_ROWS", "1000"))
    
    # Export Configuration
    PDF_EXPORT_ENABLED: bool = os.getenv("PDF_EXPORT_ENABLED", "True").lower() == "true"
    
    # Debug Configuration
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

