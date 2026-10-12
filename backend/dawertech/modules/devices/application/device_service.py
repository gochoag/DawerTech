import json
from pathlib import Path

from sqlalchemy import func, or_, select

from dawertech.config.settings import BASE_DIR
from dawertech.modules.devices.infrastructure.orm_models import DeviceORM
from dawertech.shared.domain.exceptions import ApiProblem
from dawertech.shared.infrastructure.database import db_session, write_session


def find_data_dir() -> Path:
    candidates = [
        BASE_DIR / "data",
        BASE_DIR / "dawertech" / "data",
        Path(__file__).resolve().parent.parent.parent.parent / "data",
        Path(__file__).resolve().parent.parent.parent.parent / "dawertech" / "data",
    ]
    for candidate in candidates:
        if (candidate / "android_devices.json").is_file():
            return candidate
    return BASE_DIR / "data"


def seed_devices() -> dict:
    data_dir = find_data_dir()
    android = json.loads((data_dir / "android_devices.json").read_text(encoding="utf-8"))
    iphone = json.loads((data_dir / "iphone_devices.json").read_text(encoding="utf-8"))
    records = []
    for code, item in android.items():
        brand = item.get("brand", "").strip()
        name = item.get("name", "").strip()
        if not brand or not name:
            continue
        lowered = name.lower()
        if any(word in lowered for word in ("tablet", "tab ", "ipad", "watch", "tv ", "chromebook", "pixelbook", "pad ")):
            continue
        records.append((brand, name, code, "android-seed"))
    records.extend(("Apple", name, None, "iphone-seed") for name in iphone)

    inserted = 0
    with write_session() as session:
        existing = {(brand.lower(), name.lower()) for brand, name in session.execute(select(DeviceORM.brand, DeviceORM.name))}
        for brand, name, code, source in records:
            key = (brand.lower(), name.lower())
            if key in existing:
                continue
            session.add(DeviceORM(brand=brand, name=name, code=code, source=source))
            existing.add(key)
            inserted += 1
    return {"inserted": inserted, "total": len(existing)}


def list_devices_paged(search: str = "", ids: set[int] | None = None, page: int = 1, limit: int = 50) -> dict:
    with db_session() as session:
        query = select(DeviceORM)
        if ids:
            query = query.where(DeviceORM.id.in_(ids))
        # Every word must match, but may belong to a different catalog field.
        # This lets "samsung a02" find brand Samsung / model Galaxy A02.
        for term in search.split():
            query = query.where(
                or_(
                    DeviceORM.brand.icontains(term, autoescape=True),
                    DeviceORM.name.icontains(term, autoescape=True),
                    DeviceORM.code.icontains(term, autoescape=True),
                )
            )
        total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
        devices = session.scalars(query.order_by(DeviceORM.brand, DeviceORM.name).offset((page - 1) * limit).limit(limit))
        return {
            "items": [{"id": d.id, "brand": d.brand, "name": d.name, "code": d.code, "has_image": bool(d.image_name)} for d in devices],
            "total": total,
            "page": page,
            "limit": limit,
        }


def create_new_device(brand: str, name: str, code: str | None = None) -> dict:
    with write_session() as session:
        if session.scalar(select(DeviceORM).where(func.lower(DeviceORM.brand) == brand.lower(), func.lower(DeviceORM.name) == name.lower())):
            raise ApiProblem("duplicate_device", f"El celular '{brand} {name}' ya se encuentra registrado en el catálogo", 409)
        device = DeviceORM(brand=brand, name=name, code=code, source="manual")
        session.add(device)
        session.flush()
        return {"id": device.id, "brand": device.brand, "name": device.name, "code": device.code, "has_image": False}


