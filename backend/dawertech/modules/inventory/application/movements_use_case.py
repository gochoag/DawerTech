from sqlalchemy.orm import Session

from dawertech.modules.inventory.domain.models import calculate_movement_delta
from dawertech.modules.inventory.infrastructure.orm_models import MovementORM
from dawertech.modules.inventory.infrastructure.sqlite_repositories import SqliteSparePartRepository
from dawertech.shared.domain.exceptions import InventoryRuleError


def register_movement(
    session: Session,
    *,
    part_id: int,
    user_id: int,
    kind: str,
    reason: str,
    quantity: int | None,
    target_stock: int | None,
    unit_price_cents: int | None,
) -> tuple[MovementORM, int]:
    repository = SqliteSparePartRepository(session)
    part = repository.active_part(part_id)
    if not part:
        raise InventoryRuleError("not_found", "Repuesto no encontrado", 404)
    current = repository.stock(part_id)
    delta = calculate_movement_delta(kind, current, quantity, target_stock)
    price = None if kind == "adjustment" else unit_price_cents
    if kind == "entry" and price is None:
        price = part.purchase_cents
    if kind == "exit" and price is None:
        price = part.sale_cents
    movement = repository.add_movement(part_id=part_id, user_id=user_id, kind=kind, delta=delta, reason=reason, price=price)
    return movement, current + delta


