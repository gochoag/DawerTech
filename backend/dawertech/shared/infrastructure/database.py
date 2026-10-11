from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from flask import current_app
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite:///") and not url.endswith(":memory:"):
        database_path = Path(url.removeprefix("sqlite:///"))
        if database_path.parent and str(database_path.parent) != ".":
            database_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, pool_pre_ping=True)
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def configure_sqlite(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.close()
    return engine


def db_session() -> Session:
    return current_app.extensions["dawertech_session_factory"]()


@contextmanager
def write_session() -> Iterator[Session]:
    engine = current_app.extensions["dawertech_engine"]
    with engine.connect() as connection:
        if engine.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        with Session(bind=connection, expire_on_commit=False) as session:
            try:
                yield session
                session.flush()
                connection.commit()
            except Exception:
                connection.rollback()
                raise


def install_database(app) -> None:
    engine = make_engine(app.config["DATABASE_URL"])
    app.extensions["dawertech_engine"] = engine
    app.extensions["dawertech_session_factory"] = sessionmaker(bind=engine, expire_on_commit=False)

    try:
        from sqlalchemy import inspect, text
        with engine.connect() as conn:
            insp = inspect(conn)
            if "devices" in insp.get_table_names():
                cols = [c["name"] for c in insp.get_columns("devices")]
                if "image_name" not in cols:
                    conn.execute(text("ALTER TABLE devices ADD COLUMN image_name VARCHAR(80)"))
                    conn.commit()
    except Exception:
        pass

    seed_catalog_metadata(engine)


def seed_catalog_metadata(engine: Engine) -> None:
    try:
        Base.metadata.create_all(engine)
        with Session(bind=engine) as session:
            from sqlalchemy import select
            from dawertech.modules.inventory.infrastructure.orm_models import CategoryORM, VariantORM, PartORM

            # Seed categories
            existing_cats = set(session.scalars(select(CategoryORM.name)).all())
            default_cats = [
                "Pantallas",
                "Baterías",
                "Cámaras",
                "Pines de Carga",
                "Tapas y Chasis",
                "Flexores",
                "Audio y Altavoces",
                "Cristales y Glass",
                "Botones y Sensores",
                "Herramientas e Insumos",
                "Conectores y Placas",
                "Accesorios",
            ]
            part_cats = [c for c in session.scalars(select(PartORM.category).distinct()).all() if c and c.strip()]
            for cat_name in default_cats + part_cats:
                cat_name_clean = cat_name.strip()
                if cat_name_clean and cat_name_clean.lower() not in {c.lower() for c in existing_cats}:
                    session.add(CategoryORM(name=cat_name_clean))
                    existing_cats.add(cat_name_clean)

            # Seed variants
            existing_vars = set(session.scalars(select(VariantORM.name)).all())
            default_vars = [
                "Original Service Pack",
                "Calidad Original (OLED)",
                "In-Cell / FHD",
                "AAA / Premium",
                "Genérico / Copia",
                "Reacondicionado (Pull)",
                "Desarme / Usado",
                "Universal / Estándar",
            ]
            part_vars = [v for v in session.scalars(select(PartORM.variant).distinct()).all() if v and v.strip()]
            for var_name in default_vars + part_vars:
                var_name_clean = var_name.strip()
                if var_name_clean and var_name_clean.lower() not in {v.lower() for v in existing_vars}:
                    session.add(VariantORM(name=var_name_clean))
                    existing_vars.add(var_name_clean)

            session.commit()
    except Exception:
        pass


class DbProxy:
    @property
    def session(self) -> Session:
        return db_session()

    @property
    def engine(self) -> Engine:
        return current_app.extensions["dawertech_engine"]


db = DbProxy()

