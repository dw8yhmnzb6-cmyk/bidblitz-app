"""
BidBlitz V2 - BlitzTransfer (WeTransfer-Style Datei-Sharing)
Upload files, get a share link, recipient downloads without account.
Files auto-expire after configurable days.
"""
import os
import uuid
import secrets
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from core.database import db
from core.security import get_current_user
from core.payment_engine import debit_wallet, credit_wallet, TransactionType

router = APIRouter(prefix="/api/transfer", tags=["transfer"])
logger = logging.getLogger("bidblitz.transfer")

UPLOAD_DIR = Path("/var/www/bidblitz/uploads/transfers") if os.path.exists("/var/www/bidblitz") else Path(__file__).parent.parent / "uploads" / "transfers"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024  # 10 GB
MAX_FILES_PER_TRANSFER = 10
CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB chunks

# Pricing tiers (pay per transfer from wallet)
TRANSFER_TIERS = {
    "free":  {"max_bytes": 1 * 1024 * 1024 * 1024, "price": 0,    "label": "Kostenlos", "max_days": 7,  "max_downloads": 5},
    "plus":  {"max_bytes": 5 * 1024 * 1024 * 1024, "price": 1.99, "label": "Plus (5 GB)", "max_days": 30, "max_downloads": 100},
    "pro":   {"max_bytes": 10* 1024 * 1024 * 1024, "price": 3.99, "label": "Pro (10 GB)", "max_days": 30, "max_downloads": -1},  # -1 = unlimited
}
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

def determine_tier(total_size: int) -> dict:
    """Determine pricing tier based on total file size."""
    for key in ["free", "plus", "pro"]:
        tier = TRANSFER_TIERS[key]
        if total_size <= tier["max_bytes"]:
            return {"tier": key, **tier}
    return {"tier": "pro", **TRANSFER_TIERS["pro"]}


def _require_transfer_idempotency_key(request: Request) -> str:
    key = (request.headers.get("Idempotency-Key") or "").strip()
    if not 8 <= len(key) <= 200:
        raise HTTPException(status_code=400, detail="Idempotency-Key erforderlich")
    return f"blitz-transfer:{key}"


def _transfer_key_hash(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]



# ── Get Pricing Info ──
@router.get("/pricing")
async def get_pricing():
    return {
        "tiers": [
            {"id": k, "label": v["label"], "max_size": human_size(v["max_bytes"]), "max_size_bytes": v["max_bytes"],
             "price": v["price"], "max_days": v["max_days"],
             "max_downloads": v["max_downloads"] if v["max_downloads"] > 0 else "Unbegrenzt"}
            for k, v in TRANSFER_TIERS.items()
        ]
    }


