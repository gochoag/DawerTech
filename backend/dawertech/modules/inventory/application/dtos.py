from dawertech.modules.inventory.infrastructure.orm_models import MovementORM, PartORM


def part_data(part: PartORM, stock: int) -> dict:
    return {
        "id": part.id,
        "sku": part.sku,
        "name": part.name,
        "variant": part.variant,
        "category": part.category,
        "purchase_cents": part.purchase_cents,
        "sale_cents": part.sale_cents,
        "min_stock": part.min_stock,
        "stock": stock,
        "low_stock": stock <= part.min_stock,
        "has_image": bool(part.image_name),
        "archived": part.archived,
        "is_universal": getattr(part, "is_universal", False),
        "compatible_count": len(part.devices),
        "device_ids": [device.id for device in part.devices],
    }


def movement_data(movement: MovementORM) -> dict:
    return {
        "id": movement.id,
        "part_id": movement.part_id,
        "part_name": movement.part.name,
        "user_name": movement.user.name,
        "kind": movement.kind,
        "quantity_delta": movement.quantity_delta,
        "reason": movement.reason,
        "unit_price_cents": movement.unit_price_cents,
        "created_at": movement.created_at.isoformat() + ("Z" if movement.created_at.tzinfo is None else ""),
    }


