import hashlib
from datetime import timedelta

from flask import Blueprint, g, request
from sqlalchemy import func, select

from dawertech.modules.auth.infrastructure.orm_models import LoginAttemptORM, RefreshSessionORM, UserORM, utc_now
from dawertech.modules.auth.infrastructure.security import (
    DEVICE_SESSION_EXPIRY,
    SESSION_ROTATION_GRACE_SECONDS,
    as_utc,
    check_password,
    hash_password,
    issue_tokens,
    require_auth,
    revoke_user_sessions,
    token_hash,
)
from dawertech.shared.domain.exceptions import ApiProblem
from dawertech.shared.infrastructure.database import db_session, write_session
from dawertech.shared.presentation.validation import payload, required_text

auth_bp = Blueprint("auth", __name__)


def user_data(user: UserORM) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "active": user.active,
        "must_change_password": user.must_change_password,
    }


@auth_bp.post("/auth/login")
def login():
    data = payload()
    email = required_text(data, "email", 254).lower()
    password = required_text(data, "password", 128)
    remember_device = data.get("remember_device", False)
    if not isinstance(remember_device, bool):
        raise ApiProblem("invalid_field", "La opción de recordar el dispositivo debe ser booleana")
    attempt_key = hashlib.sha256(f"{email}|{request.remote_addr}".encode()).hexdigest()
    with write_session() as session:
        attempt = session.get(LoginAttemptORM, attempt_key)
        now = utc_now()
        if attempt and attempt.locked_until and as_utc(attempt.locked_until) > now:
            raise ApiProblem("rate_limited", "Demasiados intentos. Prueba más tarde", 429)
        if attempt and as_utc(attempt.first_at) < now - timedelta(minutes=15):
            attempt.count = 0
            attempt.first_at = now
            attempt.locked_until = None
        user = session.scalar(select(UserORM).where(UserORM.email == email))
        if not user or not user.active or not check_password(user.password_hash, password):
            if not attempt:
                attempt = LoginAttemptORM(key=attempt_key, count=0, first_at=now)
                session.add(attempt)
            attempt.count += 1
            if attempt.count >= 5:
                attempt.locked_until = now + timedelta(minutes=15)
            response = {"error": {"code": "bad_credentials", "message": "Credenciales incorrectas"}}
            status = 401
        else:
            if attempt:
                session.delete(attempt)
            response = {"user": user_data(user), **issue_tokens(session, user, remember_device)}
            status = 200
    return response, status


@auth_bp.post("/auth/refresh")
def refresh():
    data = payload()
    refresh_token = required_text(data, "refresh_token", 256)
    remember_device = data.get("remember_device", False)
    if not isinstance(remember_device, bool):
        raise ApiProblem("invalid_field", "La opción de recordar el dispositivo debe ser booleana")
    with write_session() as session:
        old_session = session.scalar(select(RefreshSessionORM).where(RefreshSessionORM.token_hash == token_hash(refresh_token)))
        now = utc_now()
        if not old_session or as_utc(old_session.expires_at) <= now:
            raise ApiProblem("unauthorized", "Sesión inválida", 401)
        if old_session.revoked_at and as_utc(old_session.revoked_at) < now - timedelta(seconds=SESSION_ROTATION_GRACE_SECONDS):
            raise ApiProblem("unauthorized", "Sesión vencida", 401)
        user = session.get(UserORM, old_session.user_id)
        if not user or not user.active:
            raise ApiProblem("unauthorized", "Cuenta inactiva", 401)
        old_session.revoked_at = now
        remember_device = remember_device or as_utc(old_session.expires_at) == DEVICE_SESSION_EXPIRY
        result = {"user": user_data(user), **issue_tokens(session, user, remember_device)}
    return result


