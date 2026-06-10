from __future__ import annotations

import os
import re
import sys
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any

import jwt
from flask import Flask, Response, g, jsonify, request, send_file
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[1]))
    from backend.env import load_project_env
    from backend.bootstrap import bootstrap_database
    from backend.db import db_connection, get_primary_key, list_tables, qualify_table, to_jsonable
    from backend.storage import delete_paths, ensure_bucket, save_upload, sign_media, verify_media_token
else:
    from .env import load_project_env
    from .bootstrap import bootstrap_database
    from .db import db_connection, get_primary_key, list_tables, qualify_table, to_jsonable
    from .storage import delete_paths, ensure_bucket, save_upload, sign_media, verify_media_token

load_project_env()


JWT_SECRET = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
JWT_EXPIRY_SECONDS = int(os.getenv("JWT_EXPIRY_SECONDS", str(60 * 60 * 24 * 30)))

app = Flask(__name__)
CORS(
    app,
    supports_credentials=True,
    resources={
        r"/api/*": {
            "origins": [
                re.compile(r"https?://localhost:\d+$"),
                re.compile(r"https?://127\.0\.0\.1:\d+$"),
            ],
        }
    },
)
bootstrap_database()


@app.before_request
def _handle_api_preflight() -> Response | None:
    if request.method == "OPTIONS" and request.path.startswith("/api/"):
        response = app.make_default_options_response()
        response.status_code = 204
        return response
    return None


@app.after_request
def _cors_headers(response: Response) -> Response:
    response.headers.setdefault("Access-Control-Allow-Headers", "Authorization, Content-Type")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
    return response


def _json(data: Any, status: int = 200):
    return jsonify(to_jsonable(data)), status


def _decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


def _encode_token(user: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=JWT_EXPIRY_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _current_user_id() -> str | None:
    return getattr(g, "user_id", None)


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _json({"error": {"message": "Unauthorized"}}, 401)
        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return _json({"error": {"message": "Unauthorized"}}, 401)
        try:
            claims = _decode_token(token)
        except Exception:
            return _json({"error": {"message": "Unauthorized"}}, 401)
        g.user_id = claims["sub"]
        g.user_email = claims.get("email")
        return fn(*args, **kwargs)

    return wrapper


def _user_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "raw_user_meta_data": row.get("raw_user_meta_data", {}),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "last_sign_in_at": row.get("last_sign_in_at"),
    }


def _get_user_by_email(conn, email: str) -> dict[str, Any] | None:
    rows = conn.execute(
        __import__("sqlalchemy").text("select * from auth.users where lower(email) = lower(:email)"),
        {"email": email},
    ).mappings().first()
    return dict(rows) if rows else None


