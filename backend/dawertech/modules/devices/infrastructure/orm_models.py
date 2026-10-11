from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from dawertech.shared.infrastructure.database import Base


class DeviceORM(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("brand", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    brand: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    image_name: Mapped[str | None] = mapped_column(String(80), nullable=True)


# Alias para compatibilidad
Device = DeviceORM


