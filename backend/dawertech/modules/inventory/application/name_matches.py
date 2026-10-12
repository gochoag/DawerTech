import unicodedata

from sqlalchemy import select

from dawertech.modules.inventory.infrastructure.orm_models import PartORM
from dawertech.shared.infrastructure.database import db_session


def normalize_part_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name.casefold())
    text = "".join(character for character in text if not unicodedata.combining(character))
    return " ".join(text.split())


def find_name_matches(name: str, exclude_id: int | None = None, page: int = 1, limit: int = 5) -> dict:
    normalized = normalize_part_name(name)
    with db_session() as session:
        # Compare only catalog metadata; keep names/variants unchanged in storage.
        # Python normalization also handles Unicode and whitespace consistently
        # across databases, unlike SQLite's ASCII-only lower() function.
        rows = session.execute(select(
            PartORM.id, PartORM.sku, PartORM.name,
            PartORM.variant, PartORM.category, PartORM.archived,
        ).order_by(PartORM.archived, PartORM.variant, PartORM.sku))
        matches = [dict(row._mapping) for row in rows
                   if row.id != exclude_id and normalized and normalize_part_name(row.name) == normalized]
    start = (page - 1) * limit
    return {"items": matches[start:start + limit], "total": len(matches), "page": page, "limit": limit}
