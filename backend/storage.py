from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.datastructures import FileStorage

from .env import load_project_env

load_project_env()

ROOT = Path(__file__).resolve().parents[1]


def storage_root() -> Path:
    raw_root = Path(os.getenv("STORAGE_DIR", "backend_data/storage"))
    # Keep relative storage paths anchored to the repository root so uploads and
    # signed media always point at the same on-disk location, regardless of the
    # backend process working directory.
    root = raw_root if raw_root.is_absolute() else ROOT / raw_root
    root = root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _serializer() -> URLSafeTimedSerializer:
    secret = os.getenv("STORAGE_SECRET", os.getenv("JWT_SECRET_KEY", "dev-storage-secret"))
    return URLSafeTimedSerializer(secret, salt="brasa-storage")


def bucket_path(bucket: str, path: str) -> Path:
    return storage_root() / bucket / path


def ensure_bucket(bucket: str) -> Path:
    root = storage_root() / bucket
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(bucket: str, path: str, file: FileStorage, *, overwrite: bool = False) -> None:
    target = bucket_path(bucket, path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite:
        raise FileExistsError(path)
    file.save(target)


def delete_paths(bucket: str, paths: Iterable[str]) -> list[str]:
    removed: list[str] = []
    for path in paths:
        target = bucket_path(bucket, path)
        if target.exists():
            target.unlink()
            removed.append(path)
    return removed


def sign_media(bucket: str, path: str, expires_in: int = 3600) -> str:
    token = _serializer().dumps({"bucket": bucket, "path": path})
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:5005").rstrip("/") + "/"
    return urljoin(base_url, f"api/media/{token}?expires={expires_in}")


def verify_media_token(token: str, max_age: int | None = None) -> dict[str, str]:
    try:
        payload = _serializer().loads(token, max_age=max_age)
    except SignatureExpired as exc:
        raise PermissionError("Expired media token") from exc
    except BadSignature as exc:
        raise PermissionError("Invalid media token") from exc
    if not isinstance(payload, dict) or "bucket" not in payload or "path" not in payload:
        raise PermissionError("Invalid media token")
    return {"bucket": str(payload["bucket"]), "path": str(payload["path"])}