def _get_user_by_id(conn, user_id: str) -> dict[str, Any] | None:
    row = conn.execute(
        __import__("sqlalchemy").text("select * from auth.users where id = :id"),
        {"id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def _profile_for_user(conn, user_id: str) -> dict[str, Any] | None:
    row = conn.execute(
        __import__("sqlalchemy").text("select * from public.profiles where user_id = :id"),
        {"id": user_id},
    ).mappings().first()
    return dict(row) if row else None


def _roles_for_user(conn, user_id: str) -> list[str]:
    rows = conn.execute(
        __import__("sqlalchemy").text("select role::text from public.user_roles where user_id = :id"),
        {"id": user_id},
    ).mappings().all()
    return [r["role"] for r in rows]


@app.get("/health")
def health():
    return _json({"ok": True})


@app.post("/api/auth/signup")
def signup():
    payload = request.get_json(force=True)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    meta = payload.get("options", {}).get("data", {}) or {}

    if not email or not password:
        return _json({"error": {"message": "Email and password are required"}}, 400)

    with db_connection() as conn:
        if _get_user_by_email(conn, email):
            return _json({"error": {"message": "Email already registered"}}, 409)

        raw_meta = {
            **meta,
            "provider": "email",
        }
        row = conn.execute(
            __import__("sqlalchemy").text(
                """
                insert into auth.users (email, encrypted_password, raw_user_meta_data)
                values (:email, :password, cast(:meta as jsonb))
                returning *
                """
            ),
            {
                "email": email,
                "password": generate_password_hash(password),
                "meta": __import__("json").dumps(raw_meta),
            },
        ).mappings().first()
        if not row:
            return _json({"error": {"message": "Failed to create account"}}, 500)

        user = dict(row)
        profile = _profile_for_user(conn, str(user["id"]))
        token = _encode_token(user)
        return _json({
            "data": {
                "user": _user_response(user),
                "session": {
                    "access_token": token,
                    "token_type": "bearer",
                    "expires_in": JWT_EXPIRY_SECONDS,
                    "user": _user_response(user),
                },
                "profile": profile,
            },
            "error": None,
        })


@app.post("/api/auth/login")
def login():
    payload = request.get_json(force=True)
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if not email or not password:
        return _json({"error": {"message": "Email and password are required"}}, 400)

    with db_connection() as conn:
        user = _get_user_by_email(conn, email)
        if not user or not check_password_hash(user["encrypted_password"], password):
            return _json({"error": {"message": "Invalid credentials"}}, 401)

        conn.execute(
            __import__("sqlalchemy").text("update auth.users set last_sign_in_at = now() where id = :id"),
            {"id": user["id"]},
        )

        token = _encode_token(user)
        return _json({
            "data": {
                "user": _user_response(user),
                "session": {
                    "access_token": token,
                    "token_type": "bearer",
                    "expires_in": JWT_EXPIRY_SECONDS,
                    "user": _user_response(user),
                },
            },
            "error": None,
        })


@app.post("/api/auth/logout")
def logout():
    return _json({"data": {"success": True}, "error": None})


@app.get("/api/auth/me")
@require_auth
def me():
    with db_connection(_current_user_id()) as conn:
        user = _get_user_by_id(conn, _current_user_id())
        if not user:
            return _json({"error": {"message": "Unauthorized"}}, 401)
        profile = _profile_for_user(conn, _current_user_id())
        roles = _roles_for_user(conn, _current_user_id())
        return _json({
            "data": {
                "user": _user_response(user),
                "profile": profile,
                "roles": roles,
            },
            "error": None,
        })


@app.post("/api/auth/oauth/<provider>")
def oauth_not_supported(provider: str):
    return _json({"error": {"message": f"OAuth provider '{provider}' is not configured"}}, 501)


def _apply_filters(sql: str, params: dict[str, Any], filters: list[dict[str, Any]] | None, or_expression: str | None) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    i = 0
    for f in filters or []:
        col = f["column"]
        op = f["op"]
        key = f"p{i}"
        i += 1
        if op == "eq":
            clauses.append(f"{col} = :{key}")
            params[key] = f["value"]
        elif op == "neq":
            clauses.append(f"{col} != :{key}")
            params[key] = f["value"]
        elif op == "gt":
            clauses.append(f"{col} > :{key}")
            params[key] = f["value"]
        elif op == "gte":
            clauses.append(f"{col} >= :{key}")
            params[key] = f["value"]
        elif op == "lt":
            clauses.append(f"{col} < :{key}")
            params[key] = f["value"]
        elif op == "lte":
            clauses.append(f"{col} <= :{key}")
            params[key] = f["value"]
        elif op == "is":
            if f["value"] is None:
                clauses.append(f"{col} is null")
            else:
                clauses.append(f"{col} is not distinct from :{key}")
                params[key] = f["value"]
        elif op == "not_is":
            clauses.append(f"{col} is not null")
        elif op == "in":
            clauses.append(f"{col} = any(:{key})")
            params[key] = f["value"]
        elif op == "ilike":
            clauses.append(f"{col} ilike :{key}")
            params[key] = f["value"]
        elif op == "contains":
            clauses.append(f"{col} @> :{key}")
            params[key] = f["value"]
        elif op == "overlaps":
            clauses.append(f"{col} && :{key}")
            params[key] = f["value"]
    if or_expression:
        clauses.append(_parse_or_expression(or_expression, params, i))
    if clauses:
        sql += " where " + " and ".join(clauses)
    return sql, params


def _parse_or_expression(expr: str, params: dict[str, Any], start_index: int) -> str:
    parts: list[str] = []
    depth = 0
    current = []
    for ch in expr:
        if ch == "," and depth == 0:
            token = "".join(current).strip()
            if token:
                parts.append(token)
            current = []
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        current.append(ch)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)

    def parse_clause(token: str, idx: int) -> tuple[str, int]:
        if token.startswith("and(") and token.endswith(")"):
            inner = token[4:-1]
            subparts = []
            subdepth = 0
            buf = []
            subidx = idx
            for ch in inner:
                if ch == "," and subdepth == 0:
                    subtoken = "".join(buf).strip()
                    if subtoken:
                        clause, subidx = parse_clause(subtoken, subidx)
                        subparts.append(clause)
                    buf = []
                    continue
                if ch == "(":
                    subdepth += 1
                elif ch == ")":
                    subdepth -= 1
                buf.append(ch)
            last = "".join(buf).strip()
            if last:
                clause, subidx = parse_clause(last, subidx)
                subparts.append(clause)
            return "(" + " and ".join(subparts) + ")", subidx
        field, op, value = token.split(".", 2)
        key = f"or{idx}"
        params[key] = value.replace("%25", "%")
        if op == "eq":
            return f"{field} = :{key}", idx + 1
        if op == "neq":
            return f"{field} != :{key}", idx + 1
        if op == "ilike":
            return f"{field} ilike :{key}", idx + 1
        if op == "is":
            return f"{field} is null" if value == "null" else f"{field} is not distinct from :{key}", idx + 1
        raise ValueError(f"Unsupported OR clause: {token}")

    compiled = []
    idx = start_index
    for part in parts:
        clause, idx = parse_clause(part, idx)
        compiled.append(clause)
    return "(" + " or ".join(compiled) + ")"


def _apply_order(sql: str, orders: list[dict[str, Any]] | None) -> str:
    if not orders:
        return sql
    parts = []
    for order in orders:
        direction = "asc" if order.get("ascending", True) else "desc"
        parts.append(f"{order['column']} {direction}")
    return sql + " order by " + ", ".join(parts)


def _augment_rows(table: str, rows: list[dict[str, Any]], select: str | None, conn) -> list[dict[str, Any]]:
    if not rows:
        return rows

    want_media = bool(select and "post_media(" in select and table == "posts")
    want_profile = bool(select and "profiles(" in select and table in {"posts", "verification_requests"})

    if want_media:
        post_ids = [r["id"] for r in rows]
        media_rows = conn.execute(
            __import__("sqlalchemy").text(
                "select * from public.post_media where post_id = any(:ids) order by post_id, \"order\", created_at"
            ),
            {"ids": post_ids},
        ).mappings().all()
        media_by_post: dict[str, list[dict[str, Any]]] = {}
        for media in media_rows:
            media_by_post.setdefault(str(media["post_id"]), []).append(dict(media))
        for row in rows:
            row["post_media"] = media_by_post.get(str(row["id"]), [])

    if want_profile:
        user_ids = [row.get("user_id") for row in rows if row.get("user_id")]
        if user_ids:
            profiles = conn.execute(
                __import__("sqlalchemy").text("select * from public.profiles where user_id = any(:ids)"),
                {"ids": user_ids},
            ).mappings().all()
            profile_by_id = {str(p["user_id"]): dict(p) for p in profiles}
            for row in rows:
                row["profiles"] = profile_by_id.get(str(row.get("user_id")))

    return rows


@app.post("/api/query")
@require_auth
def query_table():
    payload = request.get_json(force=True)
    table = payload.get("table")
    op = payload.get("op", "select")
    select = payload.get("select")
    filters = payload.get("filters") or []
    or_expression = payload.get("or")
    orders = payload.get("orders") or []
    limit = payload.get("limit")
    offset = payload.get("offset")
    values = payload.get("values")
    single = payload.get("single") or payload.get("maybe_single")
    count_requested = payload.get("count")
    on_conflict = payload.get("on_conflict")
    ignore_duplicates = bool(payload.get("ignore_duplicates"))

    if table not in list_tables():
        return _json({"error": {"message": f"Unknown table: {table}"}}, 400)

    user_id = _current_user_id()
    with db_connection(user_id) as conn:
        try:
            if op == "select":
                sql = f"select * from {qualify_table(table)}"
                params: dict[str, Any] = {}
                sql, params = _apply_filters(sql, params, filters, or_expression)
                sql = _apply_order(sql, orders)
                if limit is not None:
                    sql += " limit :limit"
                    params["limit"] = int(limit)
                if offset is not None:
                    sql += " offset :offset"
                    params["offset"] = int(offset)
                rows = [dict(r) for r in conn.execute(__import__("sqlalchemy").text(sql), params).mappings().all()]
                rows = _augment_rows(table, rows, select, conn)
                count = None
                if count_requested == "exact":
                    count_sql = f"select count(*) as count from {qualify_table(table)}"
                    count_sql, count_params = _apply_filters(count_sql, {}, filters, or_expression)
                    count = conn.execute(__import__("sqlalchemy").text(count_sql), count_params).scalar_one()
                if single:
                    data = rows[0] if rows else None
                else:
                    data = rows
                return _json({"data": data, "count": count, "error": None})

            if op == "insert":
                rows_to_insert = values if isinstance(values, list) else [values]
                inserted: list[dict[str, Any]] = []
                for row in rows_to_insert:
                    cols = list(row.keys())
                    params = {k: row[k] for k in cols}
                    columns_sql = ", ".join(f'"{c}"' for c in cols)
                    values_sql = ", ".join(f":{c}" for c in cols)
                    sql = f"insert into {qualify_table(table)} ({columns_sql}) values ({values_sql})"
                    conflict_fields = on_conflict or (",".join(get_primary_key(table)) if payload.get("upsert") else "")
                    if conflict_fields:
                        sql += f" on conflict ({conflict_fields})"
                        sql += " do nothing" if ignore_duplicates else " do update set " + ", ".join(
                            f'"{c}" = excluded."{c}"' for c in cols if c not in [s.strip() for s in conflict_fields.split(",")]
                        )
                    sql += " returning *"
                    inserted_row = conn.execute(__import__("sqlalchemy").text(sql), params).mappings().first()
                    if inserted_row:
                        inserted.append(dict(inserted_row))
                return _json({"data": inserted if not single else (inserted[0] if inserted else None), "error": None})

            if op == "update":
                if not isinstance(values, dict):
                    return _json({"error": {"message": "Missing update values"}}, 400)
                set_sql = ", ".join(f'"{k}" = :set_{k}' for k in values.keys())
                params = {f"set_{k}": v for k, v in values.items()}
                sql = f"update {qualify_table(table)} set {set_sql}"
                sql, params = _apply_filters(sql, params, filters, or_expression)
                sql += " returning *"
                rows = [dict(r) for r in conn.execute(__import__("sqlalchemy").text(sql), params).mappings().all()]
                return _json({"data": rows if not single else (rows[0] if rows else None), "error": None})

            if op == "delete":
                sql = f"delete from {qualify_table(table)}"
                params: dict[str, Any] = {}
                sql, params = _apply_filters(sql, params, filters, or_expression)
                sql += " returning *"
                rows = [dict(r) for r in conn.execute(__import__("sqlalchemy").text(sql), params).mappings().all()]
                return _json({"data": rows if not single else (rows[0] if rows else None), "error": None})

            return _json({"error": {"message": f"Unsupported op: {op}"}}, 400)
        except Exception as exc:
            conn.rollback()
            return _json({"error": {"message": str(exc)}}, 400)


@app.post("/api/rpc/<name>")
@require_auth
def rpc(name: str):
    payload = request.get_json(force=True) or {}
    user_id = _current_user_id()
    with db_connection(user_id) as conn:
        try:
            if name == "check_rate_limit":
                conn.execute(
                    __import__("sqlalchemy").text(
                        "select public.check_rate_limit(:action, :max, :window_seconds)"
                    ),
                    {
                        "action": payload["p_action"],
                        "max": int(payload["p_max"]),
                        "window_seconds": int(payload["p_window_seconds"]),
                    },
                )
                return _json({"data": None, "error": None})
            if name == "mark_messages_read":
                conn.execute(
                    __import__("sqlalchemy").text(
                        "select public.mark_messages_read(:conversation_id)"
                    ),
                    {"conversation_id": payload["p_conversation_id"]},
                )
                return _json({"data": None, "error": None})
            return _json({"error": {"message": f"Unknown rpc: {name}"}}, 404)
        except Exception as exc:
            conn.rollback()
            return _json({"error": {"message": str(exc)}}, 400)


@app.post("/api/storage/<bucket>/upload")
@require_auth
def storage_upload(bucket: str):
    if "file" not in request.files:
        return _json({"error": {"message": "Missing file"}}, 400)
    file = request.files["file"]
    path = request.form.get("path")
    if not path:
        return _json({"error": {"message": "Missing path"}}, 400)
    overwrite = request.form.get("upsert", "false").lower() == "true"
    ensure_bucket(bucket)
    try:
        save_upload(bucket, path, file, overwrite=overwrite)
    except FileExistsError:
        return _json({"error": {"message": "File already exists"}}, 409)
    return _json({"data": {"path": path}, "error": None})


@app.post("/api/storage/<bucket>/signed-url")
@require_auth
def storage_signed_url(bucket: str):
    payload = request.get_json(force=True)
    path = payload.get("path")
    if not path:
        return _json({"error": {"message": "Missing path"}}, 400)
    expires_in = int(payload.get("expires_in", 3600))
    return _json({"data": {"signedUrl": sign_media(bucket, path, expires_in)}, "error": None})


@app.post("/api/storage/<bucket>/signed-urls")
@require_auth
def storage_signed_urls(bucket: str):
    payload = request.get_json(force=True)
    paths = payload.get("paths") or []
    expires_in = int(payload.get("expires_in", 3600))
    data = [{"path": path, "signedUrl": sign_media(bucket, path, expires_in)} for path in paths]
    return _json({"data": data, "error": None})


@app.post("/api/storage/<bucket>/remove")
@require_auth
def storage_remove(bucket: str):
    payload = request.get_json(force=True)
    removed = delete_paths(bucket, payload.get("paths") or [])
    return _json({"data": removed, "error": None})


@app.get("/api/media/<token>")
def media(token: str):
    expires_in = int(request.args.get("expires", "3600"))
    try:
        payload = verify_media_token(token, expires_in)
    except PermissionError as exc:
        return _json({"error": {"message": str(exc)}}, 403)
    target = ensure_bucket(payload["bucket"]) / payload["path"]
    if not target.exists():
        return _json({"error": {"message": "File not found"}}, 404)
    return send_file(target)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
