from sqlalchemy import select
from sqlalchemy.orm import Session

from dawertech.modules.devices.infrastructure.orm_models import DeviceORM
from dawertech.modules.inventory.application.dtos import part_data
from dawertech.modules.inventory.application.sku_generator import generate_smart_sku
from dawertech.modules.inventory.infrastructure.orm_models import MovementORM, PartORM
from dawertech.shared.domain.exceptions import ApiProblem


class RegisterPartUseCase:
    @staticmethod
    def execute(
        session: Session,
        *,
        sku: str = "",
        name: str,
        category: str,
        variant: str = "",
        purchase_cents: int = 0,
        sale_cents: int = 0,
        min_stock: int = 0,
        initial_stock: int = 0,
        is_universal: bool = False,
        device_ids: list[int] | None = None,
        user_id: int | None = None,
    ) -> dict:
        clean_sku = sku.strip().upper() if sku else ""
        if not clean_sku:
            clean_sku = generate_smart_sku(session, category, name)
        elif session.scalar(select(PartORM).where(PartORM.sku == clean_sku)):
            raise ApiProblem("duplicate_sku", "Este SKU ya existe", 409)

        devices = []
        if device_ids:
            unique_ids = set(device_ids)
            devices = list(session.scalars(select(DeviceORM).where(DeviceORM.id.in_(unique_ids))))
            if len(devices) != len(unique_ids):
                raise ApiProblem("invalid_device", "Hay modelos de celular inexistentes")

        part = PartORM(
            sku=clean_sku,
            name=name.strip(),
            category=category.strip(),
            variant=variant.strip(),
            purchase_cents=purchase_cents,
            sale_cents=sale_cents,
            min_stock=min_stock,
            is_universal=is_universal,
        )
        part.devices = devices
        session.add(part)
        session.flush()

        if initial_stock > 0 and user_id is not None:
            movement = MovementORM(
                part_id=part.id,
                user_id=user_id,
                kind="entry",
                quantity_delta=initial_stock,
                reason="Stock inicial",
                unit_price_cents=purchase_cents,
            )
            session.add(movement)
            session.flush()

        return part_data(part, initial_stock)


