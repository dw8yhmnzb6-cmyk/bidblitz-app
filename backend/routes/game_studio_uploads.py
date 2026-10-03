"""Secure quarantine upload for third-party HTML5 game builds.

Uploaded archives are validated and stored, but NEVER executed or published here.
A separate cookie-free preview origin is required before untrusted game code may run.
"""

import hashlib
import os
import shutil
import stat
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/game-studio", tags=["game-studio-uploads"])

MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_UNPACKED_BYTES = 250 * 1024 * 1024
MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024
MAX_FILES = 2000
MAX_COMPRESSION_RATIO = 150
MAX_VERSIONS_PER_DRAFT = 20

ALLOWED_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".json", ".map", ".txt",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".otf",
    ".mp3", ".ogg", ".wav", ".m4a",
    ".mp4", ".webm",
    ".wasm", ".bin", ".dat",
}
BLOCKED_BASENAMES = {
    "service-worker.js", "service_worker.js", "sw.js",
    ".htaccess", ".user.ini", "web.config",
}
BLOCKED_EXTENSIONS = {
    ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz",
    ".php", ".phtml", ".phar", ".py", ".rb", ".pl", ".cgi",
    ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
    ".exe", ".dll", ".so", ".dylib", ".jar", ".class",
}
ALLOWED_MIME = {
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
    "binary/octet-stream",
}
UPLOAD_ROOT = Path(
    os.environ.get(
        "GAME_STUDIO_UPLOAD_ROOT",
        str(Path(__file__).resolve().parents[1] / "private" / "game-studio" / "quarantine"),
    )
)


def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


def _owner_dir(owner_id: str) -> str:
    return hashlib.sha256(owner_id.encode("utf-8")).hexdigest()[:24]


def _clean_member_name(name: str) -> str:
    if not isinstance(name, str) or not name or "\x00" in name or "\\" in name:
        raise HTTPException(400, "Ungültiger Pfad im ZIP")
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise HTTPException(400, "Unsicherer Pfad im ZIP")
    if len(name) > 240 or any(len(part) > 120 for part in path.parts):
        raise HTTPException(400, "Pfad im ZIP ist zu lang")
    return path.as_posix()


def _inspect_zip(path: Path) -> dict:
    if not zipfile.is_zipfile(path):
        raise HTTPException(400, "Datei ist kein gültiges ZIP-Archiv")

    total_unpacked = 0
    file_count = 0
    names: set[str] = set()
    has_index = False

    try:
        with zipfile.ZipFile(path, "r") as archive:
            for info in archive.infolist():
                name = _clean_member_name(info.filename)
                if name in names:
                    raise HTTPException(400, "Doppelte Dateipfade im ZIP")
                names.add(name)

                mode = (info.external_attr >> 16) & 0o170000
                if mode == stat.S_IFLNK:
                    raise HTTPException(400, "Symbolische Links sind nicht erlaubt")
                if info.flag_bits & 0x1:
                    raise HTTPException(400, "Verschlüsselte ZIP-Dateien sind nicht erlaubt")
                if info.is_dir():
                    continue

                file_count += 1
                if file_count > MAX_FILES:
                    raise HTTPException(413, f"Zu viele Dateien (maximal {MAX_FILES})")
                if info.file_size > MAX_SINGLE_FILE_BYTES:
                    raise HTTPException(413, "Einzeldatei überschreitet das Größenlimit")
                total_unpacked += info.file_size
                if total_unpacked > MAX_UNPACKED_BYTES:
                    raise HTTPException(413, "Entpackter Inhalt ist zu groß")

                if info.file_size and info.compress_size == 0:
                    raise HTTPException(400, "Verdächtiges Kompressionsverhältnis")
                if info.file_size / max(1, info.compress_size) > MAX_COMPRESSION_RATIO:
                    raise HTTPException(400, "Verdächtiges Kompressionsverhältnis")

                pure = PurePosixPath(name)
                basename = pure.name.lower()
                suffix = pure.suffix.lower()
                if basename in BLOCKED_BASENAMES or suffix in BLOCKED_EXTENSIONS:
                    raise HTTPException(400, f"Nicht erlaubte Datei im Spielpaket: {basename}")
                if suffix not in ALLOWED_EXTENSIONS:
                    raise HTTPException(400, f"Nicht unterstützter Dateityp: {suffix or '(ohne Endung)'}")
                if name == "index.html":
                    has_index = True
    except (zipfile.BadZipFile, zipfile.LargeZipFile):
        raise HTTPException(400, "ZIP-Archiv ist beschädigt")

    if not file_count:
        raise HTTPException(400, "ZIP-Archiv enthält keine Spieldateien")
    if not has_index:
        raise HTTPException(400, "index.html muss im Hauptverzeichnis des ZIP liegen")

    return {
        "file_count": file_count,
        "unpacked_bytes": total_unpacked,
        "entrypoint": "index.html",
    }


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


