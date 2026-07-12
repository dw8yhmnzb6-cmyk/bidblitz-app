import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.audit import AuditEvent, get_client_info, log_audit
from core.database import db
from core.security import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/admin/legacy-restore", tags=["admin-legacy-restore"])

BACKUP_EXPORT_DIR = Path(__file__).resolve().parents[2] / "backup" / "db_export"
LEGACY_RESTORE_TEMP_PASSWORD = "BidBlitzRestore2026!"
ATTACK_KEYWORDS = {"bruteforce", "lockout", "iter", "invalid", "attack", "flood"}
TEST_KEYWORDS = {"test", "qa", "dummy", "seed", "sandbox", "demo", "staging", "mock"}
SYSTEM_KEYWORDS = {"admin", "noreply", "no-reply", "system", "support", "monitoring"}
SYNTHETIC_DOMAINS = {
    "example.com",
    "test.com",
    "mailinator.com",
    "tempmail.com",
    "aion.app",
}

CHILD_SIGNAL_CONFIG = [
    ("child_alerts.json", "child_id", "Kinder-Alarm", 14),
    ("kids_notifications.json", "child_id", "Kinder-Notification", 12),
    ("kids_tasks.json", "child_id", "Kinder-Aufgabe", 10),
    ("kids_location_history.json", "child_id", "Kinder-Standort", 12),
    ("kids_zones.json", "child_id", "Kinder-Zone", 10),
    ("app_rules.json", "child_id", "App-Regel", 8),
]
KNOWN_RESTORE_SEEDS = [
    {
        "candidate_key": "albinkrasniqi11@icloud.com",
        "display_name": "Albin Krasniqi",
        "primary_email": "albinkrasniqi11@icloud.com",
        "canonical_email": "albinkrasniqi11@icloud.com",
        "alias_emails": ["albinkrasniqi612@gmail.com"],
        "balance_eur": 60.0,
        "balance_blz": 20.0,
        "registered_at": "2026-05-02T14:33:00+00:00",
        "created_at": "2026-05-02T14:33:00+00:00",
        "evidence": [
            {
                "source": "wallet_screenshot",
                "label": "Screenshot IMG_2827",
                "detail": "Albin Krasniqi · 60 EUR · 20 BLZ · 0 Logins",
                "confidence": 98,
            },
            {
                "source": "audit_logs",
                "label": "Login-Spur",
                "detail": "Fehlgeschlagene Legacy-Logins für albinkrasniqi612@gmail.com ohne zuordenbaren User",
                "confidence": 82,
            },
            {
                "source": "backup_kids_children",
                "label": "Kinderkonto-Spur",
                "detail": "Backup enthält Albin als Child-Only Datensatz mit eigenem Guthaben",
                "confidence": 71,
            },
        ],
    },
    {
        "candidate_key": "lufrollen.notepad_9o@icloud.com",
        "display_name": "Afrim Krasniqi",
        "primary_email": "lufrollen.notepad_9o@icloud.com",
        "canonical_email": "lufrollen.notepad_9o@icloud.com",
        "alias_emails": ["laufrollen.notepad_9o@icloud.com"],
        "balance_eur": 25.2,
        "balance_blz": 10.0,
        "registered_at": "2026-05-01T19:58:00+00:00",
        "created_at": "2026-05-01T19:58:00+00:00",
        "evidence": [
            {
                "source": "wallet_screenshot",
                "label": "Screenshot IMG_2821",
                "detail": "Afrim Krasniqi · 25.20 EUR · 10 BLZ · 0 Logins",
                "confidence": 97,
            },
            {
                "source": "wallet_alias",
                "label": "Alias-Spur",
                "detail": "Alias laufrollen.notepad_9o@icloud.com verweist auf denselben Legacy-Account",
                "confidence": 84,
            },
        ],
    },
    {
        "candidate_key": "test-prod@bidblitz.com",
        "display_name": "Test GmbH",
        "primary_email": "test-prod@bidblitz.com",
        "canonical_email": "test-prod@bidblitz.com",
        "alias_emails": [],
        "balance_eur": 10.0,
        "balance_blz": 0.0,
        "registered_at": "2026-05-02T13:14:00+00:00",
        "created_at": "2026-05-02T13:14:00+00:00",
        "evidence": [
            {
                "source": "wallet_screenshot",
                "label": "Screenshot IMG_2832",
                "detail": "Test GmbH · test-prod@bidblitz.com · 10 EUR · 0 BLZ · 0 Logins",
                "confidence": 97,
            }
        ],
    },
    {
        "candidate_key": "aldinkrasniqi720@gmail.com",
        "display_name": "Aldin Krasniqi",
        "primary_email": "aldinkrasniqi720@gmail.com",
        "canonical_email": "aldinkrasniqi720@gmail.com",
        "alias_emails": [],
        "balance_eur": 510.0,
        "balance_blz": 35.0,
        "registered_at": "2026-04-22T19:13:00+00:00",
        "created_at": "2026-04-22T19:13:00+00:00",
        "evidence": [
            {
                "source": "wallet_screenshot",
                "label": "Screenshot IMG_2833",
                "detail": "Aldin Krasniqi · aldinkrasniqi720@gmail.com · 510 EUR · 35 BLZ · 0 Logins",
                "confidence": 98,
            }
        ],
    },
    {
        "candidate_key": "afrimfinaltest@icloud.com",
        "display_name": "Afrim Test Final",
        "primary_email": "afrimfinaltest@icloud.com",
        "canonical_email": "afrimfinaltest@icloud.com",
        "alias_emails": [],
        "balance_eur": 125.0,
        "balance_blz": 10.0,
        "registered_at": "2026-04-22T19:09:00+00:00",
        "created_at": "2026-04-22T19:09:00+00:00",
        "evidence": [
            {
                "source": "wallet_screenshot",
                "label": "Screenshot IMG_2833",
                "detail": "Afrim Test Final · afrimfinaltest@icloud.com · 125 EUR · 10 BLZ · 0 Logins",
                "confidence": 97,
            }
        ],
    },
]


