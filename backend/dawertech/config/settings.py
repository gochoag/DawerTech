import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def resolve_media_dir(raw_path: str | Path | None = None) -> Path:
    raw = raw_path or os.getenv("DAWERTECH_MEDIA_DIR", os.getenv("UPLOAD_FOLDER", "media"))
    media_path = Path(raw)
    if not media_path.is_absolute():
        media_path = (BASE_DIR / media_path).resolve()
    return media_path


def resolve_database_url(raw_url: str | None = None) -> str:
    url = raw_url or os.getenv("DAWERTECH_DATABASE_URL", os.getenv("SQLALCHEMY_DATABASE_URI", ""))
    if not url:
        return f"sqlite:///{BASE_DIR / 'inventory.sqlite3'}"
    if url.startswith("sqlite:///") and not url.endswith(":memory:"):
        path_str = url.removeprefix("sqlite:///")
        path = Path(path_str)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
            return f"sqlite:///{path}"
    return url


class Config:
    SECRET_KEY = os.getenv("DAWERTECH_SECRET_KEY", os.getenv("SECRET_KEY", ""))
    DATABASE_URL = resolve_database_url()
    MEDIA_DIR = resolve_media_dir()
    CORS_ORIGINS = os.getenv("DAWERTECH_CORS_ORIGINS", "http://localhost:4200,http://localhost:8100,https://localhost")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MiB máx por imagen

