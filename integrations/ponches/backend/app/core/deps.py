from __future__ import annotations

import hmac

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.permissions import (
    ADMIN_ROLES,
    ALL_OPERATIONS,
    has_permission,
    normalize_role,
)
from app.core.security import decode_access_token
from app.services.app_users import find_user, public_user

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_actor: str | None = Header(default=None, alias="X-Actor"),
    x_titan_integration_key: str | None = Header(
        default=None,
        alias="X-Titan-Integration-Key",
    ),
    x_titan_actor: str | None = Header(
        default=None,
        alias="X-Titan-Actor",
    ),
    x_titan_access: str | None = Header(
        default=None,
        alias="X-Titan-Access",
    ),
) -> dict:
    # Solo la API .NET conoce esta clave. El navegador nunca la recibe.
    if x_titan_integration_key is not None:
        expected = settings.TITAN_PONCHES_INTEGRATION_KEY.strip()

        if len(expected) < 32 or not hmac.compare_digest(
            expected,
            x_titan_integration_key,
        ):
            raise HTTPException(
                status_code=401,
                detail="Integración no autorizada",
            )

        if not x_titan_actor or len(x_titan_actor) > 200:
            raise HTTPException(
                status_code=401,
                detail="Actor de TitanMDM requerido",
            )

        manage = x_titan_access == "manage"

        readonly = [
            operation
            for operation in ALL_OPERATIONS
            if operation.endswith(".read")
            or operation in {
                "attendance.read",
                "zk.read",
                "exports.read",
            }
        ]

        operations = (
            list(ALL_OPERATIONS)
            if manage
            else readonly
        )

        return {
            "username": x_titan_actor,
            "name": x_titan_actor,
            "role": "admin" if manage else "titan_viewer",
            "permissions": {"operations": operations},
            "operations": operations,
            "active": True,
        }

    # Conserva el inicio de sesión original para instalaciones
    # independientes del visualizador.
    token = creds.credentials if creds else None

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido",
        )

    payload = decode_access_token(token)

    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    user = find_user(str(payload["sub"]))

    if not user or not user.get("active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo",
        )

    result = public_user(user)

    if x_actor:
        result["actor_header"] = x_actor

    return result


def require_role(*roles: str):
    allowed = {role.lower() for role in roles}

    def _inner(user: dict = Depends(get_current_user)) -> dict:
        role = normalize_role(user.get("role"))

        if role in ADMIN_ROLES or role in allowed:
            return user

        raise HTTPException(
            status_code=403,
            detail="Sin permiso",
        )

    return _inner


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    role = normalize_role(user.get("role"))

    if role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Requiere rol administrativo",
        )

    return user


def require_permission(*operations: str):
    needed = tuple(operation for operation in operations if operation)

    def _inner(user: dict = Depends(get_current_user)) -> dict:
        if has_permission(user, *needed):
            return user

        raise HTTPException(
            status_code=403,
            detail="Sin permiso para: " + ", ".join(needed),
        )

    return _inner