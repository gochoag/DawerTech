import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@pytest.fixture
def motor_solo_lectura():
    """Postgres principal (o el de GitHub Actions) en modo solo lectura: las pruebas solo hacen SELECT con filas en memoria."""
    url = os.getenv("DAWERTECH_TEST_DATABASE_URL") or os.getenv("DAWERTECH_DATABASE_URL", "")
    if not url.startswith("postgresql"):
        pytest.skip("Falta la URL de PostgreSQL (DAWERTECH_DATABASE_URL en backend/.env)")
    engine = create_engine(url, connect_args={"options": "-c default_transaction_read_only=on"})
    yield engine
    engine.dispose()
