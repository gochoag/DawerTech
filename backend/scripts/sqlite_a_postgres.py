"""Copia los datos de una base SQLite de DawerTech a PostgreSQL, una sola vez.

Uso, desde backend/ y con el esquema ya creado (`alembic upgrade head` contra PostgreSQL):
    uv run python scripts/sqlite_a_postgres.py <archivo.sqlite3> <url-postgresql>

No modifica el archivo SQLite. Todo va en una transacción: si algo falla, PostgreSQL queda como estaba.
"""
import sys
from datetime import datetime, timezone

from sqlalchemy import create_engine, func, inspect, select, text

from dawertech.modules.auth.infrastructure import orm_models as _auth_models  # noqa: F401
from dawertech.modules.devices.infrastructure import orm_models as _device_models  # noqa: F401
from dawertech.modules.inventory.infrastructure import orm_models as _inventory_models  # noqa: F401
from dawertech.shared.infrastructure.database import Base


def as_utc(value):
    # SQLite guarda las fechas en UTC sin zona; PostgreSQL (timestamptz) necesita la zona explícita.
    return value.replace(tzinfo=timezone.utc) if isinstance(value, datetime) and value.tzinfo is None else value


def main(sqlite_path: str, pg_url: str) -> None:
    source = create_engine(f"sqlite:///{sqlite_path}")
    target = create_engine(pg_url)
    source_tables = set(inspect(source).get_table_names()) - {"alembic_version"}
    unknown = source_tables - set(Base.metadata.tables)
    if unknown:
        sys.exit(f"Error: estas tablas de SQLite no tienen modelo y se perderían: {sorted(unknown)}")

    counts = {}
    with source.connect() as src, target.begin() as dst:
        for table in Base.metadata.sorted_tables:
            if table.name not in source_tables:
                continue
            columns = [c["name"] for c in inspect(source).get_columns(table.name)]
            unknown_cols = set(columns) - set(table.c.keys())
            if unknown_cols:
                sys.exit(f"Error: columnas de {table.name} sin modelo, se perderían: {sorted(unknown_cols)}")
            if dst.scalar(select(func.count()).select_from(table)):
                sys.exit(f"Error: la tabla {table.name} ya tiene datos en PostgreSQL. No se copió nada.")
            rows = [{k: as_utc(v) for k, v in row._mapping.items()} for row in src.execute(select(*(table.c[c] for c in columns)))]
            if rows:
                dst.execute(table.insert(), rows)
            counts[table.name] = len(rows)
            # Sin esto, el siguiente alta reutilizaría un id ya copiado.
            pk = table.autoincrement_column
            if pk is not None:
                dst.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table.name}', '{pk.name}'), "
                    f"COALESCE(MAX({pk.name}), 1), MAX({pk.name}) IS NOT NULL) FROM {table.name}"
                ))

    with target.connect() as dst:
        for name, expected in counts.items():
            copied = dst.scalar(select(func.count()).select_from(Base.metadata.tables[name]))
            if copied != expected:
                sys.exit(f"Error: {name} tiene {copied} filas en PostgreSQL y {expected} en SQLite.")
            print(f"  {name}: {copied} filas")
    print("Copia completa y verificada.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