@auth_bp.post("/auth/logout")
def logout():
    data = payload()
    if "refresh_token" in data:
        refresh_token = required_text(data, "refresh_token", 256)
        with write_session() as session:
            current_session = session.scalar(select(RefreshSessionORM).where(RefreshSessionORM.token_hash == token_hash(refresh_token)))
            if current_session:
                current_session.revoked_at = utc_now() - timedelta(minutes=10)
        return "", 204
    return logout_access_token()


@require_auth()
def logout_access_token():
    with write_session() as session:
        current_session = session.get(RefreshSessionORM, g.current_session_id)
        if current_session:
            current_session.revoked_at = utc_now() - timedelta(minutes=10)
    return "", 204


@auth_bp.get("/auth/me")
@require_auth()
def me():
    with db_session() as session:
        user = session.get(UserORM, g.current_user_id)
        if not user:
            raise ApiProblem("not_found", "Usuario no encontrado", 404)
        return user_data(user)


@auth_bp.post("/auth/password")
@require_auth()
def change_password():
    data = payload()
    old_password = required_text(data, "old_password", 128)
    new_password = required_text(data, "new_password", 128)
    with write_session() as session:
        user = session.get(UserORM, g.current_user_id)
        if not user or not check_password(user.password_hash, old_password):
            raise ApiProblem("bad_credentials", "Contraseña actual incorrecta", 401)
        try:
            user.password_hash = hash_password(new_password)
        except ValueError as exc:
            raise ApiProblem("invalid_password", str(exc)) from exc
        user.must_change_password = False
        revoke_user_sessions(session, user.id)
    return "", 204


@auth_bp.get("/users")
@require_auth(owner_only=True)
def list_users():
    with db_session() as session:
        return {"items": [user_data(user) for user in session.scalars(select(UserORM).order_by(UserORM.id))]}


@auth_bp.post("/users")
@require_auth(owner_only=True)
def create_user():
    data = payload()
    email = required_text(data, "email", 254).lower()
    name = required_text(data, "name", 120)
    password = required_text(data, "password", 128)
    try:
        password_hash = hash_password(password)
    except ValueError as exc:
        raise ApiProblem("invalid_password", str(exc)) from exc
    with write_session() as session:
        if session.scalar(select(func.count()).select_from(UserORM).where(UserORM.active)) >= 5:
            raise ApiProblem("user_limit", "Solo se permiten cinco cuentas activas", 409)
        if session.scalar(select(UserORM).where(UserORM.email == email)):
            raise ApiProblem("duplicate_email", "Este correo ya existe", 409)
        user = UserORM(email=email, name=name, password_hash=password_hash, role="coadmin", must_change_password=True)
        session.add(user)
        session.flush()
        response = user_data(user)
    return response, 201


@auth_bp.patch("/users/<int:user_id>")
@require_auth(owner_only=True)
def update_user(user_id: int):
    data = payload()
    if not data or set(data) - {"active", "name", "password"}:
        raise ApiProblem("invalid_field", "Solo se permite cambiar nombre, estado o contraseña")
    with write_session() as session:
        user = session.get(UserORM, user_id)
        if not user:
            raise ApiProblem("not_found", "Usuario no encontrado", 404)
        if user.role == "owner" and ("active" in data or "password" in data):
            raise ApiProblem("forbidden", "Recupera la cuenta propietaria desde la CLI", 403)
        if "active" in data:
            if not isinstance(data["active"], bool):
                raise ApiProblem("invalid_field", "Estado inválido")
            if data["active"] and not user.active and session.scalar(select(func.count()).select_from(UserORM).where(UserORM.active)) >= 5:
                raise ApiProblem("user_limit", "Solo se permiten cinco cuentas activas", 409)
            user.active = data["active"]
            if not user.active:
                revoke_user_sessions(session, user.id)
        if "name" in data:
            user.name = required_text(data, "name", 120)
        if "password" in data:
            try:
                user.password_hash = hash_password(required_text(data, "password", 128))
            except ValueError as exc:
                raise ApiProblem("invalid_password", str(exc)) from exc
            user.must_change_password = True
            revoke_user_sessions(session, user.id)
        response = user_data(user)
    return response