# ── Create Transfer (upload files) ──
@router.post("/create")
async def create_transfer(
    request: Request,
    files: list[UploadFile] = File(...),
    title: str = Form(""),
    message: str = Form(""),
    recipient_email: str = Form(""),
    expires_days: int = Form(7),
    tier: str = Form("free"),
    password: str = Form(""),
):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    user_email = user.get("email", "")

    if len(files) > MAX_FILES_PER_TRANSFER:
        raise HTTPException(400, f"Maximal {MAX_FILES_PER_TRANSFER} Dateien pro Transfer")

    if tier not in TRANSFER_TIERS:
        tier = "free"
    tier_info = TRANSFER_TIERS[tier]
    price = float(tier_info["price"])

    idempotency_key = None
    key_hash = None
    if price > 0:
        idempotency_key = _require_transfer_idempotency_key(request)
        key_hash = _transfer_key_hash(idempotency_key)

        refunded = await db.blitz_transfer_payment_attempts.find_one({
            "user_id": user_id,
            "idempotency_key_hash": key_hash,
            "status": "refunded",
        }, {"_id": 0, "idempotency_key_hash": 1})
        if refunded:
            raise HTTPException(
                status_code=409,
                detail="Vorheriger Transfer-Versuch wurde zurückgebucht. Bitte erneut senden.",
            )

        existing = await db.transfers.find_one(
            {"sender_user_id": user_id, "wallet_idempotency_key_hash": key_hash},
            {"_id": 0},
        )
        if existing and existing.get("status") in {"active", "payment_pending"}:
            return {
                "ok": True,
                "transfer_id": existing["transfer_id"],
                "download_code": existing["download_code"],
                "download_url": f"/transfer/download/{existing['transfer_id']}/{existing['download_code']}",
                "share_link": f"/blitz-transfer/{existing['transfer_id']}/{existing['download_code']}",
                "status": existing.get("status"),
                "price_paid": existing.get("price_paid", price),
                "replayed": True,
            }

    expires_days = min(max(1, expires_days), tier_info["max_days"])
    transfer_id = (
        f"BTF-{key_hash[:12]}"
        if key_hash
        else str(uuid.uuid4())[:12]
    )
    download_code = secrets.token_urlsafe(16)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    transfer_dir = UPLOAD_DIR / transfer_id
    transfer_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    total_size = 0
    try:
        for upload in files:
            ext = get_ext(upload.filename)
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(400, f"Dateityp .{ext} nicht erlaubt")

            safe_name = f"{uuid.uuid4().hex[:8]}_{Path(upload.filename or 'file').name}"
            file_path = transfer_dir / safe_name
            file_size = 0

            with open(file_path, "wb") as out:
                while True:
                    chunk = await upload.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    out.write(chunk)
                    file_size += len(chunk)
                    if total_size + file_size > MAX_FILE_SIZE:
                        raise HTTPException(400, f"Gesamtgroesse ueberschreitet {human_size(MAX_FILE_SIZE)}")

            total_size += file_size
            saved_files.append({
                "original_name": Path(upload.filename or "file").name,
                "stored_name": safe_name,
                "size": file_size,
                "size_human": human_size(file_size),
                "ext": ext,
                "content_type": upload.content_type or "application/octet-stream",
            })

        if total_size > tier_info["max_bytes"]:
            raise HTTPException(
                400,
                f"Dateigroesse ({human_size(total_size)}) ueberschreitet {tier_info['label']} Limit ({human_size(tier_info['max_bytes'])}). Waehle ein hoeheres Paket.",
            )
    except Exception:
        import shutil
        if transfer_dir.exists():
            shutil.rmtree(transfer_dir)
        raise

    payment_result = None
    if price > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=price,
            tx_type=TransactionType.PAYMENT,
            description=f"BlitzTransfer {tier_info['label']} — {human_size(total_size)}",
            reference=f"BTF-{key_hash[:12].upper()}",
            metadata={
                "kind": "blitz_transfer",
                "tier": tier,
                "transfer_id": transfer_id,
                "total_size": total_size,
            },
            idempotency_key=idempotency_key,
        )
        if not payment_result.success:
            import shutil
            if transfer_dir.exists():
                shutil.rmtree(transfer_dir)
            raise HTTPException(status_code=400, detail=payment_result.error or "Wallet-Zahlung fehlgeschlagen")

    pw_hash = hashlib.sha256(password.encode()).hexdigest() if password else None
    transfer = {
        "transfer_id": transfer_id,
        "download_code": download_code,
        "sender_user_id": user_id,
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
        "max_downloads": tier_info["max_downloads"],
        "password_hash": pw_hash,
        "tier": tier,
        "price_paid": price,
        "wallet_idempotency_key_hash": key_hash,
        "wallet_transaction_id": payment_result.transaction_id if payment_result else None,
        "payment_status": "paid" if payment_result else "free",
        "expires_at": expires_at.isoformat(),
        "expires_days": expires_days,
        "status": "active",
        "created_at": now.isoformat(),
    }

    try:
        if key_hash:
            await db.transfers.update_one(
                {"sender_user_id": user_id, "wallet_idempotency_key_hash": key_hash},
                {"$setOnInsert": transfer},
                upsert=True,
            )
            stored = await db.transfers.find_one(
                {"sender_user_id": user_id, "wallet_idempotency_key_hash": key_hash},
                {"_id": 0},
            )
            if not stored:
                raise RuntimeError("transfer_not_persisted")
            transfer = stored
        else:
            await db.transfers.insert_one(transfer)
            transfer.pop("_id", None)
    except Exception as exc:
        import shutil
        if transfer_dir.exists():
            shutil.rmtree(transfer_dir)

        if payment_result and payment_result.success:
            await db.blitz_transfer_payment_attempts.update_one(
                {"user_id": user_id, "idempotency_key_hash": key_hash},
                {"$set": {
                    "user_id": user_id,
                    "idempotency_key_hash": key_hash,
                    "transfer_id": transfer_id,
                    "status": "refund_pending",
                    "error": str(exc)[:500],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
            refund = await credit_wallet(
                user_id=user_id,
                amount=price,
                tx_type=TransactionType.REFUND,
                description="BlitzTransfer Rückbuchung",
                reference=f"BTF-REF-{key_hash[:10].upper()}",
                source="blitz_transfer_rollback",
                metadata={"transfer_id": transfer_id, "original_transaction_id": payment_result.transaction_id},
                idempotency_key=f"blitz-transfer-refund:{idempotency_key}",
            )
            await db.blitz_transfer_payment_attempts.update_one(
                {"user_id": user_id, "idempotency_key_hash": key_hash},
                {"$set": {
                    "status": "refunded" if refund.success else "reconciliation_required",
                    "refund_transaction_id": refund.transaction_id if refund.success else None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            if not refund.success:
                raise HTTPException(status_code=500, detail="Transfer-Speicherung und Rückbuchung fehlgeschlagen. Manuelle Prüfung erforderlich.")
        raise HTTPException(status_code=500, detail="Transfer konnte nicht gespeichert werden. Zahlung wurde zurückgebucht.")

    if recipient_email and "@" in recipient_email:
        try:
            from core.email import send_transfer_notification
            share_url = f"https://bidblitz.ae/blitz-transfer/{transfer_id}/{download_code}"
            send_transfer_notification(
                to=recipient_email,
                sender_name=user.get("name", user_email),
                title=title or f"Transfer von {user.get('name', user_email)}",
                message=message,
                file_count=len(saved_files),
                total_size=human_size(total_size),
                share_url=share_url,
                expires_days=expires_days,
            )
        except Exception as exc:
            logger.error("Failed to send transfer email: %s", exc)

    return {
        "ok": True,
        "transfer_id": transfer_id,
        "download_code": download_code,
        "download_url": f"/transfer/download/{transfer_id}/{download_code}",
        "share_link": f"/blitz-transfer/{transfer_id}/{download_code}",
        "price_paid": price,
        "new_balance": payment_result.new_balance if payment_result else float(user.get("balance") or 0),
        "replayed": bool(payment_result.idempotent_replay) if payment_result else False,
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
    tier: str = "free"

@router.post("/chunk/init")
async def chunk_init(req: ChunkInitRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    ext = get_ext(req.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Dateityp .{ext} nicht erlaubt")
    if req.total_size <= 0 or req.total_size > MAX_FILE_SIZE:
        raise HTTPException(400, f"Datei zu gross. Max: {human_size(MAX_FILE_SIZE)}")
    if req.total_chunks <= 0 or req.total_chunks > 10000:
        raise HTTPException(400, "Ungültige Chunk-Anzahl")

    tier = req.tier if req.tier in TRANSFER_TIERS else "free"
    tier_info = TRANSFER_TIERS[tier]
    if req.total_size > tier_info["max_bytes"]:
        raise HTTPException(
            status_code=400,
            detail=f"Datei ({human_size(req.total_size)}) überschreitet {tier_info['label']} Limit ({human_size(tier_info['max_bytes'])}).",
        )

    price = float(tier_info["price"])
    wallet_key_hash = None
    if price > 0:
        wallet_key = _require_transfer_idempotency_key(request)
        wallet_key_hash = _transfer_key_hash(wallet_key)

        refunded = await db.blitz_transfer_payment_attempts.find_one(
            {"user_id": user_id, "idempotency_key_hash": wallet_key_hash, "status": "refunded"},
            {"_id": 0, "idempotency_key_hash": 1},
        )
        if refunded:
            raise HTTPException(status_code=409, detail="Vorheriger Upload-Versuch wurde zurückgebucht. Bitte erneut starten.")

        existing = await db.chunk_uploads.find_one(
            {"user_id": user_id, "wallet_idempotency_key_hash": wallet_key_hash, "status": "uploading"},
            {"_id": 0},
        )
        if existing:
            return {
                "upload_id": existing["upload_id"],
                "chunk_size": CHUNK_SIZE,
                "uploaded_chunks": len(existing.get("uploaded_indices") or []),
                "replayed": True,
            }

    upload_id = f"BTU-{wallet_key_hash[:12]}" if wallet_key_hash else str(uuid.uuid4())[:12]
    chunk_dir = UPLOAD_DIR / "chunks" / upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    doc = {
        "upload_id": upload_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "filename": Path(req.filename).name,
        "total_size": int(req.total_size),
        "total_chunks": int(req.total_chunks),
        "uploaded_chunks": 0,
        "uploaded_indices": [],
        "tier": tier,
        "price": price,
        "wallet_idempotency_key_hash": wallet_key_hash,
        "status": "uploading",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chunk_uploads.update_one(
        {"upload_id": upload_id, "user_id": user_id},
        {"$setOnInsert": doc},
        upsert=True,
    )

    return {"upload_id": upload_id, "chunk_size": CHUNK_SIZE, "uploaded_chunks": 0, "replayed": False}


# ── Chunked Upload: Upload Chunk ──
@router.post("/chunk/{upload_id}/{chunk_index}")
async def upload_chunk(upload_id: str, chunk_index: int, request: Request, chunk: UploadFile = File(...)):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    info = await db.chunk_uploads.find_one({"upload_id": upload_id, "user_id": user_id})
    if not info:
        raise HTTPException(404, "Upload nicht gefunden")
    if info.get("status") != "uploading":
        raise HTTPException(status_code=409, detail="Upload ist nicht mehr aktiv")
    if chunk_index < 0 or chunk_index >= int(info.get("total_chunks") or 0):
        raise HTTPException(status_code=400, detail="Ungültiger Chunk-Index")

    chunk_dir = UPLOAD_DIR / "chunks" / upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = chunk_dir / f"chunk_{chunk_index:06d}"

    content = await chunk.read(CHUNK_SIZE + 1)
    if len(content) > CHUNK_SIZE:
        raise HTTPException(status_code=413, detail="Chunk zu groß")

    if not chunk_path.exists():
        chunk_path.write_bytes(content)

    await db.chunk_uploads.update_one(
        {"upload_id": upload_id, "user_id": user_id},
        {
            "$addToSet": {"uploaded_indices": chunk_index},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )

    info = await db.chunk_uploads.find_one(
        {"upload_id": upload_id, "user_id": user_id},
        {"_id": 0, "uploaded_indices": 1, "total_chunks": 1},
    ) or {}
    uploaded_indices = info.get("uploaded_indices") or []
    uploaded_count = len(uploaded_indices)
    await db.chunk_uploads.update_one(
        {"upload_id": upload_id, "user_id": user_id},
        {"$set": {"uploaded_chunks": uploaded_count}},
    )
    done = uploaded_count == int(info.get("total_chunks") or 0)

    return {
        "ok": True,
        "chunk_index": chunk_index,
        "uploaded": uploaded_count,
        "total": int(info.get("total_chunks") or 0),
        "complete": done,
    }


# ── Chunked Upload: Finalize ──
class ChunkFinalizeRequest(BaseModel):
    upload_id: str
    title: str = ""
    message: str = ""
    recipient_email: str = ""
    expires_days: int = 7
    password: str = ""

@router.post("/chunk/finalize")
async def chunk_finalize(req: ChunkFinalizeRequest, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    info = await db.chunk_uploads.find_one({"upload_id": req.upload_id, "user_id": user_id})
    if not info:
        raise HTTPException(404, "Upload nicht gefunden")
    if info.get("status") == "completed" and info.get("transfer_id"):
        existing = await db.transfers.find_one({"transfer_id": info["transfer_id"], "sender_user_id": user_id}, {"_id": 0})
        if existing:
            return {
                "ok": True,
                "transfer_id": existing["transfer_id"],
                "download_code": existing["download_code"],
                "share_link": f"/blitz-transfer/{existing['transfer_id']}/{existing['download_code']}",
                "file_count": existing.get("file_count", 1),
                "total_size": existing.get("total_size_human", ""),
                "expires_at": existing.get("expires_at"),
                "expires_days": existing.get("expires_days"),
                "price_paid": existing.get("price_paid", 0),
                "replayed": True,
            }

    expected_chunks = int(info.get("total_chunks") or 0)
    uploaded_indices = set(info.get("uploaded_indices") or [])
    if uploaded_indices != set(range(expected_chunks)):
        raise HTTPException(status_code=409, detail="Upload unvollständig. Es fehlen Chunks.")

    tier = info.get("tier") if info.get("tier") in TRANSFER_TIERS else "free"
    tier_info = TRANSFER_TIERS[tier]
    price = float(tier_info["price"])
    wallet_key = None
    wallet_key_hash = info.get("wallet_idempotency_key_hash")
    if price > 0:
        wallet_key = _require_transfer_idempotency_key(request)
        if _transfer_key_hash(wallet_key) != wallet_key_hash:
            raise HTTPException(status_code=409, detail="Idempotency-Key passt nicht zu diesem Upload")

    chunk_dir = UPLOAD_DIR / "chunks" / req.upload_id
    for idx in range(expected_chunks):
        if not (chunk_dir / f"chunk_{idx:06d}").exists():
            raise HTTPException(status_code=409, detail=f"Chunk {idx} fehlt")

    transfer_id = f"BTF-{wallet_key_hash[:12]}" if wallet_key_hash else str(uuid.uuid4())[:12]
    download_code = secrets.token_urlsafe(16)
    transfer_dir = UPLOAD_DIR / transfer_id
    transfer_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(info['filename']).name}"
    final_path = transfer_dir / safe_name
    total_size = 0

    try:
        with open(final_path, "wb") as out:
            for idx in range(expected_chunks):
                cp = chunk_dir / f"chunk_{idx:06d}"
                data = cp.read_bytes()
                out.write(data)
                total_size += len(data)

        if total_size != int(info.get("total_size") or 0):
            raise HTTPException(
                status_code=409,
                detail=f"Dateigröße stimmt nicht überein ({human_size(total_size)} statt {human_size(int(info.get('total_size') or 0))}).",
            )
        if total_size > tier_info["max_bytes"]:
            raise HTTPException(status_code=400, detail="Datei überschreitet das gewählte Transfer-Paket")
    except Exception:
        import shutil
        if transfer_dir.exists():
            shutil.rmtree(transfer_dir)
        raise

    payment_result = None
    if price > 0:
        payment_result = await debit_wallet(
            user_id=user_id,
            amount=price,
            tx_type=TransactionType.PAYMENT,
            description=f"BlitzTransfer {tier_info['label']} — {human_size(total_size)}",
            reference=f"BTF-{wallet_key_hash[:12].upper()}",
            metadata={"kind": "blitz_transfer", "tier": tier, "transfer_id": transfer_id, "upload_id": req.upload_id},
            idempotency_key=wallet_key,
        )
        if not payment_result.success:
            import shutil
            if transfer_dir.exists():
                shutil.rmtree(transfer_dir)
            raise HTTPException(status_code=400, detail=payment_result.error or "Wallet-Zahlung fehlgeschlagen")

    now = datetime.now(timezone.utc)
    expires_days = min(max(1, req.expires_days), tier_info["max_days"])
    expires_at = now + timedelta(days=expires_days)
    ext = get_ext(info["filename"])
    pw_hash = hashlib.sha256(req.password.encode()).hexdigest() if req.password else None

    transfer = {
        "transfer_id": transfer_id,
        "download_code": download_code,
        "sender_user_id": user_id,
        "sender_email": user.get("email"),
        "sender_name": user.get("name", ""),
        "recipient_email": req.recipient_email,
        "title": req.title or f"Transfer von {user.get('name', user.get('email'))}",
        "message": req.message,
        "files": [{
            "original_name": Path(info["filename"]).name,
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
        "max_downloads": tier_info["max_downloads"],
        "password_hash": pw_hash,
        "tier": tier,
        "price_paid": price,
        "wallet_idempotency_key_hash": wallet_key_hash,
        "wallet_transaction_id": payment_result.transaction_id if payment_result else None,
        "payment_status": "paid" if payment_result else "free",
        "expires_at": expires_at.isoformat(),
        "expires_days": expires_days,
        "status": "active",
        "created_at": now.isoformat(),
    }

    try:
        if wallet_key_hash:
            await db.transfers.update_one(
                {"sender_user_id": user_id, "wallet_idempotency_key_hash": wallet_key_hash},
                {"$setOnInsert": transfer},
                upsert=True,
            )
        else:
            await db.transfers.insert_one(transfer)
            transfer.pop("_id", None)

        await db.chunk_uploads.update_one(
            {"upload_id": req.upload_id, "user_id": user_id},
            {"$set": {
                "status": "completed",
                "transfer_id": transfer_id,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    except Exception as exc:
        import shutil
        if transfer_dir.exists():
            shutil.rmtree(transfer_dir)

        if payment_result and payment_result.success:
            await db.blitz_transfer_payment_attempts.update_one(
                {"user_id": user_id, "idempotency_key_hash": wallet_key_hash},
                {"$set": {
                    "user_id": user_id,
                    "idempotency_key_hash": wallet_key_hash,
                    "transfer_id": transfer_id,
                    "status": "refund_pending",
                    "error": str(exc)[:500],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
            refund = await credit_wallet(
                user_id=user_id,
                amount=price,
                tx_type=TransactionType.REFUND,
                description="BlitzTransfer Rückbuchung",
                reference=f"BTF-REF-{wallet_key_hash[:10].upper()}",
                source="blitz_transfer_rollback",
                metadata={"transfer_id": transfer_id, "upload_id": req.upload_id},
                idempotency_key=f"blitz-transfer-refund:{wallet_key}",
            )
            await db.blitz_transfer_payment_attempts.update_one(
                {"user_id": user_id, "idempotency_key_hash": wallet_key_hash},
                {"$set": {
                    "status": "refunded" if refund.success else "reconciliation_required",
                    "refund_transaction_id": refund.transaction_id if refund.success else None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        raise HTTPException(status_code=500, detail="Transfer konnte nicht sicher finalisiert werden")

    import shutil
    if chunk_dir.exists():
        shutil.rmtree(chunk_dir)
    await db.chunk_uploads.delete_one({"upload_id": req.upload_id, "user_id": user_id})

    return {
        "ok": True,
        "transfer_id": transfer_id,
        "download_code": download_code,
        "share_link": f"/blitz-transfer/{transfer_id}/{download_code}",
        "file_count": 1,
        "total_size": human_size(total_size),
        "expires_at": expires_at.isoformat(),
        "expires_days": expires_days,
        "price_paid": price,
        "new_balance": payment_result.new_balance if payment_result else float(user.get("balance") or 0),
        "replayed": bool(payment_result.idempotent_replay) if payment_result else False,
        "message": f"Datei hochgeladen ({human_size(total_size)}). Link gueltig fuer {expires_days} Tage.",
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
