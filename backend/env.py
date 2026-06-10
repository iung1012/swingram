from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = Path(__file__).resolve().parent / ".env"
ROOT_ENV = ROOT / ".env"


def load_project_env() -> None:
    # Load the more specific backend/.env first, then fall back to the repo root.
    load_dotenv(BACKEND_ENV, override=False)
    load_dotenv(ROOT_ENV, override=False)

