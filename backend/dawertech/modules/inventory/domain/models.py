from dataclasses import dataclass, field
from datetime import datetime

from dawertech.shared.domain.exceptions import InventoryRuleError


@dataclass
class SparePart:
    id: int
    sku: str
    name: str
    category: str
    variant: str = ""
    purchase_cents: int = 0
    sale_cents: int = 0
    min_stock: int = 0
    is_universal: bool = False
    archived: bool = False
    image_name: str | None = None
    created_at: datetime | None = None
    device_ids: list[int] = field(default_factory=list)


def calculate_movement_delta(kind: str, current_stock: int, quantity: int | None, target_stock: int | None) -> int:
    if kind == "adjustment":
        if target_stock is None or target_stock < 0:
            raise InventoryRuleError("invalid_field", "Existencia final inválida")
        delta = target_stock - current_stock
        if delta == 0:
            raise InventoryRuleError("no_change", "El ajuste no cambia la existencia")
    elif kind in {"entry", "exit"}:
        if quantity is None or quantity < 1:
            raise InventoryRuleError("invalid_field", "Cantidad inválida")
        delta = quantity if kind == "entry" else -quantity
    else:
        raise InventoryRuleError("invalid_kind", "Tipo de movimiento inválido")
    if current_stock + delta < 0:
        raise InventoryRuleError("insufficient_stock", "No hay existencias suficientes", 409)
    return delta


