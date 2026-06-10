from __future__ import annotations

import os
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator
from uuid import UUID

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection, Engine

from .env import load_project_env

load_project_env()


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Missing DATABASE_URL")
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    return create_engine(_database_url(), future=True, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_inspector():
    return inspect(get_engine())


def refresh_metadata_cache() -> None:
    get_inspector.cache_clear()


def _schema_for_table(table: str) -> str:
    if table == "users":
        return "auth"
    return "public"


def list_tables() -> set[str]:
    inspector = get_inspector()
    tables = {name for name in inspector.get_table_names(schema="public")}
    tables.update(name for name in inspector.get_table_names(schema="auth"))
    return tables


def table_exists(table: str) -> bool:
    schema = _schema_for_table(table)
    return table in get_inspector().get_table_names(schema=schema)


def get_columns(table: str) -> list[str]:
    schema = _schema_for_table(table)
    return [c["name"] for c in get_inspector().get_columns(table, schema=schema)]


def get_primary_key(table: str) -> list[str]:
    schema = _schema_for_table(table)
    return get_inspector().get_pk_constraint(table, schema=schema).get("constrained_columns", []) or []


def qualify_table(table: str) -> str:
    if table not in list_tables():
        raise KeyError(f"Unknown table: {table}")
    schema = _schema_for_table(table)
    return f'"{schema}"."{table}"'


@contextmanager
def db_connection(user_id: str | None = None) -> Iterator[Connection]:
    engine = get_engine()
    with engine.begin() as conn:
        if user_id:
            conn.execute(text("select set_config('app.current_user_id', :uid, true)"), {"uid": user_id})
        else:
            conn.execute(text("select set_config('app.current_user_id', '', true)"))
        yield conn


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_jsonable(v) for v in value]
    if isinstance(value, tuple):
        return [to_jsonable(v) for v in value]
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except TypeError:
            pass
    if isinstance(value, Path):
        return str(value)
    return value


def fetch_all(conn: Connection, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = conn.execute(text(sql), params or {})
    return [dict(row._mapping) for row in result.fetchall()]


def fetch_one(conn: Connection, sql: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    result = conn.execute(text(sql), params or {})
    row = result.mappings().first()
    return dict(row) if row else None