class RestorePreviewRequest(BaseModel):
    candidate_key: str = Field(..., min_length=1)
    primary_email: str | None = None
    display_name: str | None = None
    alias_emails: list[str] = Field(default_factory=list)
    balance_eur: float | None = None
    balance_blz: float | None = None
    registered_at: str | None = None
    source_note: str | None = None


class RestoreConfirmRequest(RestorePreviewRequest):
    admin_password: str = Field(..., min_length=1)


class BulkRestorePreviewRequest(BaseModel):
    candidate_keys: list[str] = Field(default_factory=list)


class BulkRestoreConfirmRequest(BulkRestorePreviewRequest):
    admin_password: str = Field(..., min_length=1)


class ChildToUserPreviewRequest(BaseModel):
    candidate_key: str = Field(..., min_length=1)
    primary_email: str = Field(..., min_length=3)
    display_name: str | None = None
    alias_emails: list[str] = Field(default_factory=list)
    balance_eur: float | None = None
    balance_blz: float | None = None
    registered_at: str | None = None
    source_note: str | None = None


class ChildToUserConfirmRequest(ChildToUserPreviewRequest):
    admin_password: str = Field(..., min_length=1)


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value or 0)
    except Exception:
        return fallback


def _read_backup_json(filename: str) -> list[dict]:
    path = BACKUP_EXPORT_DIR / filename
    if not path.exists():
        return []
    try:
        raw = json.loads(path.read_text())
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def _normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _split_email(email: str) -> tuple[str, str]:
    normalized = _normalize_email(email)
    if "@" not in normalized:
        return normalized, ""
    local, domain = normalized.split("@", 1)
    return local, domain


def _contains_keyword(text: str, keywords: set[str]) -> bool:
    lowered = (text or "").lower()
    return any(keyword in lowered for keyword in keywords)


def _safe_excerpt(row: dict) -> str:
    for field in ["message", "title", "name", "address", "type", "event_type", "zone_type", "app_id"]:
        value = row.get(field)
        if isinstance(value, str) and value.strip():
            return value.strip()[:120]
    return "Zusätzliche Backup-Spur vorhanden"


def _deterministic_user_number(email: str) -> str:
    digest = hashlib.sha1(email.encode("utf-8")).hexdigest()
    return f"BE{int(digest[:8], 16) % 100000:05d}"


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


async def _verify_admin_password(admin: dict, password: str):
    admin_db = await db.users.find_one({"_id": admin["_id"]}, {"password_hash": 1, "password": 1})
    password_hash = ((admin_db or {}).get("password_hash") or (admin_db or {}).get("password") or "").strip()
    if not password_hash or not verify_password(password, password_hash):
        raise HTTPException(403, "Admin-Passwort ungültig.")


async def _find_existing_user_for_candidate(primary_email: str, alias_emails: list[str]):
    emails = [_normalize_email(primary_email)] + [_normalize_email(alias) for alias in alias_emails]
    emails = [email for email in emails if email]
    if not emails:
        return None
    return await db.users.find_one(
        {
            "$or": [
                {"email": {"$in": emails}},
                {"canonical_email": {"$in": emails}},
                {"email_aliases": {"$in": emails}},
            ]
        },
        {
            "_id": 1,
            "email": 1,
            "canonical_email": 1,
            "email_aliases": 1,
            "name": 1,
            "balance": 1,
            "balance_blz": 1,
            "registered_at": 1,
            "created_at": 1,
            "login_count": 1,
            "legacy_restored": 1,
            "legacy_restore_source": 1,
        },
    )


