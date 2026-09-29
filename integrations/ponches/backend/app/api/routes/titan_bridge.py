from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Query

from app.services.database import fetch_all, test_connection

router = APIRouter(
    prefix="/internal/titan",
    tags=["TitanMDM integration"],
)


def authorize(key: str | None) -> None:
    expected = os.getenv(
        "TITAN_PONCHES_INTEGRATION_KEY",
        "",
    ).strip()

    if len(expected) < 32:
        raise HTTPException(
            status_code=503,
            detail="Integración TitanMDM no configurada.",
        )

    if not key or not hmac.compare_digest(key, expected):
        raise HTTPException(
            status_code=401,
            detail="Credencial de integración inválida.",
        )


def require_database() -> None:
    status = test_connection()

    if status.get("status") != "online":
        raise HTTPException(
            status_code=503,
            detail="BioTime no está disponible.",
        )


def read_recent(limit: int) -> list[dict]:
    return fetch_all(
        """
        SELECT TOP (?)
            id,
            codigo,
            nombre,
            departamento,
            fecha,
            entrada,
            salida,
            dispositivo_origen
        FROM dbo.punches
        ORDER BY fecha DESC, entrada DESC, id DESC
        """,
        (limit,),
    )


@router.get("/dashboard")
def dashboard(
    x_titan_integration_key: str | None = Header(
        default=None,
        alias="X-Titan-Integration-Key",
    ),
):
    authorize(x_titan_integration_key)
    require_database()

    try:
        rows = fetch_all(
            """
            SELECT
                COUNT(*) AS total_hoy,
                COUNT(DISTINCT codigo) AS empleados_hoy,
                COUNT(DISTINCT dispositivo_origen)
                    AS relojes_hoy,
                SUM(CASE WHEN entrada IS NOT NULL
                         THEN 1 ELSE 0 END)
                    AS con_entrada,
                SUM(CASE WHEN salida IS NOT NULL
                         THEN 1 ELSE 0 END)
                    AS con_salida,
                SUM(CASE WHEN entrada IS NOT NULL
                           AND salida IS NULL
                         THEN 1 ELSE 0 END)
                    AS sin_salida
            FROM dbo.punches
            WHERE fecha >= CAST(GETDATE() AS date)
              AND fecha < DATEADD(
                  day, 1, CAST(GETDATE() AS date)
              )
            """
        )

        row = rows[0] if rows else {}

        return {
            "generatedAtUtc": datetime.now(
                timezone.utc
            ).isoformat(),
            "summary": {
                "totalHoy": int(
                    row.get("total_hoy") or 0
                ),
                "empleadosHoy": int(
                    row.get("empleados_hoy") or 0
                ),
                "relojesHoy": int(
                    row.get("relojes_hoy") or 0
                ),
                "conEntrada": int(
                    row.get("con_entrada") or 0
                ),
                "conSalida": int(
                    row.get("con_salida") or 0
                ),
                "sinSalida": int(
                    row.get("sin_salida") or 0
                ),
            },
            "recent": read_recent(30),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar el resumen.",
        ) from exc


@router.get("/records")
def records(
    limit: int = Query(default=100, ge=1, le=200),
    search: str = Query(default="", max_length=80),
    x_titan_integration_key: str | None = Header(
        default=None,
        alias="X-Titan-Integration-Key",
    ),
):
    authorize(x_titan_integration_key)
    require_database()

    term = search.strip()

    try:
        if not term:
            items = read_recent(limit)
        else:
            pattern = f"%{term}%"

            items = fetch_all(
                """
                SELECT TOP (?)
                    id,
                    codigo,
                    nombre,
                    departamento,
                    fecha,
                    entrada,
                    salida,
                    dispositivo_origen
                FROM dbo.punches
                WHERE codigo LIKE ?
                   OR nombre LIKE ?
                   OR departamento LIKE ?
                ORDER BY fecha DESC, entrada DESC, id DESC
                """,
                (
                    limit,
                    pattern,
                    pattern,
                    pattern,
                ),
            )

        return {
            "items": items,
            "count": len(items),
            "limit": limit,
            "search": term,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudieron consultar los registros.",
        ) from exc