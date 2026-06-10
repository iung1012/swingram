from __future__ import annotations

import os
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import create_engine, make_url

from .db import get_engine, refresh_metadata_cache


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS_DIR = ROOT / "backend" / "migrations"


def _load_sql(path: Path) -> str:
    sql = path.read_text(encoding="utf-8")

    # The storage policies are platform-specific and reference tables that do
    # not exist in the local Postgres deployment.
    sql = re.sub(r"(?is)\b(?:CREATE|DROP)\s+POLICY\b.*?;", "", sql)
    sql = re.sub(r"(?is)\bALTER\s+PUBLICATION\b.*?;", "", sql)
    sql = re.sub(r"(?im)^\s*GRANT\b.*?;\s*$", "", sql)
    sql = re.sub(r"(?im)^\s*REVOKE\b.*?;\s*$", "", sql)

    def _drop_platform_do_block(match: re.Match[str]) -> str:
        block = match.group(0)
        if re.search(r"(?is)\b(?:grant|revoke|alter\s+publication|create\s+policy|drop\s+policy)\b", block):
            return ""
        return block

    sql = re.sub(r"(?is)DO\s+\$\$.*?\$\$;", _drop_platform_do_block, sql)
    return sql


def _escape_psycopg_percents(sql: str) -> str:
    # psycopg treats single % as a client-side placeholder marker.
    # Double any bare percent so PostgreSQL receives the original SQL text.
    return re.sub(r"%(?!%)", "%%", sql)


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _ensure_database_exists() -> None:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raise RuntimeError("Missing DATABASE_URL")

    url = make_url(raw_url)
    database = url.database
    if not database:
        raise RuntimeError("DATABASE_URL must include a database name")

    if database == "postgres":
        return

    admin_engine = create_engine(
        url.set(database="postgres"),
        future=True,
        pool_pre_ping=True,
        isolation_level="AUTOCOMMIT",
    )
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(text("select 1 from pg_database where datname = :name"), {"name": database}).first()
            if exists:
                return
            conn.exec_driver_sql(f"create database {_quote_identifier(database)}")
    finally:
        admin_engine.dispose()


def _ensure_base_objects() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.exec_driver_sql("create schema if not exists auth")
        conn.exec_driver_sql("create extension if not exists pgcrypto")
        conn.exec_driver_sql(
            """
            create table if not exists auth.users (
              id uuid primary key default gen_random_uuid(),
              email text not null unique,
              encrypted_password text not null,
              raw_user_meta_data jsonb not null default '{}'::jsonb,
              created_at timestamptz not null default now(),
              updated_at timestamptz not null default now(),
              last_sign_in_at timestamptz
            )
            """
        )
        conn.exec_driver_sql(
            """
            create or replace function auth.uid()
            returns uuid
            language sql
            stable
            as $$
              select nullif(current_setting('app.current_user_id', true), '')::uuid
            $$;
            """
        )
        conn.exec_driver_sql(
            """
            create table if not exists public._bootstrap_marker (
              id integer primary key,
              applied_at timestamptz not null default now()
            )
            """
        )


def bootstrap_database() -> None:
    _ensure_database_exists()
    _ensure_base_objects()
    engine = get_engine()
    with engine.begin() as conn:
        marker = conn.execute(text("select 1 from public._bootstrap_marker where id = 1")).first()
        if marker:
            refresh_metadata_cache()
            return

        for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
            sql = _escape_psycopg_percents(_load_sql(migration))
            if sql.strip():
                conn.exec_driver_sql(sql)

        conn.execute(text("insert into public._bootstrap_marker (id) values (1)"))

    refresh_metadata_cache()