async def _build_failed_login_signals() -> list[dict]:
    rows = await db.audit_logs.find(
        {"event": "login_failed", "email": {"$exists": True, "$ne": ""}},
        {"_id": 0, "email": 1, "timestamp": 1, "details": 1, "user_id": 1},
    ).sort("timestamp", -1).limit(300).to_list(300)
    grouped: dict[str, dict] = {}
    for row in rows:
        email = _normalize_email(row.get("email"))
        if not email:
            continue
        signal = grouped.setdefault(email, {
            "candidate_key": email,
            "display_name": "",
            "primary_email": email,
            "canonical_email": email,
            "alias_emails": [],
            "balance_eur": 0.0,
            "balance_blz": 0.0,
            "registered_at": None,
            "created_at": None,
            "status": "missing",
            "restore_ready": False,
            "restore_hint": "Nur Login-Spur vorhanden – Name/Saldo fehlen noch.",
            "evidence": [],
            "failed_login_count": 0,
            "last_seen_at": None,
            "source_type": "failed_login_trace",
        })
        signal["failed_login_count"] += 1
        signal["last_seen_at"] = signal["last_seen_at"] or row.get("timestamp")
    existing_emails = set()
    existing_rows = await db.users.find({}, {"_id": 0, "email": 1, "canonical_email": 1, "email_aliases": 1}).to_list(2000)
    for row in existing_rows:
        if row.get("email"):
            existing_emails.add(_normalize_email(row.get("email")))
        if row.get("canonical_email"):
            existing_emails.add(_normalize_email(row.get("canonical_email")))
        for alias in row.get("email_aliases") or []:
            existing_emails.add(_normalize_email(alias))

    filtered = []
    for signal in grouped.values():
        if _normalize_email(signal.get("primary_email")) in existing_emails:
            continue
        signal["evidence"].append({
            "source": "audit_logs",
            "label": "Fehlgeschlagene Logins",
            "detail": f"{signal['failed_login_count']} Loginversuche ohne aktiven User-Datensatz",
            "confidence": 55,
        })
        filtered.append(signal)
    return filtered


def _build_child_only_signals() -> list[dict]:
    children = _read_backup_json("kids_children.json")
    enrichment_map: dict[str, list[dict]] = {}
    for filename, child_key, label, confidence in CHILD_SIGNAL_CONFIG:
        for row in _read_backup_json(filename):
            child_id = (row.get(child_key) or "").strip()
            if not child_id:
                continue
            enrichment_map.setdefault(child_id, []).append({
                "source": filename.replace(".json", ""),
                "label": label,
                "detail": _safe_excerpt(row),
                "confidence": confidence,
            })

    signals = []
    for child in children[:250]:
        name = (child.get("name") or "").strip()
        child_id = (child.get("child_id") or "").strip()
        if not name or not child_id:
            continue
        evidences = [{
            "source": "backup_kids_children",
            "label": "Backup Child Record",
            "detail": f"Child-ID {child_id} mit Balance {round(_safe_float(child.get('balance')), 2)} EUR",
            "confidence": 48,
        }]
        evidences.extend(enrichment_map.get(child_id, [])[:6])
        enrichment_count = len(evidences) - 1
        signals.append({
            "candidate_key": f"child:{child_id}",
            "display_name": name,
            "primary_email": "",
            "canonical_email": "",
            "alias_emails": [],
            "balance_eur": _safe_float(child.get("balance")),
            "balance_blz": _safe_float(child.get("balance_blz")),
            "registered_at": child.get("created_at") or child.get("registered_at"),
            "created_at": child.get("created_at") or child.get("registered_at"),
            "status": "needs_review",
            "restore_ready": False,
            "restore_hint": "Child-/Backup-Spur angereichert – E-Mail fehlt weiterhin." if enrichment_count else "Nur Child-/Backup-Spur vorhanden – E-Mail fehlt.",
            "evidence": evidences,
            "failed_login_count": 0,
            "last_seen_at": child.get("updated_at") or child.get("created_at") or child.get("registered_at"),
            "source_type": "child_backup_signal",
            "child_parent_id": child.get("parent_id") or "",
            "child_signal_count": enrichment_count,
        })
    return signals


def _priority_score(row: dict) -> int:
    score = 0
    if row.get("source_type") == "known_seed":
        score += 90
    if row.get("source_type") == "child_backup_signal":
        score += 35
    if row.get("primary_email"):
        score += 10
    if row.get("display_name"):
        score += 8
    if _safe_float(row.get("balance_eur")) > 0 or _safe_float(row.get("balance_blz")) > 0:
        score += 10
    score += min(12, len(row.get("evidence") or []) * 4)
    score += min(8, int(row.get("failed_login_count") or 0))
    if row.get("status") == "restored":
        score -= 15
    if row.get("status") == "needs_review":
        score -= 10
    return max(5, min(99, score))


def _priority_label(score: int) -> str:
    if score >= 88:
        return "Sehr sicher"
    if score >= 72:
        return "Sicher"
    if score >= 55:
        return "Prüfbar"
    return "Unsicher"


def _priority_rank(score: int) -> str:
    if score >= 88:
        return "P0"
    if score >= 72:
        return "P1"
    if score >= 55:
        return "P2"
    return "P3"


