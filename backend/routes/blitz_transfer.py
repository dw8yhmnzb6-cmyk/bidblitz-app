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

MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024  # 10 GB
MAX_FILES_PER_TRANSFER = 10
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB chunks
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

        safe_name = f"{uuid.uuid4().hex[:8]}_{f.filename}"
        file_path = transfer_dir / safe_name

        # Stream to disk in chunks (don't load entire file to RAM)
        file_size = 0
        with open(file_path, "wb") as out:
            while True:
                chunk = await f.read(CHUNK_SIZE)
                if not chunk:
                    break
                out.write(chunk)
                file_size += len(chunk)
                if total_size + file_size > MAX_FILE_SIZE:
                    out.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(400, f"Gesamtgroesse ueberschreitet {human_size(MAX_FILE_SIZE)}")

        total_size += file_size

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


# ── Chunked Upload: Init ──
class ChunkInitRequest(BaseModel):
    filename: str
    total_size: int
    total_chunks: int

@router.post("/chunk/init")
async def chunk_init(req: ChunkInitRequest, request: Request):
    user = await get_current_user(request)
    ext = get_ext(req.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Dateityp .{ext} nicht erlaubt")
    if req.total_size > MAX_FILE_SIZE:
        raise HTTPException(400, f"Datei zu gross. Max: {human_size(MAX_FILE_SIZE)}")

    upload_id = str(uuid.uuid4())[:12]
    chunk_dir = UPLOAD_DIR / "chunks" / upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    await db.chunk_uploads.insert_one({
        "upload_id": upload_id,
        "user_email": user.get("email"),
        "filename": req.filename,
        "total_size": req.total_size,
        "total_chunks": req.total_chunks,
        "uploaded_chunks": 0,
        "status": "uploading",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"upload_id": upload_id, "chunk_size": CHUNK_SIZE}


# ── Chunked Upload: Upload Chunk ──
@router.post("/chunk/{upload_id}/{chunk_index}")
async def upload_chunk(upload_id: str, chunk_index: int, request: Request, chunk: UploadFile = File(...)):
    info = await db.chunk_uploads.find_one({"upload_id": upload_id})
    if not info:
        raise HTTPException(404, "Upload nicht gefunden")

    chunk_dir = UPLOAD_DIR / "chunks" / upload_id
    chunk_path = chunk_dir / f"chunk_{chunk_index:06d}"

    content = await chunk.read()
    chunk_path.write_bytes(content)

    await db.chunk_uploads.update_one(
        {"upload_id": upload_id},
        {"$inc": {"uploaded_chunks": 1}}
    )

    info = await db.chunk_uploads.find_one({"upload_id": upload_id})
    done = info["uploaded_chunks"] >= info["total_chunks"]

    return {
        "ok": True,
        "chunk_index": chunk_index,
        "uploaded": info["uploaded_chunks"],
        "total": info["total_chunks"],
        "complete": done,
    }


# ── Chunked Upload: Finalize ──
class ChunkFinalizeRequest(BaseModel):
    upload_id: str
    title: str = ""
    message: str = ""
    recipient_email: str = ""
    expires_days: int = 7

@router.post("/chunk/finalize")
async def chunk_finalize(req: ChunkFinalizeRequest, request: Request):
    user = await get_current_user(request)
    info = await db.chunk_uploads.find_one({"upload_id": req.upload_id, "user_email": user.get("email")})
    if not info:
        raise HTTPException(404, "Upload nicht gefunden")

    chunk_dir = UPLOAD_DIR / "chunks" / req.upload_id

    # Assemble file from chunks
    transfer_id = str(uuid.uuid4())[:12]
    download_code = secrets.token_urlsafe(16)
    transfer_dir = UPLOAD_DIR / transfer_id
    transfer_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{info['filename']}"
    final_path = transfer_dir / safe_name

    total_size = 0
    with open(final_path, "wb") as out:
        for i in range(info["total_chunks"]):
            cp = chunk_dir / f"chunk_{i:06d}"
            if cp.exists():
                data = cp.read_bytes()
                out.write(data)
                total_size += len(data)

    # Cleanup chunks
    import shutil
    if chunk_dir.exists():
        shutil.rmtree(chunk_dir)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=max(1, min(req.expires_days, 30)))
    ext = get_ext(info["filename"])

    transfer = {
        "transfer_id": transfer_id,
        "download_code": download_code,
        "sender_email": user.get("email"),
        "sender_name": user.get("name", ""),
        "recipient_email": req.recipient_email,
        "title": req.title or f"Transfer von {user.get('name', user.get('email'))}",
        "message": req.message,
        "files": [{
            "original_name": info["filename"],
            "stored_name": safe_name,
            "size": total_size,
            "size_human": human_size(total_size),
            "ext": ext,
            "content_type": "application/octet-stream",
        }],
        "file_count": 1,
        "total_size": total_size,
        "total_size_human": human_size(total_size),
        "downloads": 0,
        "max_downloads": 100,
        "expires_at": expires_at.isoformat(),
        "expires_days": req.expires_days,
        "status": "active",
        "created_at": now.isoformat(),
    }

    await db.transfers.insert_one(transfer)
    await db.chunk_uploads.delete_one({"upload_id": req.upload_id})

    return {
        "ok": True,
        "transfer_id": transfer_id,
        "download_code": download_code,
        "share_link": f"/blitz-transfer/{transfer_id}/{download_code}",
        "file_count": 1,
        "total_size": human_size(total_size),
        "expires_at": expires_at.isoformat(),
        "expires_days": req.expires_days,
        "message": f"Datei hochgeladen ({human_size(total_size)}). Link gueltig fuer {req.expires_days} Tage.",
    }


# ── Auto-Cleanup expired transfers ──
@router.post("/cleanup")
async def cleanup_expired(request: Request):
    await require_admin(request)
    import shutil
    now = datetime.now(timezone.utc)
    expired = await db.transfers.find({"expires_at": {"$lt": now.isoformat()}, "status": "active"}).to_list(None)

    cleaned = 0
    freed = 0
    for t in expired:
        tid = t["transfer_id"]
        tdir = UPLOAD_DIR / tid
        if tdir.exists():
            for f in tdir.iterdir():
                freed += f.stat().st_size
            shutil.rmtree(tdir)
        await db.transfers.update_one({"transfer_id": tid}, {"$set": {"status": "expired"}})
        cleaned += 1

    # Also cleanup orphan chunk dirs older than 24h
    chunk_base = UPLOAD_DIR / "chunks"
    if chunk_base.exists():
        for d in chunk_base.iterdir():
            if d.is_dir():
                age = now.timestamp() - d.stat().st_mtime
                if age > 86400:
                    shutil.rmtree(d)
                    cleaned += 1

    return {"ok": True, "cleaned": cleaned, "freed": human_size(freed)}


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")
    return user
