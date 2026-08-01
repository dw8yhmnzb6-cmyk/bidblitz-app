from __future__ import annotations

import asyncio
import csv
import io
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field

from core.database import db
from core.investor_portal_auth import (
    clear_investor_auth_cookies,
    create_investor_access_token,
    create_investor_refresh_token,
    get_current_investor_account,
    get_current_investor_refresh_payload,
    hash_password,
    serialize_investor_account,
    set_investor_auth_cookies,
    verify_password,
)
from core.rate_limit import RATE_ADMIN_ACTION, RATE_LOGIN, RATE_REGISTER, limiter
from core.security import get_current_user

router = APIRouter(prefix="/api/investor-portal", tags=["investor-portal"])

STATUS_CHOICES = [
    "new",
    "review_pending",
    "documents_shared",
    "call_scheduled",
    "identification_required",
    "contract_preparation",
    "waitlist",
    "rejected",
    "completed",
]

_setup_lock = asyncio.Lock()
_setup_done = False


class InvestorPortalRegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=80)
    last_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(..., min_length=5, max_length=40)
    company: str = Field(default="", max_length=120)
    investor_type: Literal["private", "strategic"] = "private"
    password: str = Field(..., min_length=8, max_length=120)
    locale: str = Field(default="de", max_length=12)


class InvestorPortalLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=120)


class InvestorPortalProfileUpdateRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=80)
    last_name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=5, max_length=40)
    company: str = Field(default="", max_length=120)
    locale: str = Field(default="de", max_length=12)


class InvestorQuestionCreateRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=160)
    message: str = Field(..., min_length=5, max_length=3000)


class InvestorQuestionReplyRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=2000)


class InvestorMeetingRequestCreate(BaseModel):
    preferred_date: str = Field(..., min_length=5, max_length=80)
    meeting_mode: Literal["video", "phone", "onsite"] = "video"
    note: str = Field(default="", max_length=2000)


class AdminLeadStatusRequest(BaseModel):
    status: Literal[
        "new",
        "review_pending",
        "documents_shared",
        "call_scheduled",
        "identification_required",
        "contract_preparation",
        "waitlist",
        "rejected",
        "completed",
    ]
    note: str = Field(default="", max_length=1200)


class AdminDocumentUpsertRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=180)
    summary: str = Field(default="", max_length=500)
    category: str = Field(default="general", max_length=80)
    version: str = Field(default="v1.0", max_length=32)
    download_url: str = Field(default="", max_length=500)
    requires_acknowledgement: bool = False
    is_active: bool = True
    audience_statuses: list[str] = Field(default_factory=lambda: ["new", "review_pending", "documents_shared", "call_scheduled", "identification_required", "contract_preparation", "waitlist", "completed"])


class AdminUpdateUpsertRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=180)
    summary: str = Field(default="", max_length=500)
    body: str = Field(..., min_length=5, max_length=5000)
    is_active: bool = True


class AdminMeetingUpsertRequest(BaseModel):
    meeting_title: str = Field(..., min_length=3, max_length=160)
    status: Literal["requested", "proposed", "confirmed", "completed", "cancelled"] = "proposed"
    scheduled_for: str = Field(..., min_length=3, max_length=120)
    meeting_mode: Literal["video", "phone", "onsite"] = "video"
    meeting_link: str = Field(default="", max_length=500)
    note: str = Field(default="", max_length=2000)


class AdminMessageRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=160)
    message: str = Field(..., min_length=5, max_length=3000)


async def _ensure_setup():
    global _setup_done
    if _setup_done:
        return
    async with _setup_lock:
        if _setup_done:
            return
        await db.investor_accounts.create_index("email", unique=True)
        await db.investor_accounts.create_index("account_id", unique=True)
        await db.investor_documents.create_index("document_id", unique=True)
        await db.investor_updates.create_index("update_id", unique=True)
        await db.investor_questions.create_index("question_id", unique=True)
        await db.investor_meetings.create_index("meeting_id", unique=True)
        await db.investor_admin_audit_logs.create_index("created_at")
        await db.investor_portal_login_attempts.create_index("identifier", unique=True)
        _setup_done = True


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def _require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


async def _write_audit(actor_type: str, actor_id: str, action: str, entity_type: str, entity_id: str, details: Optional[dict] = None):
    await db.investor_admin_audit_logs.insert_one({
        "log_id": f"IAL-{uuid4().hex[:12].upper()}",
        "actor_type": actor_type,
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": _now_iso(),
    })


