"""Consulta de esquema y datos de tablas autorizadas."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import settings
from app.core.deps import require_permission
from app.services.audit import audit
from app.services.database import fetch_all, test_connection

router = APIRouter(
    prefix="/schema",
    tags=["schema"],
    dependencies=[
        Depends(require_permission("settings.read"))
    ],
)

_MAX_PREVIEW = 200


def _assert_db() -> None:
    database = test_connection()

    if database["status"] != "online":
        raise HTTPException(
            status_code=503,
            detail=database.get(
                "detail",
                "BD no disponible",
            ),
        )


def _allowed_tables() -> set[str]:
    configured = {
        table.lower()
        for table in settings.schema_allowlist
    }

    rows = fetch_all(
        """
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_TYPE = 'BASE TABLE'
        """
    )

    existing = {
        str(row["TABLE_NAME"])
        for row in rows
    }

    if not configured:
        return {
            name
            for name in existing
            if name.lower() == "punches"
        }

    return {
        name
        for name in existing
        if name.lower() in configured
    }


@router.get("/tables")
def list_tables(
    user: dict = Depends(
        require_permission("settings.read")
    ),
):
    _assert_db()
    names = sorted(_allowed_tables())

    audit(
        user["username"],
        "schema_tables",
        "dbo",
        {"count": len(names)},
    )

    return {
        "count": len(names),
        "tables": names,
    }


@router.get("/columns/{table_name}")
def list_columns(
    table_name: str,
    user: dict = Depends(
        require_permission("settings.read")
    ),
):
    _assert_db()

    if table_name not in _allowed_tables():
        raise HTTPException(
            status_code=400,
            detail="Tabla no permitida",
        )

    rows = fetch_all(
        """
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        """,
        (table_name,),
    )

    audit(
        user["username"],
        "schema_columns",
        table_name,
        {"count": len(rows)},
    )

    return {
        "table": table_name,
        "columns": rows,
    }


@router.get("/preview")
def preview_table(
    table: str,
    limit: int = Query(
        20,
        ge=1,
        le=_MAX_PREVIEW,
    ),
    user: dict = Depends(
        require_permission("settings.read")
    ),
):
    _assert_db()

    if table not in _allowed_tables():
        raise HTTPException(
            status_code=400,
            detail="Tabla no permitida",
        )

    columns = fetch_all(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        """,
        (table,),
    )

    column_names = [
        column["COLUMN_NAME"]
        for column in columns
    ]

    safe_limit = int(limit)
    safe_table = table.replace("]", "]]")

    rows = fetch_all(
        f"SELECT TOP ({safe_limit}) * FROM [dbo].[{safe_table}]"
    )

    audit(
        user["username"],
        "schema_preview",
        table,
        {"rows": len(rows)},
    )

    return {
        "columns": column_names,
        "items": rows,
    }