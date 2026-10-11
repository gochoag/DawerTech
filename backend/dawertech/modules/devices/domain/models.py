from dataclasses import dataclass


@dataclass(frozen=True)
class Device:
    id: int
    brand: str
    name: str
    code: str | None = None
    source: str = "manual"

