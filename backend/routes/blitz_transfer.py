"""
BidBlitz V2 - BlitzTransfer (WeTransfer-Style Datei-Sharing)
Upload files, get a share link, recipient downloads without account.
Files auto-expire after configurable days.
"""
import os
import uuid
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/transfer", tags=["transfer"])

UPLOAD_DIR = Path("/var/www/bidblitz/uploads/transfers") if os.path.exists("/var/www/bidblitz") else Path(__file__).parent.parent / "uploads" / "transfers"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
MAX_FILES_PER_TRANSFER = 10
ALLOWED_EXTENSIONS = {
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv",
    "zip", "rar", "7z", "tar", "gz",
    "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp",
    "mp3", "wav", "ogg", "flac", "aac",
    "mp4", "mov", "avi", "mkv", "webm",
    "json", "xml", "html", "css", "js", "py",
}

def get_ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

def human_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


# ── Create Transfer (upload files) ──
@router.post("/create")
async def create_transfer(
    request: Request,
    files: list[UploadFile] = File(...),
    title: str = Form(""),
    message: str = Form(""),
    recipient_email: str = Form(""),
    expires_days: int = Form(7),
):
    user = await get_current_user(request)
    user_email = user.get("email", "")

    if len(files) > MAX_FILES_PER_TRANSFER:
        raise HTTPException(400, f"Maximal {MAX_FILES_PER_TRANSFER} Dateien pro Transfer")

    if expires_days < 1 or expires_days > 30:
        expires_days = 7

    transfer_id = str(uuid.uuid4())[:12]
    download_code = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    transfer_dir = UPLOAD_DIR / transfer_id
    transfer_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    total_size = 0

    for f in files:
        ext = get_ext(f.filename)
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Dateityp .{ext} nicht erlaubt")

        content = await f.read()
        file_size = len(content)
        total_size += file_size

        if total_size > MAX_FILE_SIZE:
            raise HTTPException(400, f"Gesamtgroesse ueberschreitet {human_size(MAX_FILE_SIZE)}")

        safe_name = f"{uuid.uuid4().hex[:8]}_{f.filename}"
        file_path = transfer_dir / safe_name
        file_path.write_bytes(content)

        saved_files.append({
            "original_name": f.filename,
            "stored_name": safe_name,
            "size": file_size,
            "size_human": human_size(file_size),
            "ext": ext,
            "content_type": f.content_type or "application/octet-stream",
        })

    transfer = {
        "transfer_id": transfer_id,
        "download_code": download_code,
        "sender_email": user_email,
        "sender_name": user.get("name", ""),
        "recipient_email": recipient_email,
        "title": title or f"Transfer von {user.get('name', user_email)}",
        "message": message,
        "files": saved_files,
        "file_count": len(saved_files),
        "total_size": total_size,
        "total_size_human": human_size(total_size),
        "downloads": 0,
        "max_downloads": 100,
        "expires_at": expires_at.isoformat(),
        "expires_days": expires_days,
        "status": "active",
        "created_at": now.isoformat(),
    }

    await db.transfers.insert_one(transfer)

    return {
        "ok": True,
        "transfer_id": transfer_id,
        "download_code": download_code,
        "download_url": f"/transfer/download/{transfer_id}/{download_code}",
        "share_link": f"/blitz-transfer/{transfer_id}/{download_code}",
        "file_count": len(saved_files),
        "total_size": human_size(total_size),
        "expires_at": expires_at.isoformat(),
        "expires_days": expires_days,
        "message": f"{len(saved_files)} Datei(en) hochgeladen ({human_size(total_size)}). Link gueltig fuer {expires_days} Tage.",
    }


# ── Get Transfer Info (public, no auth needed) ──
@router.get("/info/{transfer_id}/{code}")
async def get_transfer_info(transfer_id: str, code: str):
    t = await db.transfers.find_one(
        {"transfer_id": transfer_id, "download_code": code},
        {"_id": 0, "download_code": 0}
    )
    if not t:
        raise HTTPException(404, "Transfer nicht gefunden oder Link ungueltig")

    now = datetime.now(timezone.utc)
    if t.get("expires_at") and now > datetime.fromisoformat(t["expires_at"]):
        return {"status": "expired", "message": "Dieser Transfer ist abgelaufen."}

    if t.get("status") != "active":
        return {"status": t.get("status", "inactive"), "message": "Transfer nicht verfuegbar."}

    return {
        "status": "active",
        "transfer_id": t["transfer_id"],
        "sender_name": t.get("sender_name", ""),
        "title": t.get("title", ""),
        "message": t.get("message", ""),
        "files": [{
            "name": f["original_name"],
            "size": f["size_human"],
            "ext": f["ext"],
        } for f in t.get("files", [])],
        "file_count": t.get("file_count", 0),
        "total_size": t.get("total_size_human", ""),
        "downloads": t.get("downloads", 0),
        "expires_at": t.get("expires_at", ""),
        "created_at": t.get("created_at", ""),
    }


# ── Download single file ──
@router.get("/download/{transfer_id}/{code}/{file_index}")
async def download_file(transfer_id: str, code: str, file_index: int):
    t = await db.transfers.find_one({"transfer_id": transfer_id, "download_code": code})
    if not t:
        raise HTTPException(404, "Transfer nicht gefunden")

    now = datetime.now(timezone.utc)
    if t.get("expires_at") and now > datetime.fromisoformat(t["expires_at"]):
        raise HTTPException(410, "Transfer abgelaufen")

    files = t.get("files", [])
    if file_index < 0 or file_index >= len(files):
        raise HTTPException(404, "Datei nicht gefunden")

    f = files[file_index]
    file_path = UPLOAD_DIR / transfer_id / f["stored_name"]
    if not file_path.exists():
        raise HTTPException(404, "Datei nicht mehr verfuegbar")

    await db.transfers.update_one(
        {"transfer_id": transfer_id},
        {"$inc": {"downloads": 1}}
    )

    return FileResponse(
        path=str(file_path),
        filename=f["original_name"],
        media_type=f.get("content_type", "application/octet-stream"),
    )


# ── My Transfers (sent) ──
@router.get("/my-transfers")
async def my_transfers(request: Request):
    user = await get_current_user(request)
    transfers = await db.transfers.find(
        {"sender_email": user.get("email")},
        {"_id": 0, "download_code": 0}
    ).sort("created_at", -1).limit(50).to_list(50)

    # Check expiration
    now = datetime.now(timezone.utc)
    for t in transfers:
        if t.get("expires_at") and now > datetime.fromisoformat(t["expires_at"]):
            t["status"] = "expired"

    return {"transfers": transfers}


# ── Delete Transfer ──
@router.delete("/{transfer_id}")
async def delete_transfer(transfer_id: str, request: Request):
    user = await get_current_user(request)
    t = await db.transfers.find_one({"transfer_id": transfer_id, "sender_email": user.get("email")})
    if not t:
        raise HTTPException(404, "Transfer nicht gefunden")

    # Delete files
    import shutil
    transfer_dir = UPLOAD_DIR / transfer_id
    if transfer_dir.exists():
        shutil.rmtree(transfer_dir)

    await db.transfers.update_one(
        {"transfer_id": transfer_id},
        {"$set": {"status": "deleted"}}
    )

    return {"ok": True, "message": "Transfer geloescht"}
