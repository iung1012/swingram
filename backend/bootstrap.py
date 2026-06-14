from __future__ import annotations

import os
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
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

    # If the target database already exists, stop here. This avoids assuming
    # that the server exposes a `postgres` maintenance DB.
    target_engine = create_engine(
        url,
        future=True,
        pool_pre_ping=True,
        isolation_level="AUTOCOMMIT",
    )
    try:
        with target_engine.connect() as conn:
            conn.execute(text("select 1"))
            return
    except OperationalError:
        pass
    finally:
        target_engine.dispose()

    if database == "postgres":
        return

    for maintenance_db in ("template1", "postgres"):
        admin_engine = create_engine(
            url.set(database=maintenance_db),
            future=True,
            pool_pre_ping=True,
            isolation_level="AUTOCOMMIT",
        )
        try:
            with admin_engine.connect() as conn:
                exists = conn.execute(
                    text("select 1 from pg_database where datname = :name"),
                    {"name": database},
                ).first()
                if exists:
                    return
                conn.exec_driver_sql(f"create database {_quote_identifier(database)}")
                return
        except OperationalError:
            continue
        finally:
            admin_engine.dispose()

    raise RuntimeError(f"Unable to verify or create database '{database}'")


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


def _ensure_schema_repairs() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            DO $$
            BEGIN
              CREATE TYPE public.profile_visibility AS ENUM ('public', 'followers', 'hidden');
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
        conn.exec_driver_sql(
            """
            ALTER TABLE public.profiles
              ADD COLUMN IF NOT EXISTS profile_visibility public.profile_visibility NOT NULL DEFAULT 'public'
            """
        )
        conn.exec_driver_sql(
            """
            UPDATE public.profiles
            SET profile_visibility = 'hidden'
            WHERE COALESCE(invisible_mode, false) = true
              AND COALESCE(profile_visibility, 'public'::public.profile_visibility) <> 'hidden'::public.profile_visibility
            """
        )
        _ensure_moderation_queue(conn)