def _classify_candidate(row: dict) -> dict:
    email = _normalize_email(row.get("primary_email"))
    local, domain = _split_email(email)
    source_type = row.get("source_type") or ""
    has_balance_signal = _safe_float(row.get("balance_eur")) > 0 or _safe_float(row.get("balance_blz")) > 0
    has_name_signal = bool((row.get("display_name") or "").strip())

    if source_type == "known_seed":
        return {
            "candidate_category": "real_customer",
            "candidate_category_label": "Echter Kunde",
            "category_reason": "Wallet-/Screenshot-Beweis vorhanden.",
            "real_customer_candidate": True,
        }

    if source_type == "child_backup_signal":
        child_signal_count = int(row.get("child_signal_count") or 0)
        if child_signal_count >= 2:
            return {
                "candidate_category": "possible_real_customer",
                "candidate_category_label": "Möglicher Kunde",
                "category_reason": f"Child-Profil mit {child_signal_count} Zusatzspuren – wahrscheinlich echter Produktivfall, aber ohne Login-E-Mail.",
                "real_customer_candidate": True,
            }
        return {
            "candidate_category": "review_required",
            "candidate_category_label": "Review nötig",
            "category_reason": "Nur Child-/Backup-Spur – echte Person möglich, aber Login-Daten fehlen.",
            "real_customer_candidate": False,
        }

    combined = " ".join(filter(None, [local, domain, row.get("candidate_key", "")]))
    if domain in SYNTHETIC_DOMAINS or _contains_keyword(combined, ATTACK_KEYWORDS):
        return {
            "candidate_category": "attack_trace",
            "candidate_category_label": "Angriff/Lockout",
            "category_reason": "Technische Lockout-/Bruteforce-Spur, kein echter Kunde.",
            "real_customer_candidate": False,
        }

    if _contains_keyword(combined, TEST_KEYWORDS) or _contains_keyword(local, SYSTEM_KEYWORDS):
        return {
            "candidate_category": "synthetic_test",
            "candidate_category_label": "Test-/Systemspur",
            "category_reason": "Spricht eher für Test-, QA- oder Systemdaten.",
            "real_customer_candidate": False,
        }

    if email and has_name_signal and has_balance_signal:
        return {
            "candidate_category": "possible_real_customer",
            "candidate_category_label": "Möglicher Kunde",
            "category_reason": "E-Mail, Name und Guthaben sprechen für einen echten Produktivfall.",
            "real_customer_candidate": True,
        }

    if email and not _contains_keyword(combined, TEST_KEYWORDS | ATTACK_KEYWORDS):
        return {
            "candidate_category": "review_required",
            "candidate_category_label": "Review nötig",
            "category_reason": "Nicht eindeutig synthetisch, aber Beweislage noch zu schwach.",
            "real_customer_candidate": False,
        }

    return {
        "candidate_category": "synthetic_test",
        "candidate_category_label": "Test-/Systemspur",
        "category_reason": "Keine belastbare Kundenbeweislage vorhanden.",
        "real_customer_candidate": False,
    }


def _apply_view_filter(rows: list[dict], view: str) -> list[dict]:
    mode = (view or "real_only").strip().lower()
    if mode == "all":
        return rows
    if mode == "review":
        return [row for row in rows if row.get("candidate_category") == "review_required"]
    if mode == "noise_only":
        return [row for row in rows if row.get("candidate_category") in {"synthetic_test", "attack_trace"}]
    return [row for row in rows if row.get("candidate_category") in {"real_customer", "possible_real_customer"}]


async def _seed_candidate_with_state(seed: dict) -> dict:
    existing = await _find_existing_user_for_candidate(seed.get("primary_email", ""), seed.get("alias_emails", []))
    status = "restored" if existing else "missing"
    return {
        "candidate_key": seed["candidate_key"],
        "display_name": seed["display_name"],
        "primary_email": seed["primary_email"],
        "canonical_email": seed.get("canonical_email") or seed["primary_email"],
        "alias_emails": seed.get("alias_emails", []),
        "balance_eur": round(_safe_float(seed.get("balance_eur")), 2),
        "balance_blz": round(_safe_float(seed.get("balance_blz")), 2),
        "registered_at": seed.get("registered_at"),
        "created_at": seed.get("created_at") or seed.get("registered_at"),
        "status": status,
        "restore_ready": True,
        "restore_hint": "Screenshot + Alias + Backup-Spuren reichen für eine kontrollierte Wiederherstellung." if not existing else "Datensatz ist bereits wiederhergestellt.",
        "evidence": seed.get("evidence", []),
        "failed_login_count": 0,
        "last_seen_at": seed.get("registered_at"),
        "source_type": "known_seed",
        "existing_user": {
            "user_id": str(existing.get("_id")),
            "email": existing.get("email", ""),
            "canonical_email": existing.get("canonical_email") or existing.get("email", ""),
            "email_aliases": existing.get("email_aliases") or [],
            "name": existing.get("name", ""),
            "balance": round(_safe_float(existing.get("balance")), 2),
            "balance_blz": round(_safe_float(existing.get("balance_blz")), 2),
            "registered_at": existing.get("registered_at") or existing.get("created_at"),
            "login_count": int(existing.get("login_count", 0) or 0),
            "legacy_restored": bool(existing.get("legacy_restored")),
            "legacy_restore_source": existing.get("legacy_restore_source"),
        } if existing else None,
    }


