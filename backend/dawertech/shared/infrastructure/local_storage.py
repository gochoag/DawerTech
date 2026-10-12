import io
import os
import uuid
from threading import RLock
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from dawertech.shared.domain.exceptions import ApiProblem


_MEDIA_LOCK = RLock()


class LocalStorageService:
    def __init__(self, upload_dir: str | Path, max_quota_bytes: int | None = None):
        self.upload_dir = Path(upload_dir).resolve()
        self.max_quota_bytes = max_quota_bytes if max_quota_bytes is not None else int(os.getenv('DAWERTECH_MEDIA_QUOTA_MB', '100')) * 1024 * 1024
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def usage_bytes(self) -> int:
        return sum(file.stat().st_size for file in self.upload_dir.iterdir() if file.is_file())

    def check_quota(self, incoming_bytes: int = 0) -> None:
        if self.usage_bytes() + incoming_bytes > self.max_quota_bytes:
            raise ApiProblem("media_quota", "Espacio para imágenes agotado. Libera fotos o aumenta la cuota configurada.", 507)

    def save_image(self, image_bytes: bytes, max_dimensions: tuple[int, int] = (1200, 1200)) -> str:
        try:
            with Image.open(io.BytesIO(image_bytes)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"} or source.width * source.height > 12_000_000:
                    raise ValueError('unsupported_image')
                source.verify()
            with Image.open(io.BytesIO(image_bytes)) as source:
                oriented = ImageOps.exif_transpose(source)
                oriented.thumbnail(max_dimensions, Image.Resampling.LANCZOS)
                converted = oriented.convert("RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB")
                converted.info.clear()
                oriented.close()
            encoded = io.BytesIO()
            for side, quality in [(1200, 76), (960, 70), (768, 65), (640, 60)]:
                converted.thumbnail((min(side, max_dimensions[0]), min(side, max_dimensions[1])), Image.Resampling.LANCZOS)
                encoded = io.BytesIO()
                converted.save(encoded, "WEBP", quality=quality, method=3)
                if encoded.tell() <= 250 * 1024:
                    break
            converted.close()
            payload = encoded.getvalue()
            if len(payload) > 250 * 1024:
                raise ValueError('image_too_complex')
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ApiProblem("invalid_image", "Formato de imagen no válido") from None

        filename = f"{uuid.uuid4().hex}.webp"
        target_path = self.upload_dir / filename
        with _MEDIA_LOCK:
            self.check_quota(len(payload))
            try:
                with target_path.open('xb') as output:
                    output.write(payload)
            except OSError:
                target_path.unlink(missing_ok=True)
                raise ApiProblem('media_storage', 'No hay espacio disponible para guardar la imagen.', 507) from None
        return filename

    def delete_image(self, filename: str | None) -> None:
        if filename:
            path = self._safe_path(filename)
            if path:
                path.unlink(missing_ok=True)

    def get_image_path(self, filename: str | None) -> Path | None:
        if not filename:
            return None
        path = self._safe_path(filename)
        return path if path and path.is_file() else None

    def _safe_path(self, filename: str) -> Path | None:
        path = (self.upload_dir / filename).resolve()
        return path if path.parent == self.upload_dir and path.name == filename else None



