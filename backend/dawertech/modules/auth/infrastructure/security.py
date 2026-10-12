import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import current_app, g, request
from sqlalchemy import delete, or_, select

from dawertech.modules.auth.infrastructure.orm_models import RefreshSessionORM, UserORM, utc_now
from dawertech.shared.infrastructure.database import db_session

password_hasher = PasswordHasher()
ACCESS_MINUTES = 720  # 12 hours to maintain stable persistent sessions
REFRESH_DAYS = 365
DEVICE_SESSION_EXPIRY = datetime.max.replace(tzinfo=timezone.utc)


def hash_password(password: str) -> str:
    if len(password) < 12 or len(password) > 128:
        raise ValueError("La contraseña debe tener entre 12 y 128 caracteres")
    return password_hasher.hash(password)


def check_password(stored_hash: str, password: str) -> bool:
    try:
        return password_hasher.verify(stored_hash, password)
    except (VerifyMismatchError, ValueError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def issue_tokens(session, user: UserORM, remember_device: bool = False) -> dict:
    now = utc_now()
    try:
        session.execute(
            delete(RefreshSessionORM)
            .where(or_(RefreshSessionORM.expires_at < now, RefreshSessionORM.revoked_at < now - timedelta(days=1)))
            .execution_options(synchronize_session=False)
        )
    except Exception:
        pass
    refresh_token = secrets.token_urlsafe(48)
    refresh_session = RefreshSessionORM(
        user_id=user.id,
        token_hash=token_hash(refresh_token),
        expires_at=DEVICE_SESSION_EXPIRY if remember_device else now + timedelta(days=REFRESH_DAYS),
    )
    session.add(refresh_session)
    session.flush()
    access_token = make_access_token(user.id, refresh_session.id)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "Bearer", "expires_in": ACCESS_MINUTES * 60}


def make_access_token(user_id: int, session_id: int) -> str:
    now = utc_now()
    return jwt.encode(
        {"sub": str(user_id), "sid": session_id, "iat": now, "exp": now + timedelta(minutes=ACCESS_MINUTES)},
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


SESSION_ROTATION_GRACE_SECONDS = 300  # 5 minutes rotation grace period to allow concurrent tab requests


def require_auth(owner_only: bool = False):
    def decorator(handler):
        @wraps(handler)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            raw_token = ""
            if header.startswith("Bearer "):
                raw_token = header[7:].strip()
            elif request.args.get("token"):
                raw_token = request.args.get("token", "").strip()

            if not raw_token:
                return {"error": {"code": "unauthorized", "message": "Inicia sesión"}}, 401
            try:
                claims = jwt.decode(raw_token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
                user_id = int(claims["sub"])
                session_id = int(claims["sid"])
            except (jwt.PyJWTError, KeyError, ValueError, TypeError):
                return {"error": {"code": "unauthorized", "message": "Sesión inválida"}}, 401
            with db_session() as session:
                user = session.get(UserORM, user_id)
                refresh_session = session.get(RefreshSessionORM, session_id)
                now = utc_now()
                is_expired = not refresh_session or as_utc(refresh_session.expires_at) <= now
                is_revoked = False
                if refresh_session and refresh_session.revoked_at:
                    revoked_time = as_utc(refresh_session.revoked_at)
                    if now - revoked_time > timedelta(seconds=SESSION_ROTATION_GRACE_SECONDS):
                        is_revoked = True

                if not user or not user.active or not refresh_session or refresh_session.user_id != user.id or is_revoked or is_expired:
                    return {"error": {"code": "unauthorized", "message": "Sesión vencida"}}, 401
                if owner_only and user.role != "owner":
                    return {"error": {"code": "forbidden", "message": "Acceso reservado al administrador"}}, 403
                if user.must_change_password and request.path not in {"/api/v1/auth/me", "/api/v1/auth/password", "/api/v1/auth/logout"}:
                    return {"error": {"code": "password_change_required", "message": "Cambia tu contraseña temporal"}}, 403
                g.current_user_id = user.id
                g.current_user_role = user.role
                g.current_session_id = session_id
            return handler(*args, **kwargs)
        return wrapper
    return decorator


def revoke_user_sessions(session, user_id: int) -> None:
    for active_session in session.scalars(select(RefreshSessionORM).where(RefreshSessionORM.user_id == user_id, RefreshSessionORM.revoked_at.is_(None))):
        active_session.revoked_at = utc_now() - timedelta(minutes=10)


