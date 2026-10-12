import os
from flask import Blueprint, current_app, request, send_file

from dawertech.modules.auth.infrastructure.security import require_auth
from dawertech.modules.devices.application.device_service import create_new_device, list_devices_paged
from dawertech.modules.devices.infrastructure.orm_models import DeviceORM
from dawertech.shared.domain.exceptions import ApiProblem
from dawertech.shared.infrastructure.database import db_session, write_session
from dawertech.shared.infrastructure.local_storage import LocalStorageService
from dawertech.shared.presentation.validation import optional_text, pagination, payload, required_text

devices_bp = Blueprint("devices", __name__)


@devices_bp.get("/devices")
@require_auth()
def list_devices():
    page, limit = pagination()
    search = request.args.get("q", "").strip()[:100]
    ids_text = request.args.get("ids")
    ids = None
    if ids_text:
        try:
            ids = {int(value) for value in ids_text.split(",")}
            if not ids or len(ids) > 100 or min(ids) < 1:
                raise ValueError
        except ValueError:
            raise ApiProblem("invalid_field", "IDs de celulares inválidos") from None

    return list_devices_paged(search=search, ids=ids, page=page, limit=limit)


@devices_bp.post("/devices")
@require_auth()
def create_device():
    data = payload()
    brand = required_text(data, "brand", 80)
    name = required_text(data, "name", 160)
    code = optional_text(data, "code", 80) or None
    return create_new_device(brand=brand, name=name, code=code), 201


@devices_bp.get("/devices/<int:device_id>")
@require_auth()
def get_device(device_id: int):
    with db_session() as session:
        device = session.get(DeviceORM, device_id)
        if not device:
            raise ApiProblem("not_found", "Celular no encontrado", 404)
        return {
            "id": device.id,
            "brand": device.brand,
            "name": device.name,
            "code": device.code,
            "has_image": bool(device.image_name),
        }


@devices_bp.post("/devices/<int:device_id>/image")
@require_auth()
def upload_device_image(device_id: int):
    upload = request.files.get("image") or request.files.get("file")
    if not upload:
        raise ApiProblem("invalid_image", "Selecciona una imagen")

    storage = LocalStorageService(current_app.config["MEDIA_DIR"])
    image_bytes = upload.read()
    image_name = storage.save_image(image_bytes)

    try:
        with write_session() as session:
            device = session.get(DeviceORM, device_id)
            if not device:
                raise ApiProblem("not_found", "Celular no encontrado", 404)
            previous = device.image_name
            device.image_name = image_name
    except Exception:
        storage.delete_image(image_name)
        raise
    if previous:
        try:
            storage.delete_image(previous)
        except OSError:
            current_app.logger.warning('No se pudo retirar una foto reemplazada; revisar limpiar-imagenes.')
    return {"has_image": True}


@devices_bp.get("/devices/<int:device_id>/image")
@require_auth()
def get_device_image(device_id: int):
    with db_session() as session:
        device = session.get(DeviceORM, device_id)
        if not device or not device.image_name:
            raise ApiProblem("not_found", "Imagen no encontrada", 404)
        image_name = device.image_name

    storage = LocalStorageService(current_app.config["MEDIA_DIR"])
    image_path = storage.get_image_path(image_name)
    if not image_path:
        raise ApiProblem("not_found", "Imagen no encontrada", 404)
    return send_file(os.fspath(image_path), mimetype="image/webp", max_age=3600)