def _safe_doc(doc: dict) -> dict:
    if not doc:
        return {}
    return {k: v for k, v in doc.items() if k != "_id" and k != "password_hash"}


async def _get_login_attempt(identifier: str) -> dict:
    return await db.investor_portal_login_attempts.find_one({"identifier": identifier}, {"_id": 0}) or {}


async def _assert_login_allowed(identifier: str):
    attempt = await _get_login_attempt(identifier)
    locked_until = attempt.get("locked_until")
    if locked_until and locked_until > _now_iso():
        raise HTTPException(status_code=429, detail="Zu viele Fehlversuche. Bitte später erneut versuchen.")


async def _record_login_failure(identifier: str):
    now = datetime.now(timezone.utc)
    next_count = int((await _get_login_attempt(identifier)).get("failed_attempts", 0)) + 1
    payload = {"failed_attempts": next_count, "last_failed_at": now.isoformat()}
    if next_count >= 5:
        payload["locked_until"] = (now + timedelta(minutes=15)).isoformat()
    await db.investor_portal_login_attempts.update_one({"identifier": identifier}, {"$set": payload}, upsert=True)


async def _clear_login_failures(identifier: str):
    await db.investor_portal_login_attempts.delete_one({"identifier": identifier})


def _status_label(status: str) -> str:
    labels = {
        "new": "Neu registriert",
        "review_pending": "Unterlagen werden geprüft",
        "documents_shared": "Unterlagen freigegeben",
        "call_scheduled": "Gespräch geplant",
        "identification_required": "Identifikation erforderlich",
        "contract_preparation": "Vertrag wird vorbereitet",
        "waitlist": "Warteliste",
        "rejected": "Abgelehnt",
        "completed": "Abgeschlossen",
    }
    return labels.get(status, status)


