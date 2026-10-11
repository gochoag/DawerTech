"""Ejemplo para el archivo WSGI de PythonAnywhere; sustituye TU_USUARIO."""

import os
import sys
from pathlib import Path

username = "TU_USUARIO"
home = Path("/home") / username
sys.path.insert(0, str(home / "DawerTech" / "backend"))

os.environ["DAWERTECH_DATABASE_URL"] = f"sqlite:////home/{username}/dawertech-data/inventory.sqlite3"
os.environ["DAWERTECH_MEDIA_DIR"] = str(home / "dawertech-data" / "media")
os.environ["DAWERTECH_SECRET_KEY"] = (home / ".dawertech-secret").read_text(encoding="utf-8").strip()
os.environ["DAWERTECH_CORS_ORIGINS"] = "https://TU_PROYECTO.pages.dev,https://localhost"

from dawertech import create_app  # noqa: E402

application = create_app()
