import os
import uuid
import mimetypes
from typing import Tuple

import requests


STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "bidblitz-charge"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

_storage_key = None


def _init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY fehlt für Charge-Uploads")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    guessed = mimetypes.guess_type(filename or "")[0]
    return guessed or fallback


def upload_bytes(user_id: str, filename: str, content: bytes, content_type: str | None = None) -> dict:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4().hex}.{ext}"
    key = _init_storage()
    headers = {
        "X-Storage-Key": key,
        "Content-Type": content_type or _guess_content_type(filename),
    }
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers=headers, data=content, timeout=120)
    if resp.status_code == 403:
        headers["X-Storage-Key"] = _init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers=headers, data=content, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_bytes(path: str) -> Tuple[bytes, str]:
    key = _init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 403:
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": _init_storage(force=True)}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
