import getpass
import shutil
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

import click
from flask import current_app
from sqlalchemy import select

from dawertech.modules.auth.infrastructure.orm_models import UserORM
from dawertech.modules.auth.infrastructure.security import hash_password, revoke_user_sessions
from dawertech.modules.devices.application.device_service import seed_devices
from dawertech.modules.devices.infrastructure.orm_models import DeviceORM
from dawertech.modules.inventory.infrastructure.orm_models import PartORM
from dawertech.shared.infrastructure.local_storage import LocalStorageService
from dawertech.shared.infrastructure.database import write_session


def register_cli(app) -> None:
    @app.cli.command("estado-almacenamiento", help="Muestra el uso de fotos y su cuota configurada.")
    def cmd_estado_almacenamiento():
        storage = LocalStorageService(current_app.config['MEDIA_DIR'])
        click.echo(f"Fotos: {storage.usage_bytes() / 1024 / 1024:.2f} MiB de {storage.max_quota_bytes / 1024 / 1024:.0f} MiB.")

    @app.cli.command("limpiar-imagenes", help="Revisa fotos sin registro; solo borra si usas --aplicar.")
    @click.option('--aplicar', is_flag=True, help='Elimina las fotos sin registro de mas de 24 horas.')
    def cmd_limpiar_imagenes(aplicar: bool):
        storage = LocalStorageService(current_app.config['MEDIA_DIR'])
        with current_app.extensions['dawertech_session_factory']() as session:
            referenced = set(session.scalars(select(PartORM.image_name).where(PartORM.image_name.is_not(None))))
            referenced.update(session.scalars(select(DeviceORM.image_name).where(DeviceORM.image_name.is_not(None))))
        candidates = [file for file in storage.upload_dir.glob('*.webp') if file.name not in referenced and file.stat().st_mtime < time.time() - 86400]
        total = sum(file.stat().st_size for file in candidates)
        click.echo(f"Fotos sin registro: {len(candidates)} ({total / 1024 / 1024:.2f} MiB).")
        if aplicar:
            for file in candidates:
                storage.delete_image(file.name)
            click.echo('Limpieza completada.')
        else:
            click.echo('No se elimino nada. Haz un respaldo y ejecuta con --aplicar para confirmar.')

    def _create_owner(email: str, name: str) -> None:
        email = email.lower().strip()
        name = name.strip()
        if not email or "@" not in email:
            raise click.ClickException("Ingresa un correo electrónico válido")
        if not name:
            raise click.ClickException("El nombre no puede estar vacío")

        password = getpass.getpass("Contraseña (mínimo 12 caracteres): ")
        confirmation = getpass.getpass("Repetir contraseña: ")
        if password != confirmation:
            raise click.ClickException("Las contraseñas no coinciden")
        if len(password) < 12:
            raise click.ClickException("La contraseña debe tener al menos 12 caracteres")

        password_hash = hash_password(password)
        with write_session() as session:
            if session.scalar(select(UserORM.id).where(UserORM.role == "owner")):
                raise click.ClickException("Ya existe una cuenta de administrador registrada")
            if session.scalar(select(UserORM.id).where(UserORM.email == email)):
                raise click.ClickException(f"El correo '{email}' ya está registrado")
            session.add(UserORM(email=email, name=name, password_hash=password_hash, role="owner"))

        click.echo(f"Administrador '{name}' ({email}) creado con éxito.")

    @app.cli.command("crear-admin", help="Crea la cuenta del administrador inicial del taller.")
    @click.option("--email", prompt="Correo del administrador", help="Correo electrónico.")
    @click.option("--nombre", "--name", "name", prompt="Nombre del administrador", help="Nombre completo.")
    def cmd_crear_admin(email: str, name: str):
        _create_owner(email, name)

    @app.cli.command("create-owner", hidden=True)
    @click.option("--email", prompt=True)
    @click.option("--name", prompt=True)
    def cmd_create_owner_alias(email: str, name: str):
        _create_owner(email, name)

    def _reset_owner_password() -> None:
        password = getpass.getpass("Nueva contraseña (mínimo 12 caracteres): ")
        confirmation = getpass.getpass("Repetir contraseña: ")
        if password != confirmation:
            raise click.ClickException("Las contraseñas no coinciden")
        if len(password) < 12:
            raise click.ClickException("La contraseña debe tener al menos 12 caracteres")

        password_hash = hash_password(password)
        with write_session() as session:
            owner = session.scalar(select(UserORM).where(UserORM.role == "owner"))
            if not owner:
                raise click.ClickException("No existe ninguna cuenta administradora registrada")
            owner.password_hash = password_hash
            revoke_user_sessions(session, owner.id)

        click.echo("Contraseña del administrador actualizada correctamente. Sesiones previas cerradas.")

    @app.cli.command("cambiar-clave", help="Restablece la contraseña del administrador del taller.")
    def cmd_cambiar_clave():
        _reset_owner_password()

    @app.cli.command("reset-owner-password", hidden=True)
    def cmd_reset_owner_password_alias():
        _reset_owner_password()

    def _seed_devices() -> None:
        result = seed_devices()
        click.echo(
            f"Catálogo de celulares actualizado: "
            f"{result.get('inserted', 0)} modelos nuevos agregados "
            f"(total en catálogo: {result.get('total', 0)})."
        )

    @app.cli.command("cargar-celulares", help="Carga el catálogo inicial de celulares (iPhone y Android).")
    def cmd_cargar_celulares():
        _seed_devices()

    @app.cli.command("seed-devices", hidden=True)
    def cmd_seed_devices_alias():
        _seed_devices()

    def _backup_data(destino: Path) -> None:
        engine = current_app.extensions["dawertech_engine"]
        if engine.dialect.name != "sqlite":
            raise click.ClickException("Este respaldo requiere SQLite")

        destino.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        database_path = Path(engine.url.database)
        backup_path = destino / f"inventory-{stamp}.sqlite3"

        with sqlite3.connect(database_path) as source, sqlite3.connect(backup_path) as target:
            source.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise click.ClickException("Falló la verificación del respaldo")

        media_path = Path(current_app.config["MEDIA_DIR"])
        archive_path = shutil.make_archive(str(destino / f"media-{stamp}"), "zip", media_path)

        click.echo("Respaldo completado con éxito:")
        click.echo(f" - Base de datos: {backup_path}")
        click.echo(f" - Archivo de fotos: {archive_path}")

    @app.cli.command("respaldar", help="Crea un respaldo de la base de datos SQLite y fotos.")
    @click.argument("destino", type=click.Path(path_type=Path), default="backups", required=False)
    def cmd_respaldar(destino: Path):
        _backup_data(destino)

    @app.cli.command("backup-data", hidden=True)
    @click.argument("destination", type=click.Path(path_type=Path))
    def cmd_backup_data_alias(destination: Path):
        _backup_data(destination)


__all__ = ["register_cli"]