def _merge_candidate_maps(*candidate_groups: list[dict]) -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for group in candidate_groups:
        for row in group:
            key = row["candidate_key"]
            if key not in merged:
                merged[key] = row
                continue
            merged[key]["evidence"] = (merged[key].get("evidence") or []) + (row.get("evidence") or [])
            merged[key]["failed_login_count"] = max(int(merged[key].get("failed_login_count", 0)), int(row.get("failed_login_count", 0)))
            merged[key]["last_seen_at"] = merged[key].get("last_seen_at") or row.get("last_seen_at")
    return merged


async def _build_candidates(query: str = "", view: str = "real_only") -> tuple[list[dict], dict]:
    seeds = [await _seed_candidate_with_state(seed) for seed in KNOWN_RESTORE_SEEDS]
    failed_login_candidates = await _build_failed_login_signals()
    child_only_candidates = _build_child_only_signals()
    merged = _merge_candidate_maps(seeds, failed_login_candidates, child_only_candidates)
    rows = []
    for row in merged.values():
        score = _priority_score(row)
        row["priority_score"] = score
        row["priority_label"] = _priority_label(score)
        row["priority_rank"] = _priority_rank(score)
        row.update(_classify_candidate(row))
        rows.append(row)
    rows.sort(key=lambda item: ({"missing": 0, "needs_review": 1, "restored": 2}.get(item.get("status", "restored"), 3), -int(item.get("priority_score") or 0), item.get("display_name") or item.get("primary_email") or item.get("candidate_key")))

    q = (query or "").strip().lower()
    if q:
        rows = [
            row for row in rows
            if q in (row.get("candidate_key", "").lower())
            or q in (row.get("display_name", "").lower())
            or q in (row.get("primary_email", "").lower())
            or any(q in alias.lower() for alias in (row.get("alias_emails") or []))
        ]

    full_rows = rows[:]
    rows = _apply_view_filter(rows, view)

    summary = {
        "total_candidates": len(full_rows),
        "visible_candidates": len(rows),
        "hidden_candidates": max(0, len(full_rows) - len(rows)),
        "missing_candidates": sum(1 for row in rows if row.get("status") == "missing"),
        "needs_review_candidates": sum(1 for row in rows if row.get("status") == "needs_review"),
        "restored_candidates": sum(1 for row in rows if row.get("status") == "restored"),
        "ready_to_restore": sum(1 for row in rows if row.get("status") == "missing" and row.get("restore_ready")),
        "failed_login_signals": sum(1 for row in full_rows if row.get("source_type") == "failed_login_trace"),
        "child_only_signals": sum(1 for row in full_rows if row.get("source_type") == "child_backup_signal"),
        "real_customer_candidates": sum(1 for row in full_rows if row.get("candidate_category") in {"real_customer", "possible_real_customer"}),
        "review_candidates": sum(1 for row in full_rows if row.get("candidate_category") == "review_required"),
        "synthetic_candidates": sum(1 for row in full_rows if row.get("candidate_category") == "synthetic_test"),
        "attack_candidates": sum(1 for row in full_rows if row.get("candidate_category") == "attack_trace"),
        "enriched_review_candidates": sum(1 for row in full_rows if int(row.get("child_signal_count") or 0) > 0),
        "view_mode": (view or "real_only").strip().lower(),
        "top_candidates": [
            {
                "candidate_key": row.get("candidate_key"),
                "display_name": row.get("display_name") or row.get("primary_email") or row.get("candidate_key"),
                "primary_email": row.get("primary_email"),
                "priority_score": row.get("priority_score"),
                "priority_label": row.get("priority_label"),
                "priority_rank": row.get("priority_rank"),
                "status": row.get("status"),
                "source_type": row.get("source_type"),
                "candidate_category": row.get("candidate_category"),
            }
            for row in full_rows
            if row.get("source_type") == "known_seed"
        ][:8],
        "top_missing_candidates": [
            {
                "candidate_key": row.get("candidate_key"),
                "display_name": row.get("display_name") or row.get("primary_email") or row.get("candidate_key"),
                "primary_email": row.get("primary_email"),
                "priority_score": row.get("priority_score"),
                "priority_label": row.get("priority_label"),
                "priority_rank": row.get("priority_rank"),
                "status": row.get("status"),
                "source_type": row.get("source_type"),
                "candidate_category": row.get("candidate_category"),
            }
            for row in rows
            if row.get("status") != "restored"
        ][:8],
        "last_scan_at": datetime.now(timezone.utc).isoformat(),
    }
    return rows, summary