# SQL that turns moderation_queue into a live, unified review queue. Items are
# enqueued by triggers (so the queue is correct regardless of which client path
# created the content) and the queue rows are kept in sync when the underlying
# item is moderated from any of the admin screens.
_MODERATION_QUEUE_SQL: tuple[str, ...] = (
    # Resolution metadata + dedup guard (one pending row per item).
    """
    ALTER TABLE public.moderation_queue
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS reason text,
      ADD COLUMN IF NOT EXISTS resolved_by uuid,
      ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
      ADD COLUMN IF NOT EXISTS notes text
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS moderation_queue_pending_idx
      ON public.moderation_queue (item_type, item_id)
      WHERE status = 'pending'
    """,
    # --- Enqueue: new posts ---------------------------------------------------
    """
    CREATE OR REPLACE FUNCTION public.enqueue_post_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      INSERT INTO public.moderation_queue (item_type, item_id, status, priority, source)
      SELECT 'post'::public.mod_item_type, NEW.id, 'pending'::public.moderation_status,
             CASE WHEN NEW.nsfw THEN 3 ELSE 5 END, 'auto'
      WHERE NEW.moderation_status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.moderation_queue
          WHERE item_type = 'post' AND item_id = NEW.id AND status = 'pending'
        );
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_enqueue_post_moderation ON public.posts",
    """
    CREATE TRIGGER trg_enqueue_post_moderation
      AFTER INSERT ON public.posts
      FOR EACH ROW EXECUTE FUNCTION public.enqueue_post_moderation()
    """,
    # --- Enqueue: new verification requests -----------------------------------
    """
    CREATE OR REPLACE FUNCTION public.enqueue_verification_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      INSERT INTO public.moderation_queue (item_type, item_id, status, priority, source)
      SELECT 'verification'::public.mod_item_type, NEW.id, 'pending'::public.moderation_status, 4, 'auto'
      WHERE NEW.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM public.moderation_queue
          WHERE item_type = 'verification' AND item_id = NEW.id AND status = 'pending'
        );
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_enqueue_verification_moderation ON public.verification_requests",
    """
    CREATE TRIGGER trg_enqueue_verification_moderation
      AFTER INSERT ON public.verification_requests
      FOR EACH ROW EXECUTE FUNCTION public.enqueue_verification_moderation()
    """,
    # --- Enqueue: reported content (post/comment/message) ---------------------
    """
    CREATE OR REPLACE FUNCTION public.enqueue_report_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      it public.mod_item_type;
      target uuid;
    BEGIN
      it := CASE NEW.target_type
              WHEN 'post' THEN 'post'::public.mod_item_type
              WHEN 'comment' THEN 'comment'::public.mod_item_type
              WHEN 'message' THEN 'message'::public.mod_item_type
              ELSE NULL END;
      IF it IS NULL THEN
        RETURN NEW;
      END IF;
      target := NEW.target_id::uuid;
      UPDATE public.moderation_queue
        SET priority = LEAST(priority, NEW.priority),
            source = 'report',
            reason = COALESCE(reason, NEW.reason)
        WHERE item_type = it AND item_id = target AND status = 'pending';
      IF NOT FOUND THEN
        INSERT INTO public.moderation_queue (item_type, item_id, status, priority, source, reason)
        VALUES (it, target, 'pending'::public.moderation_status, NEW.priority, 'report', NEW.reason);
      END IF;
      RETURN NEW;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;  -- target_id was not a uuid; nothing to enqueue
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_enqueue_report_moderation ON public.reports",
    """
    CREATE TRIGGER trg_enqueue_report_moderation
      AFTER INSERT ON public.reports
      FOR EACH ROW EXECUTE FUNCTION public.enqueue_report_moderation()
    """,
    # --- Sync: closing the queue when an item is moderated elsewhere ----------
    """
    CREATE OR REPLACE FUNCTION public.sync_post_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
         AND NEW.moderation_status <> 'pending' THEN
        UPDATE public.moderation_queue
          SET status = NEW.moderation_status, resolved_at = now()
          WHERE item_type = 'post' AND item_id = NEW.id AND status = 'pending';
      END IF;
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_sync_post_moderation ON public.posts",
    """
    CREATE TRIGGER trg_sync_post_moderation
      AFTER UPDATE ON public.posts
      FOR EACH ROW EXECUTE FUNCTION public.sync_post_moderation()
    """,
    """
    CREATE OR REPLACE FUNCTION public.sync_verification_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
        UPDATE public.moderation_queue
          SET status = NEW.status::text::public.moderation_status, resolved_at = now()
          WHERE item_type = 'verification' AND item_id = NEW.id AND status = 'pending';
      END IF;
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_sync_verification_moderation ON public.verification_requests",
    """
    CREATE TRIGGER trg_sync_verification_moderation
      AFTER UPDATE ON public.verification_requests
      FOR EACH ROW EXECUTE FUNCTION public.sync_verification_moderation()
    """,
    """
    CREATE OR REPLACE FUNCTION public.sync_comment_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NEW.status = 'removed' AND NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE public.moderation_queue
          SET status = 'rejected', resolved_at = now()
          WHERE item_type = 'comment' AND item_id = NEW.id AND status = 'pending';
      END IF;
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_sync_comment_moderation ON public.comments",
    """
    CREATE TRIGGER trg_sync_comment_moderation
      AFTER UPDATE ON public.comments
      FOR EACH ROW EXECUTE FUNCTION public.sync_comment_moderation()
    """,
    """
    CREATE OR REPLACE FUNCTION public.sync_message_moderation()
    RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF NEW.status = 'removed' AND NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE public.moderation_queue
          SET status = 'rejected', resolved_at = now()
          WHERE item_type = 'message' AND item_id = NEW.id AND status = 'pending';
      END IF;
      RETURN NEW;
    END;
    $$
    """,
    "DROP TRIGGER IF EXISTS trg_sync_message_moderation ON public.messages",
    """
    CREATE TRIGGER trg_sync_message_moderation
      AFTER UPDATE ON public.messages
      FOR EACH ROW EXECUTE FUNCTION public.sync_message_moderation()
    """,
)


def _ensure_moderation_queue(conn) -> None:
    for statement in _MODERATION_QUEUE_SQL:
        conn.exec_driver_sql(statement)


def bootstrap_database() -> None:
    _ensure_database_exists()
    _ensure_base_objects()
    engine = get_engine()
    with engine.begin() as conn:
        marker = conn.execute(text("select 1 from public._bootstrap_marker where id = 1")).first()
        if not marker:
            for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
                sql = _escape_psycopg_percents(_load_sql(migration))
                if sql.strip():
                    conn.exec_driver_sql(sql)

            conn.execute(text("insert into public._bootstrap_marker (id) values (1)"))

    _ensure_schema_repairs()
    refresh_metadata_cache()