@router.post("/auth/register")
@limiter.limit(RATE_REGISTER)
async def investor_register(request: Request, payload: InvestorPortalRegisterRequest, response: Response):
    await _ensure_setup()
    email = payload.email.strip().lower()
    existing = await db.investor_accounts.find_one({"email": email}, {"_id": 0, "account_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Für diese E-Mail existiert bereits ein Investor-Konto.")
    now_iso = _now_iso()
    lead = await db.investor_interest_leads.find_one({"email": email}, {"_id": 0, "lead_id": 1, "status": 1}, sort=[("created_at", -1)])
    account_id = f"IPA-{uuid4().hex[:12].upper()}"
    account_doc = {
        "account_id": account_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "phone": payload.phone.strip(),
        "company": payload.company.strip(),
        "investor_type": payload.investor_type,
        "status": (lead or {}).get("status") or "new",
        "locale": payload.locale,
        "lead_id": (lead or {}).get("lead_id", ""),
        "created_at": now_iso,
        "updated_at": now_iso,
        "last_login_at": now_iso,
    }
    await db.investor_accounts.insert_one(account_doc)
    access_token = create_investor_access_token(account_id, email)
    refresh_token = create_investor_refresh_token(account_id, email)
    set_investor_auth_cookies(response, access_token, refresh_token)
    await _write_audit("investor", account_id, "register", "investor_account", account_id, {"email": email})
    return {"success": True, "account": serialize_investor_account(account_doc)}


@router.post("/auth/login")
@limiter.limit(RATE_LOGIN)
async def investor_login(request: Request, payload: InvestorPortalLoginRequest, response: Response):
    await _ensure_setup()
    email = payload.email.strip().lower()
    identifier = f"{_client_ip(request)}:{email}"
    await _assert_login_allowed(identifier)
    account = await db.investor_accounts.find_one({"email": email})
    if not account or not verify_password(payload.password, account.get("password_hash", "")):
        await _record_login_failure(identifier)
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort ist nicht korrekt.")
    await _clear_login_failures(identifier)
    now_iso = _now_iso()
    await db.investor_accounts.update_one({"account_id": account["account_id"]}, {"$set": {"last_login_at": now_iso, "updated_at": now_iso}})
    account["last_login_at"] = now_iso
    access_token = create_investor_access_token(account["account_id"], email)
    refresh_token = create_investor_refresh_token(account["account_id"], email)
    set_investor_auth_cookies(response, access_token, refresh_token)
    return {"success": True, "account": serialize_investor_account(account)}


@router.post("/auth/logout")
async def investor_logout(response: Response):
    clear_investor_auth_cookies(response)
    return {"success": True}


@router.get("/auth/me")
async def investor_me(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    return {"authenticated": True, "account": serialize_investor_account(account)}


@router.post("/auth/refresh")
async def investor_refresh(request: Request, response: Response):
    await _ensure_setup()
    payload = await get_current_investor_refresh_payload(request)
    account = await db.investor_accounts.find_one({"account_id": payload.get("sub")})
    if not account:
        raise HTTPException(status_code=401, detail="Investor-Konto nicht gefunden")
    access_token = create_investor_access_token(account["account_id"], account["email"])
    refresh_token = create_investor_refresh_token(account["account_id"], account["email"])
    set_investor_auth_cookies(response, access_token, refresh_token)
    return {"success": True}


@router.get("/portal/dashboard")
async def investor_dashboard(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    account_id = account["account_id"]
    documents = await db.investor_documents.find({"is_active": True, "audience_statuses": {"$in": [account.get("status", "new")] }}, {"_id": 0}).sort("published_at", -1).to_list(20)
    updates = await db.investor_updates.find({"is_active": True}, {"_id": 0}).sort("published_at", -1).to_list(10)
    meetings = await db.investor_meetings.find({"account_id": account_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    questions = await db.investor_questions.find({"account_id": account_id}, {"_id": 0}).sort("updated_at", -1).to_list(10)
    acknowledgements = await db.investor_document_acknowledgements.find({"account_id": account_id}, {"_id": 0, "document_id": 1}).to_list(100)
    acknowledged_ids = {item.get("document_id") for item in acknowledgements}
    return {
        "account": serialize_investor_account(account),
        "status_label": _status_label(account.get("status", "new")),
        "documents_total": len(documents),
        "updates_total": len(updates),
        "meetings_total": len(meetings),
        "questions_total": len(questions),
        "documents_acknowledged": len([doc for doc in documents if doc.get("document_id") in acknowledged_ids]),
        "latest_documents": documents[:3],
        "latest_updates": updates[:3],
        "latest_meetings": meetings[:3],
        "latest_questions": questions[:3],
    }


@router.get("/portal/documents")
async def investor_documents(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    account_id = account["account_id"]
    documents = await db.investor_documents.find({"is_active": True, "audience_statuses": {"$in": [account.get("status", "new")] }}, {"_id": 0}).sort([("published_at", -1), ("title", 1)]).to_list(200)
    acknowledgements = await db.investor_document_acknowledgements.find({"account_id": account_id}, {"_id": 0, "document_id": 1}).to_list(200)
    ack_ids = {entry.get("document_id") for entry in acknowledgements}
    return {"documents": [{**doc, "acknowledged": doc.get("document_id") in ack_ids} for doc in documents]}


@router.post("/portal/documents/{document_id}/acknowledge")
async def acknowledge_document(document_id: str, request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    document = await db.investor_documents.find_one({"document_id": document_id, "is_active": True}, {"_id": 0, "document_id": 1, "title": 1})
    if not document:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    await db.investor_document_acknowledgements.update_one(
        {"account_id": account["account_id"], "document_id": document_id},
        {"$set": {"account_id": account["account_id"], "document_id": document_id, "acknowledged_at": _now_iso()}},
        upsert=True,
    )
    return {"success": True, "document_id": document_id}


@router.get("/portal/updates")
async def investor_updates(request: Request):
    await _ensure_setup()
    await get_current_investor_account(request)
    updates = await db.investor_updates.find({"is_active": True}, {"_id": 0}).sort("published_at", -1).to_list(200)
    return {"updates": updates}


@router.get("/portal/questions")
async def investor_questions(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    questions = await db.investor_questions.find({"account_id": account["account_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return {"questions": questions}


@router.post("/portal/questions")
async def create_investor_question(request: Request, payload: InvestorQuestionCreateRequest):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    now_iso = _now_iso()
    question = {
        "question_id": f"IQ-{uuid4().hex[:12].upper()}",
        "account_id": account["account_id"],
        "subject": payload.subject.strip(),
        "status": "open",
        "messages": [{"author_type": "investor", "message": payload.message.strip(), "created_at": now_iso}],
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.investor_questions.insert_one(question)
    return {"success": True, "question": question}


@router.post("/portal/questions/{question_id}/reply")
async def reply_investor_question(question_id: str, request: Request, payload: InvestorQuestionReplyRequest):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    question = await db.investor_questions.find_one({"question_id": question_id, "account_id": account["account_id"]}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Nachricht nicht gefunden")
    message = {"author_type": "investor", "message": payload.message.strip(), "created_at": _now_iso()}
    await db.investor_questions.update_one({"question_id": question_id}, {"$push": {"messages": message}, "$set": {"updated_at": message["created_at"], "status": "open"}})
    question.setdefault("messages", []).append(message)
    question["updated_at"] = message["created_at"]
    question["status"] = "open"
    return {"success": True, "question": question}


@router.get("/portal/meetings")
async def investor_meetings(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    meetings = await db.investor_meetings.find({"account_id": account["account_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return {"meetings": meetings}


@router.post("/portal/meetings/request")
async def create_investor_meeting_request(request: Request, payload: InvestorMeetingRequestCreate):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    now_iso = _now_iso()
    meeting = {
        "meeting_id": f"IM-{uuid4().hex[:12].upper()}",
        "account_id": account["account_id"],
        "meeting_title": "Investor Gespräch",
        "preferred_date": payload.preferred_date.strip(),
        "scheduled_for": payload.preferred_date.strip(),
        "meeting_mode": payload.meeting_mode,
        "meeting_link": "",
        "status": "requested",
        "note": payload.note.strip(),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.investor_meetings.insert_one(meeting)
    return {"success": True, "meeting": meeting}


@router.get("/portal/profile")
async def investor_profile(request: Request):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    return {"account": serialize_investor_account(account)}


@router.patch("/portal/profile")
async def update_investor_profile(request: Request, payload: InvestorPortalProfileUpdateRequest):
    await _ensure_setup()
    account = await get_current_investor_account(request)
    update_payload = {
        "first_name": payload.first_name.strip(),
        "last_name": payload.last_name.strip(),
        "phone": payload.phone.strip(),
        "company": payload.company.strip(),
        "locale": payload.locale,
        "updated_at": _now_iso(),
    }
    await db.investor_accounts.update_one({"account_id": account["account_id"]}, {"$set": update_payload})
    account.update(update_payload)
    return {"success": True, "account": serialize_investor_account(account)}


@router.get("/admin/leads")
async def admin_investor_leads(request: Request):
    await _ensure_setup()
    await _require_admin(request)
    leads = await db.investor_accounts.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"leads": [{**lead, "status_label": _status_label(lead.get("status", "new"))} for lead in leads], "status_choices": STATUS_CHOICES}


@router.get("/admin/leads/export")
async def admin_investor_leads_export(request: Request):
    await _ensure_setup()
    await _require_admin(request)
    leads = await db.investor_accounts.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=["account_id", "email", "first_name", "last_name", "phone", "company", "investor_type", "status", "created_at", "last_login_at"])
    writer.writeheader()
    for row in leads:
        writer.writerow({key: row.get(key, "") for key in writer.fieldnames})
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=investor-leads.csv"})


@router.patch("/admin/leads/{account_id}/status")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_update_lead_status(account_id: str, request: Request, payload: AdminLeadStatusRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    updated_at = _now_iso()
    result = await db.investor_accounts.update_one({"account_id": account_id}, {"$set": {"status": payload.status, "updated_at": updated_at, "admin_note": payload.note.strip()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Investor-Konto nicht gefunden")
    await _write_audit("admin", str(admin.get("_id")), "status_update", "investor_account", account_id, {"status": payload.status, "note": payload.note})
    return {"success": True}


@router.post("/admin/leads/{account_id}/message")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_message_lead(account_id: str, request: Request, payload: AdminMessageRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    account = await db.investor_accounts.find_one({"account_id": account_id}, {"_id": 0, "account_id": 1})
    if not account:
        raise HTTPException(status_code=404, detail="Investor-Konto nicht gefunden")
    now_iso = _now_iso()
    question = {
        "question_id": f"IQ-{uuid4().hex[:12].upper()}",
        "account_id": account_id,
        "subject": payload.subject.strip(),
        "status": "answered",
        "messages": [{"author_type": "admin", "message": payload.message.strip(), "created_at": now_iso}],
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.investor_questions.insert_one(question)
    await _write_audit("admin", str(admin.get("_id")), "message_create", "investor_question", question["question_id"], {"account_id": account_id})
    return {"success": True, "question": question}


@router.get("/admin/documents")
async def admin_get_documents(request: Request):
    await _ensure_setup()
    await _require_admin(request)
    docs = await db.investor_documents.find({}, {"_id": 0}).sort("published_at", -1).to_list(500)
    return {"documents": docs}


@router.post("/admin/documents")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_create_document(request: Request, payload: AdminDocumentUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    now_iso = _now_iso()
    document = payload.model_dump()
    document.update({
        "document_id": f"IDOC-{uuid4().hex[:12].upper()}",
        "published_at": now_iso,
        "created_at": now_iso,
        "updated_at": now_iso,
    })
    await db.investor_documents.insert_one(document)
    await _write_audit("admin", str(admin.get("_id")), "document_create", "investor_document", document["document_id"], {"title": document["title"]})
    return {"success": True, "document": document}


@router.patch("/admin/documents/{document_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_update_document(document_id: str, request: Request, payload: AdminDocumentUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    update_doc = payload.model_dump()
    update_doc["updated_at"] = _now_iso()
    result = await db.investor_documents.update_one({"document_id": document_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    await _write_audit("admin", str(admin.get("_id")), "document_update", "investor_document", document_id, {"title": update_doc["title"]})
    return {"success": True}


@router.get("/admin/updates")
async def admin_get_updates(request: Request):
    await _ensure_setup()
    await _require_admin(request)
    updates = await db.investor_updates.find({}, {"_id": 0}).sort("published_at", -1).to_list(500)
    return {"updates": updates}


@router.post("/admin/updates")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_create_update(request: Request, payload: AdminUpdateUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    now_iso = _now_iso()
    update_doc = payload.model_dump()
    update_doc.update({"update_id": f"IUP-{uuid4().hex[:12].upper()}", "published_at": now_iso, "created_at": now_iso, "updated_at": now_iso})
    await db.investor_updates.insert_one(update_doc)
    await _write_audit("admin", str(admin.get("_id")), "update_create", "investor_update", update_doc["update_id"], {"title": update_doc["title"]})
    return {"success": True, "update": update_doc}


@router.patch("/admin/updates/{update_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_update_update(update_id: str, request: Request, payload: AdminUpdateUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    update_doc = payload.model_dump()
    update_doc["updated_at"] = _now_iso()
    result = await db.investor_updates.update_one({"update_id": update_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Update nicht gefunden")
    await _write_audit("admin", str(admin.get("_id")), "update_edit", "investor_update", update_id, {"title": update_doc["title"]})
    return {"success": True}


@router.get("/admin/meetings")
async def admin_get_meetings(request: Request):
    await _ensure_setup()
    await _require_admin(request)
    meetings = await db.investor_meetings.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return {"meetings": meetings}


@router.post("/admin/meetings/{account_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_create_meeting(account_id: str, request: Request, payload: AdminMeetingUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    account = await db.investor_accounts.find_one({"account_id": account_id}, {"_id": 0, "account_id": 1})
    if not account:
        raise HTTPException(status_code=404, detail="Investor-Konto nicht gefunden")
    now_iso = _now_iso()
    meeting = payload.model_dump()
    meeting.update({"meeting_id": f"IM-{uuid4().hex[:12].upper()}", "account_id": account_id, "created_at": now_iso, "updated_at": now_iso})
    await db.investor_meetings.insert_one(meeting)
    await _write_audit("admin", str(admin.get("_id")), "meeting_create", "investor_meeting", meeting["meeting_id"], {"account_id": account_id})
    return {"success": True, "meeting": meeting}


@router.patch("/admin/meetings/{meeting_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def admin_update_meeting(meeting_id: str, request: Request, payload: AdminMeetingUpsertRequest):
    await _ensure_setup()
    admin = await _require_admin(request)
    update_doc = payload.model_dump()
    update_doc["updated_at"] = _now_iso()
    result = await db.investor_meetings.update_one({"meeting_id": meeting_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meeting nicht gefunden")
    await _write_audit("admin", str(admin.get("_id")), "meeting_update", "investor_meeting", meeting_id, {"status": payload.status})
    return {"success": True}