async def _record_restore_action(action: dict):
    await db.legacy_restore_actions.insert_one(action)


async def _build_bulk_preview(candidate_keys: list[str]):
    seen = set()
    restoreable = []
    blocked = []
    for candidate_key in candidate_keys:
        key = (candidate_key or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        preview = await _build_preview_payload(RestorePreviewRequest(candidate_key=key))
        if preview.get("restore_ready"):
            restoreable.append(preview)
        else:
            blocked.append({
                "candidate_key": key,
                "reason": "existiert_bereits" if preview.get("existing_user") else "weitere_daten_noetig",
                "existing_user": preview.get("existing_user"),
                "missing_fields": preview.get("missing_fields") or [],
            })
    return {
        "restoreable": restoreable,
        "blocked": blocked,
        "summary": {
            "selected": len(seen),
            "restoreable": len(restoreable),
            "blocked": len(blocked),
        },
    }


async def _build_preview_payload(payload: RestorePreviewRequest) -> dict:
    seeds_map = {seed["candidate_key"]: seed for seed in KNOWN_RESTORE_SEEDS}
    seed = seeds_map.get(payload.candidate_key, {})
    primary_email = _normalize_email(payload.primary_email or seed.get("primary_email") or payload.candidate_key)
    alias_emails = []
    for alias in (payload.alias_emails or seed.get("alias_emails") or []):
        normalized = _normalize_email(alias)
        if normalized and normalized != primary_email and normalized not in alias_emails:
            alias_emails.append(normalized)
    display_name = (payload.display_name or seed.get("display_name") or "").strip()
    registered_at = payload.registered_at or seed.get("registered_at") or datetime.now(timezone.utc).isoformat()
    balance_eur = round(_safe_float(payload.balance_eur if payload.balance_eur is not None else seed.get("balance_eur")), 2)
    balance_blz = round(_safe_float(payload.balance_blz if payload.balance_blz is not None else seed.get("balance_blz")), 2)
    existing = await _find_existing_user_for_candidate(primary_email, alias_emails)
    missing_fields = []
    if not primary_email:
        missing_fields.append("primary_email")
    if not display_name:
        missing_fields.append("display_name")

    return {
        "candidate_key": payload.candidate_key,
        "primary_email": primary_email,
        "canonical_email": primary_email,
        "alias_emails": alias_emails,
        "display_name": display_name,
        "balance_eur": balance_eur,
        "balance_blz": balance_blz,
        "registered_at": registered_at,
        "existing_user": {
            "user_id": str(existing.get("_id")),
            "email": existing.get("email", ""),
            "name": existing.get("name", ""),
            "legacy_restored": bool(existing.get("legacy_restored")),
        } if existing else None,
        "restore_ready": not missing_fields and existing is None,
        "missing_fields": missing_fields,
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
        "source_note": payload.source_note or seed.get("candidate_key") or payload.candidate_key,
    }


async def _build_child_to_user_preview(payload: ChildToUserPreviewRequest) -> dict:
    rows, _summary = await _build_candidates("", "all")
    candidate = next((row for row in rows if row.get("candidate_key") == payload.candidate_key), None)
    if not candidate:
        raise HTTPException(404, "Child-/Review-Kandidat nicht gefunden.")

    primary_email = _normalize_email(payload.primary_email)
    alias_emails = []
    for alias in payload.alias_emails or []:
        normalized = _normalize_email(alias)
        if normalized and normalized != primary_email and normalized not in alias_emails:
            alias_emails.append(normalized)
    display_name = (payload.display_name or candidate.get("display_name") or "").strip()
    registered_at = payload.registered_at or candidate.get("registered_at") or datetime.now(timezone.utc).isoformat()
    balance_eur = round(_safe_float(payload.balance_eur if payload.balance_eur is not None else candidate.get("balance_eur")), 2)
    balance_blz = round(_safe_float(payload.balance_blz if payload.balance_blz is not None else candidate.get("balance_blz")), 2)
    existing = await _find_existing_user_for_candidate(primary_email, alias_emails)
    missing_fields = []
    if not primary_email:
        missing_fields.append("primary_email")
    if not display_name:
        missing_fields.append("display_name")

    can_restore = bool(candidate.get("candidate_category") == "possible_real_customer" and not missing_fields and existing is None)
    return {
        "candidate_key": payload.candidate_key,
        "primary_email": primary_email,
        "canonical_email": primary_email,
        "alias_emails": alias_emails,
        "display_name": display_name,
        "balance_eur": balance_eur,
        "balance_blz": balance_blz,
        "registered_at": registered_at,
        "existing_user": {
            "user_id": str(existing.get("_id")),
            "email": existing.get("email", ""),
            "name": existing.get("name", ""),
            "legacy_restored": bool(existing.get("legacy_restored")),
        } if existing else None,
        "restore_ready": can_restore,
        "missing_fields": missing_fields,
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
        "source_note": payload.source_note or f"child_to_user:{payload.candidate_key}",
        "child_signal_count": int(candidate.get("child_signal_count") or 0),
        "candidate_category": candidate.get("candidate_category"),
        "category_reason": candidate.get("category_reason"),
    }


async def _create_restored_user(preview: dict):
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "email": preview["primary_email"],
        "canonical_email": preview["canonical_email"],
        "email_aliases": preview.get("alias_emails") or [],
        "password_hash": hash_password(LEGACY_RESTORE_TEMP_PASSWORD),
        "name": preview["display_name"],
        "full_name": preview["display_name"],
        "display_name": preview["display_name"],
        "username": preview["display_name"],
        "role": "user",
        "balance": preview["balance_eur"],
        "balance_blz": preview["balance_blz"],
        "currency": "EUR",
        "created_at": preview["registered_at"],
        "registered_at": preview["registered_at"],
        "last_login_at": None,
        "last_login_ip": "",
        "last_login_user_agent": "",
        "login_count": 0,
        "language": "de",
        "notifications_enabled": True,
        "email_notifications": True,
        "biometric_enabled": False,
        "dark_mode": True,
        "kyc_status": "not_started",
        "kyc_verified": False,
        "user_number": _deterministic_user_number(preview["primary_email"]),
        "legacy_restored": True,
        "legacy_restore_source": preview.get("source_note") or preview["candidate_key"],
        "legacy_restore_note": "Restored via Admin Legacy Restore Center.",
        "legacy_restored_at": now,
        "temporary_password_assigned_at": now,
    }
    result = await db.users.insert_one(user_doc)
    return str(result.inserted_id), user_doc