async def _owned_draft(draft_id: str, owner_id: str) -> dict:
    draft = await db.game_studio_drafts.find_one(
        {"id": draft_id, "owner_id": owner_id, "status": "draft"},
        {"_id": 0},
    )
    if not draft:
        raise HTTPException(404, "Spielentwurf nicht gefunden")
    return draft


async def _save_upload(file: UploadFile, target: Path) -> tuple[int, str]:
    total = 0
    digest = hashlib.sha256()
    with target.open("wb") as handle:
        while True:
            chunk = await file.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_ARCHIVE_BYTES:
                raise HTTPException(413, "ZIP-Datei ist zu groß (maximal 50 MB)")
            digest.update(chunk)
            handle.write(chunk)
    if total < 64:
        raise HTTPException(400, "ZIP-Datei ist leer oder zu klein")
    return total, digest.hexdigest()


async def _reserve_version_slot(owner_id: str, draft_id: str, version_id: str) -> int:
    for slot in range(MAX_VERSIONS_PER_DRAFT):
        try:
            await db.game_studio_version_slots.insert_one({
                "_id": f"{owner_id}:{draft_id}:{slot}",
                "owner_id": owner_id,
                "draft_id": draft_id,
                "version_id": version_id,
                "slot": slot,
            })
            return slot
        except Exception as exc:
            if not _duplicate_key(exc):
                raise
    raise HTTPException(409, f"Maximal {MAX_VERSIONS_PER_DRAFT} Versionen pro Spielentwurf")


def _public_version(doc: dict) -> dict:
    return {
        key: value for key, value in doc.items()
        if key not in {"_id", "owner_id", "storage_path"}
    }


@router.get("/drafts/{draft_id}/versions")
async def list_versions(draft_id: str, request: Request):
    owner_id = await _owner(request)
    await _owned_draft(draft_id, owner_id)
    rows = await db.game_studio_versions.find(
        {"draft_id": draft_id, "owner_id": owner_id, "status": {"$ne": "deleted"}},
        {"_id": 0, "owner_id": 0, "storage_path": 0},
    ).sort("created_at", -1).limit(MAX_VERSIONS_PER_DRAFT).to_list(MAX_VERSIONS_PER_DRAFT)
    return {"versions": rows}


