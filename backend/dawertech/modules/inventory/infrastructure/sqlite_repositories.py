from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from dawertech.modules.inventory.domain.repositories import SparePartRepository
from dawertech.modules.inventory.infrastructure.orm_models import MovementORM, PartORM, part_devices
from dawertech.shared.infrastructure.database import db_session


class SqliteSparePartRepository(SparePartRepository):
    def __init__(self, session: Session | None = None):
        self._session = session

    @property
    def session(self) -> Session:
        return self._session if self._session is not None else db_session()

    def find_by_device_and_query(
        self,
        device_id: int | None = None,
        search_term: str | None = None,
        include_archived: bool = False,
        page: int = 1,
        limit: int = 30,
    ) -> tuple[list[PartORM], int]:
        session = self.session
        query = select(PartORM)

        if not include_archived:
            query = query.where(PartORM.archived.is_(False))

        # Si se filtra por un dispositivo en mostrador
        if device_id:
            query = query.outerjoin(part_devices, PartORM.id == part_devices.c.part_id).filter(
                or_(
                    part_devices.c.device_id == device_id,
                    PartORM.is_universal.is_(True),
                )
            )

        # Búsqueda textual insensible a mayúsculas
        if search_term and search_term.strip():
            clean_term = f"%{search_term.strip()}%"
            query = query.filter(
                or_(
                    PartORM.name.ilike(clean_term),
                    PartORM.sku.ilike(clean_term),
                    PartORM.variant.ilike(clean_term),
                )
            )

        total = session.scalar(select(func.count()).select_from(query.distinct().subquery())) or 0
        parts = list(session.scalars(query.distinct().order_by(PartORM.name, PartORM.id).offset((page - 1) * limit).limit(limit)))
        return parts, total

    def get_by_id(self, part_id: int) -> PartORM | None:
        return self.session.get(PartORM, part_id)

    def active_part(self, part_id: int) -> PartORM | None:
        part = self.get_by_id(part_id)
        return part if part and not part.archived else None

    def stock(self, part_id: int) -> int:
        return self.session.scalar(
            select(func.coalesce(func.sum(MovementORM.quantity_delta), 0)).where(MovementORM.part_id == part_id)
        ) or 0

    def stocks_for(self, part_ids: list[int]) -> dict[int, int]:
        if not part_ids:
            return {}
        rows = self.session.execute(
            select(MovementORM.part_id, func.sum(MovementORM.quantity_delta))
            .where(MovementORM.part_id.in_(part_ids))
            .group_by(MovementORM.part_id)
        ).all()
        return {part_id: int(quantity) for part_id, quantity in rows}

    def add_movement(self, *, part_id: int, user_id: int, kind: str, delta: int, reason: str, price: int | None) -> MovementORM:
        movement = MovementORM(part_id=part_id, user_id=user_id, kind=kind, quantity_delta=delta, reason=reason, unit_price_cents=price)
        self.session.add(movement)
        self.session.flush()
        return movement


