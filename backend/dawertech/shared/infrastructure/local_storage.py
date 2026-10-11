import io
import uuid
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from dawertech.shared.domain.exceptions import ApiProblem


class LocalStorageService:
    def __init__(self, upload_dir: str | Path, max_quota_bytes: int = 100 * 1024 * 1024):
        self.upload_dir = Path(upload_dir).resolve()
        self.max_quota_bytes = max_quota_bytes
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def check_quota(self) -> None:
        current_usage = sum(file.stat().st_size for file in self.upload_dir.glob("*.webp"))
        if current_usage > self.max_quota_bytes:
            raise ApiProblem("media_quota", "Espacio para imágenes agotado", 507)

    def save_image(self, image_bytes: bytes, max_dimensions: tuple[int, int] = (1200, 1200)) -> str:
        self.check_quota()
        try:
            source = Image.open(io.BytesIO(image_bytes))
            source.verify()
            source = Image.open(io.BytesIO(image_bytes))
            source.thumbnail(max_dimensions)
            converted = source.convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError):
            raise ApiProblem("invalid_image", "Formato de imagen no válido") from None

        filename = f"{uuid.uuid4().hex}.webp"
        target_path = self.upload_dir / filename
        converted.save(target_path, "WEBP", quality=75, method=6)
        return filename

    def delete_image(self, filename: str | None) -> None:
        if filename:
            (self.upload_dir / filename).unlink(missing_ok=True)

    def get_image_path(self, filename: str | None) -> Path | None:
        if not filename:
            return None
        path = (self.upload_dir / filename).resolve()
        return path if path.is_file() else None