@router.post("/drafts/{draft_id}/versions", status_code=201)
async def upload_version(draft_id: str, request: Request, file: UploadFile = File(...)):
    owner_id = await _owner(request)
    await _owned_draft(draft_id, owner_id)

    filename = (file.filename or "").strip()
    if Path(filename).suffix.lower() != ".zip":
        raise HTTPException(400, "Nur ZIP-Dateien sind erlaubt")
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Ungültiger ZIP-Inhaltstyp")

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    temp_path = None
    slot = None
    version_id = str(uuid4())
    try:
        with tempfile.NamedTemporaryFile(
            prefix="game-upload-", suffix=".zip", dir=UPLOAD_ROOT, delete=False
        ) as tmp:
            temp_path = Path(tmp.name)

        archive_bytes, sha256 = await _save_upload(file, temp_path)
        inspection = _inspect_zip(temp_path)

        duplicate = await db.game_studio_versions.find_one({
            "owner_id": owner_id,
            "draft_id": draft_id,
            "sha256": sha256,
            "status": {"$ne": "deleted"},
        })
        if duplicate:
            temp_path.unlink(missing_ok=True)
            return {**_public_version(duplicate), "duplicate": True}

        slot = await _reserve_version_slot(owner_id, draft_id, version_id)
        destination_dir = UPLOAD_ROOT / _owner_dir(owner_id) / draft_id
        destination_dir.mkdir(parents=True, exist_ok=True)
        destination = destination_dir / f"{version_id}.zip"
        os.replace(temp_path, destination)
        temp_path = None

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": version_id,
            "draft_id": draft_id,
            "owner_id": owner_id,
            "slot": slot,
            "version_number": slot + 1,
            "status": "quarantined",
            "validation_status": "archive_validated",
            "execution_status": "blocked_pending_isolated_preview",
            "review_status": "not_submitted",
            "entrypoint": inspection["entrypoint"],
            "file_count": inspection["file_count"],
            "archive_bytes": archive_bytes,
            "unpacked_bytes": inspection["unpacked_bytes"],
            "sha256": sha256,
            "original_filename": filename[:180],
            "storage_path": str(destination),
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.game_studio_versions.insert_one(doc)
        except Exception as exc:
            if _duplicate_key(exc):
                destination.unlink(missing_ok=True)
                await db.game_studio_version_slots.delete_one({
                    "owner_id": owner_id, "draft_id": draft_id, "version_id": version_id
                })
                existing = await db.game_studio_versions.find_one({
                    "owner_id": owner_id,
                    "draft_id": draft_id,
                    "sha256": sha256,
                    "status": {"$ne": "deleted"},
                })
                if existing:
                    return {**_public_version(existing), "duplicate": True}
            raise
        return _public_version(doc)
    except Exception:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        if slot is not None:
            await db.game_studio_version_slots.delete_one({
                "owner_id": owner_id, "draft_id": draft_id, "version_id": version_id
            })
        raise
    finally:
        await file.close()


@router.post("/drafts/{draft_id}/versions/{version_id}/submit-review")
async def submit_version_for_review(draft_id: str, version_id: str, request: Request):
    owner_id = await _owner(request)
    await _owned_draft(draft_id, owner_id)
    now = datetime.now(timezone.utc).isoformat()
    result = await db.game_studio_versions.update_one(
        {
            "id": version_id,
            "draft_id": draft_id,
            "owner_id": owner_id,
            "status": "quarantined",
            "validation_status": "archive_validated",
            "review_status": {"$in": ["not_submitted", "changes_requested"]},
        },
        {"$set": {"review_status": "submitted", "submitted_at": now, "updated_at": now}},
    )
    if not result.matched_count:
        existing = await db.game_studio_versions.find_one({
            "id": version_id, "draft_id": draft_id, "owner_id": owner_id,
        })
        if not existing:
            raise HTTPException(404, "Spielversion nicht gefunden")
        if existing.get("review_status") == "submitted":
            return _public_version(existing)
        raise HTTPException(409, "Diese Version kann derzeit nicht eingereicht werden")
    doc = await db.game_studio_versions.find_one({
        "id": version_id, "draft_id": draft_id, "owner_id": owner_id,
    })
    return _public_version(doc)


@router.delete("/drafts/{draft_id}/versions/{version_id}")
async def delete_version(draft_id: str, version_id: str, request: Request):
    owner_id = await _owner(request)
    await _owned_draft(draft_id, owner_id)
    doc = await db.game_studio_versions.find_one({
        "id": version_id,
        "draft_id": draft_id,
        "owner_id": owner_id,
        "status": {"$ne": "deleted"},
    })
    if not doc:
        raise HTTPException(404, "Spielversion nicht gefunden")
    if doc.get("review_status") == "submitted":
        raise HTTPException(409, "Eingereichte Version zuerst aus der Prüfung zurückziehen")

    path = Path(doc.get("storage_path") or "")
    if path:
        try:
            resolved_root = UPLOAD_ROOT.resolve()
            resolved_path = path.resolve()
            if resolved_path.is_relative_to(resolved_root):
                resolved_path.unlink(missing_ok=True)
        except (OSError, RuntimeError):
            pass

    now = datetime.now(timezone.utc).isoformat()
    await db.game_studio_versions.update_one(
        {"id": version_id, "owner_id": owner_id},
        {"$set": {"status": "deleted", "deleted_at": now, "updated_at": now}},
    )
    await db.game_studio_version_slots.delete_one({
        "owner_id": owner_id, "draft_id": draft_id, "version_id": version_id
    })
    return {"deleted": True}
