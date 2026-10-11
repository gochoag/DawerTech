from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dawertech.modules.auth.infrastructure.orm_models import UserORM
from dawertech.modules.devices.infrastructure.orm_models import DeviceORM
from dawertech.shared.infrastructure.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


part_devices = Table(
    "part_devices",
    Base.metadata,
    Column("part_id", ForeignKey("parts.id", ondelete="CASCADE"), primary_key=True),
    Column("device_id", ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True),
)


class PartORM(Base):
    __tablename__ = "parts"
    __table_args__ = (
        CheckConstraint("purchase_cents >= 0"),
        CheckConstraint("sale_cents >= 0"),
        CheckConstraint("min_stock >= 0"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    variant: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    purchase_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sale_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_name: Mapped[str | None] = mapped_column(String(80))
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_universal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    devices: Mapped[list[DeviceORM]] = relationship(secondary=part_devices, lazy="selectin")


class MovementORM(Base):
    __tablename__ = "movements"
    __table_args__ = (CheckConstraint("quantity_delta != 0"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_price_cents: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    part: Mapped[PartORM] = relationship()
    user: Mapped[UserORM] = relationship()


class CategoryORM(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class VariantORM(Base):
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


# Alias de compatibilidad
Category = CategoryORM
Variant = VariantORM
Part = PartORM
Movement = MovementORM
SparePartORM = PartORM
SparePartCompatibilityORM = part_devices