@router.get("/overview")
async def legacy_restore_overview(request: Request, q: str = "", view: str = "real_only"):
    await _require_admin(request)
    rows, summary = await _build_candidates(q, view)
    history = await db.legacy_restore_actions.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"summary": summary, "candidates": rows[:120], "history": history}


@router.get("/candidates/{candidate_key:path}")
async def legacy_restore_candidate_detail(candidate_key: str, request: Request):
    await _require_admin(request)
    rows, _summary = await _build_candidates("", "all")
    for row in rows:
        if row.get("candidate_key") == candidate_key:
            actions = await db.legacy_restore_actions.find(
                {"candidate_key": candidate_key}, {"_id": 0}
            ).sort("created_at", -1).limit(20).to_list(20)
            return {"candidate": row, "actions": actions}
    raise HTTPException(404, "Legacy-Kandidat nicht gefunden.")


@router.post("/preview")
async def legacy_restore_preview(req: RestorePreviewRequest, request: Request):
    await _require_admin(request)
    preview = await _build_preview_payload(req)
    return {
        "preview": preview,
        "message": "Restore-Vorschau erstellt." if preview["restore_ready"] else "Weitere Felder nötig, bevor wiederhergestellt werden kann.",
    }


@router.post("/confirm")
async def legacy_restore_confirm(req: RestoreConfirmRequest, request: Request):
    admin = await _require_admin(request)
    await _verify_admin_password(admin, req.admin_password)
    preview = await _build_preview_payload(req)
    if preview.get("existing_user"):
        raise HTTPException(409, "Für diesen Kandidaten existiert bereits ein aktiver User-Datensatz.")
    if not preview.get("restore_ready"):
        raise HTTPException(400, f"Restore noch nicht möglich. Fehlende Felder: {', '.join(preview.get('missing_fields') or [])}")

    user_id, user_doc = await _create_restored_user(preview)
    created_at = datetime.now(timezone.utc).isoformat()
    action = {
        "candidate_key": req.candidate_key,
        "action_type": "restore_user",
        "status": "completed",
        "created_at": created_at,
        "approved_by": admin.get("email", ""),
        "restored_user_id": user_id,
        "restored_email": user_doc["email"],
        "restored_aliases": user_doc.get("email_aliases") or [],
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
        "source_note": preview.get("source_note") or req.candidate_key,
    }
    await _record_restore_action(action)
    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin["_id"]),
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "action": "legacy_restore_confirmed",
            "candidate_key": req.candidate_key,
            "restored_user_id": user_id,
            "restored_email": user_doc["email"],
        },
        severity="warn",
    )
    return {
        "ok": True,
        "restored_user": {
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "balance": user_doc["balance"],
            "balance_blz": user_doc["balance_blz"],
            "registered_at": user_doc["registered_at"],
            "legacy_restored": True,
        },
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
    }


@router.post("/bulk-preview")
async def legacy_restore_bulk_preview(req: BulkRestorePreviewRequest, request: Request):
    await _require_admin(request)
    payload = await _build_bulk_preview(req.candidate_keys)
    return payload


