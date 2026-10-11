import os
from pathlib import Path

from alembic import context
from dotenv import find_dotenv, load_dotenv
from sqlalchemy import engine_from_config, pool

from dawertech.modules.auth.infrastructure import orm_models as _auth_models  # noqa: F401
from dawertech.modules.devices.infrastructure import orm_models as _device_models  # noqa: F401
from dawertech.modules.inventory.infrastructure import orm_models as _inventory_models  # noqa: F401
from dawertech.shared.infrastructure.database import Base

config = context.config

env_file = find_dotenv(usecwd=True)
if env_file:
    load_dotenv(env_file)
elif not os.getenv("DAWERTECH_DATABASE_URL") and not os.getenv("DAWERTECH_SECRET_KEY"):
    raise RuntimeError(
        "No se encontró el archivo .env. Copia .env.example a .env "
        "(ej. 'Copy-Item .env.example .env' o 'cp .env.example .env') antes de ejecutar las migraciones."
    )

database_url = os.getenv("DAWERTECH_DATABASE_URL", f"sqlite:///{Path.home() / 'dawertech-data' / 'inventory.sqlite3'}")
if database_url.startswith("sqlite:///") and not database_url.endswith(":memory:"):
    db_file_path = Path(database_url.removeprefix("sqlite:///"))
    if db_file_path.parent and str(db_file_path.parent) != ".":
        db_file_path.parent.mkdir(parents=True, exist_ok=True)
config.set_main_option("sqlalchemy.url", database_url)
target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=database_url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