@router.post("/bulk-confirm")
async def legacy_restore_bulk_confirm(req: BulkRestoreConfirmRequest, request: Request):
    admin = await _require_admin(request)
    await _verify_admin_password(admin, req.admin_password)
    preview = await _build_bulk_preview(req.candidate_keys)
    restored_users = []
    for item in preview["restoreable"]:
        user_id, user_doc = await _create_restored_user(item)
        action = {
            "candidate_key": item["candidate_key"],
            "action_type": "bulk_restore_user",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": admin.get("email", ""),
            "restored_user_id": user_id,
            "restored_email": user_doc["email"],
            "restored_aliases": user_doc.get("email_aliases") or [],
            "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
            "source_note": item.get("source_note") or item["candidate_key"],
        }
        await _record_restore_action(action)
        restored_users.append({
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "balance": user_doc["balance"],
            "balance_blz": user_doc["balance_blz"],
            "registered_at": user_doc["registered_at"],
        })

    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin["_id"]),
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "action": "legacy_restore_bulk_confirmed",
            "candidate_keys": req.candidate_keys,
            "restored_count": len(restored_users),
        },
        severity="warn",
    )
    return {
        "ok": True,
        "restored_users": restored_users,
        "blocked": preview["blocked"],
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
        "summary": {
            "requested": len(req.candidate_keys),
            "restored": len(restored_users),
            "blocked": len(preview["blocked"]),
        },
    }


@router.get("/history")
async def legacy_restore_history(request: Request, limit: int = 40):
    await _require_admin(request)
    cap = min(max(limit, 1), 200)
    rows = await db.legacy_restore_actions.find({}, {"_id": 0}).sort("created_at", -1).limit(cap).to_list(cap)
    return {"actions": rows, "count": len(rows)}


@router.post("/review-enrichment")
async def legacy_restore_review_enrichment(request: Request):
    await _require_admin(request)
    review_rows, review_summary = await _build_candidates("", "review")
    all_rows, _all_summary = await _build_candidates("", "all")
    enriched = [
        {
            "candidate_key": row.get("candidate_key"),
            "display_name": row.get("display_name") or row.get("candidate_key"),
            "child_signal_count": int(row.get("child_signal_count") or 0),
            "priority_score": row.get("priority_score"),
            "candidate_category": row.get("candidate_category"),
            "category_reason": row.get("category_reason"),
        }
        for row in all_rows
        if int(row.get("child_signal_count") or 0) > 0
    ]
    return {
        "summary": {
            "review_visible": review_summary.get("visible_candidates", 0),
            "enriched_review_candidates": review_summary.get("enriched_review_candidates", 0),
            "upgrade_ready_candidates": sum(1 for row in enriched if row.get("candidate_category") == "possible_real_customer"),
            "last_scan_at": datetime.now(timezone.utc).isoformat(),
        },
        "candidates": enriched,
    }


@router.post("/child-to-user/preview")
async def child_to_user_preview(req: ChildToUserPreviewRequest, request: Request):
    await _require_admin(request)
    preview = await _build_child_to_user_preview(req)
    return {
        "preview": preview,
        "message": "Child→User Vorschau erstellt." if preview.get("restore_ready") else "Weitere Angaben erforderlich oder Kandidat noch nicht stark genug.",
    }


@router.post("/child-to-user/confirm")
async def child_to_user_confirm(req: ChildToUserConfirmRequest, request: Request):
    admin = await _require_admin(request)
    await _verify_admin_password(admin, req.admin_password)
    preview = await _build_child_to_user_preview(req)
    if preview.get("existing_user"):
        raise HTTPException(409, "Für diese E-Mail existiert bereits ein aktiver User-Datensatz.")
    if not preview.get("restore_ready"):
        raise HTTPException(400, f"Child→User Restore noch nicht möglich. Fehlende Felder: {', '.join(preview.get('missing_fields') or [])}")

    user_id, user_doc = await _create_restored_user(preview)
    created_at = datetime.now(timezone.utc).isoformat()
    action = {
        "candidate_key": req.candidate_key,
        "action_type": "child_to_user_restore",
        "status": "completed",
        "created_at": created_at,
        "approved_by": admin.get("email", ""),
        "restored_user_id": user_id,
        "restored_email": user_doc["email"],
        "restored_aliases": user_doc.get("email_aliases") or [],
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
        "source_note": preview.get("source_note") or req.candidate_key,
        "child_signal_count": preview.get("child_signal_count", 0),
    }
    await _record_restore_action(action)
    ip, ua = get_client_info(request)
    await log_audit(
        AuditEvent.ADMIN_ACTION,
        user_id=str(admin["_id"]),
        email=admin.get("email", ""),
        ip=ip,
        user_agent=ua,
        details={
            "action": "child_to_user_confirmed",
            "candidate_key": req.candidate_key,
            "restored_user_id": user_id,
            "restored_email": user_doc["email"],
            "child_signal_count": preview.get("child_signal_count", 0),
        },
        severity="warn",
    )
    return {
        "ok": True,
        "restored_user": {
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "balance": user_doc["balance"],
            "balance_blz": user_doc["balance_blz"],
            "registered_at": user_doc["registered_at"],
            "legacy_restored": True,
        },
        "temporary_password": LEGACY_RESTORE_TEMP_PASSWORD,
    }