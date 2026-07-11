from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user
from routes.auctions import (
    ACTIVE_AUCTION_CATALOG,
    TARGET_ACTIVE_AUCTIONS,
    _build_auction_doc,
    DRONE_GALLERY,
    EBIKE_GALLERY,
    ESCOOTER_GALLERY,
    LAPTOP_GALLERY,
    MONITOR_GALLERY,
    ROBOT_GALLERY,
    SMARTPHONE_GALLERY,
    TABLET_GALLERY,
    VR_GALLERY,
)
from routes.monitoring import MONITORED_FLOWS, _run_probe, _store_probe_results

load_dotenv()

router = APIRouter(prefix="/api/admin/ai-assistant", tags=["admin-ai-assistant"])

CATEGORY_IMAGE_POOLS = {
    "phones": SMARTPHONE_GALLERY,
    "laptops": LAPTOP_GALLERY,
    "tablets": TABLET_GALLERY,
    "gaming": MONITOR_GALLERY,
    "xr": VR_GALLERY,
    "tech": DRONE_GALLERY,
    "mobility": EBIKE_GALLERY,
    "robots": ROBOT_GALLERY,
}

CATEGORY_ALIASES = {
    "phone": "phones",
    "smartphone": "phones",
    "handy": "phones",
    "laptop": "laptops",
    "notebook": "laptops",
    "tablet": "tablets",
    "konsole": "gaming",
    "gaming": "gaming",
    "vr": "xr",
    "ar": "xr",
    "drohne": "tech",
    "drone": "tech",
    "tech": "tech",
    "ebike": "mobility",
    "e-bike": "mobility",
    "escooter": "mobility",
    "e-scooter": "mobility",
    "scooter": "mobility",
    "robot": "robots",
    "roboter": "robots",
}

SUPPORTED_OPERATIONS = {
    "auction_reseed_current_catalog",
    "auction_replace_with_items",
    "auction_create_items",
    "auction_delete_by_title",
    "auction_update_by_title",
    "monitoring_run_probes",
    "unsupported_request",
}


class AdminAssistantPlanRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=4000)
    conversation_id: str = ""


class AdminAssistantConfirmRequest(BaseModel):
    action_id: str


def _normalize_category(raw: str) -> str:
    key = (raw or "tech").strip().lower()
    if key in CATEGORY_IMAGE_POOLS:
        return key
    return CATEGORY_ALIASES.get(key, "tech")


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = (text or "").strip()
    fenced = re.search(r"```json\s*(.*?)\s*```", cleaned, flags=re.S)
    if fenced:
        cleaned = fenced.group(1).strip()

    decoder = json.JSONDecoder()
    for candidate in [cleaned, cleaned[cleaned.find("{"): cleaned.rfind("}") + 1] if "{" in cleaned and "}" in cleaned else cleaned]:
        candidate = (candidate or "").strip()
        if not candidate:
            continue
        try:
            obj, _end = decoder.raw_decode(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    brace_positions = [m.start() for m in re.finditer(r"\{", cleaned)]
    for start in brace_positions:
        depth = 0
        for idx in range(start, len(cleaned)):
            char = cleaned[idx]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    snippet = cleaned[start:idx + 1]
                    try:
                        data = json.loads(snippet)
                        if isinstance(data, dict):
                            return data
                    except Exception:
                        continue
    raise ValueError(f"Kein JSON in der KI-Antwort gefunden: {cleaned[:300]}")


def _gallery_for_category(category: str) -> list[str]:
    normalized = _normalize_category(category)
    return CATEGORY_IMAGE_POOLS.get(normalized, DRONE_GALLERY)


def _extract_count(message: str, default: int = 10, cap: int = 30) -> int:
    match = re.search(r"(\d{1,2})", message or "")
    if not match:
        return default
    return max(1, min(cap, int(match.group(1))))


def _extract_categories(message: str) -> list[str]:
    lowered = (message or "").lower()
    found = []
    for raw, normalized in CATEGORY_ALIASES.items():
        if raw in lowered and normalized not in found:
            found.append(normalized)
    for normalized in CATEGORY_IMAGE_POOLS.keys():
        if normalized in lowered and normalized not in found:
            found.append(normalized)
    return found or ["tech"]


def _build_generated_items(count: int, categories: list[str]) -> list[dict[str, Any]]:
    items = []
    templates = {
        "phones": [
            ("Ultra Smartphone", "Premium Smartphone mit Top-Kamera und AI-Features."),
            ("Pro Max Smartphone", "High-End Smartphone mit großem Display und Titanium-Look."),
        ],
        "laptops": [
            ("Creator Laptop", "Leistungsstarker Premium-Laptop für Business und Creator."),
            ("OLED Pro Laptop", "Premium Notebook mit OLED, AI und langer Akkulaufzeit."),
        ],
        "tablets": [
            ("Pro Tablet", "Leistungsstarkes Tablet für Arbeit, Entertainment und Mobility."),
        ],
        "gaming": [
            ("Gaming Monitor", "High-End Gaming Display mit Premium Setup-Faktor."),
            ("Next Gen Konsole", "Premium Gaming-Hardware für moderne Setups."),
        ],
        "xr": [
            ("XR Headset", "Premium XR-Headset für immersive Anwendungen und Entertainment."),
        ],
        "mobility": [
            ("E-Bike Pro", "Connected Mobility-Produkt mit Premium-Reichweite und App-Features."),
            ("E-Scooter Max", "Starker E-Scooter mit Reichweite, Power und Komfort."),
        ],
        "robots": [
            ("Robot Cleaner", "Premium-Roboter für modernes Smart Home und automatische Reinigung."),
        ],
        "tech": [
            ("Creator Drone", "Premium Drohne mit starker Kamera und Creator-Fokus."),
            ("Tech Flagship", "Hochwertiges Premium-Tech-Produkt für starke Auktionsconversion."),
        ],
    }

    base_year = 2026
    for idx in range(count):
        category = categories[idx % len(categories)]
        title_seed, desc_seed = templates.get(category, templates["tech"])[idx % len(templates.get(category, templates["tech"]))]
        items.append({
            "title": f"{title_seed} {base_year} #{idx + 1}",
            "description": desc_seed,
            "category": category,
            "retail_price": 1199 + ((idx % 6) * 120),
            "features": ["Premium", "2026", "Auktions-Ready"],
        })
    return items


def _heuristic_plan(message: str) -> Optional[dict[str, Any]]:
    lowered = (message or "").lower().strip()
    if not lowered:
        return None

    categories = _extract_categories(lowered)
    count = _extract_count(lowered, default=10)

    if any(token in lowered for token in ["prüf", "check", "status", "monitor", "fehler", "webseite", "login", "registrierung"]):
        return {
            "assistant_title": "System-Check Vorschlag",
            "assistant_message": "Ich werde die Kernbereiche prüfen und dir danach die Fehlerlage zeigen.",
            "requires_confirmation": True,
            "warnings": ["Es werden nur Prüfungen gestartet, nichts Kritisches verändert."],
            "operations": [{"type": "monitoring_run_probes", "reason": "Kern-Checks für Webseite, Login, Registrierung und Auktionen ausführen."}],
        }

    if any(token in lowered for token in ["lösch", "entfern", "ersetze", "alte auktion", "alte aktion"]) and any(token in lowered for token in ["neu", "neue", "erstell", "mach"]):
        return {
            "assistant_title": "Auktionen ersetzen",
            "assistant_message": f"Ich werde die bestehenden Auktionen entfernen und {count} neue Premium-Auktionen anlegen.",
            "requires_confirmation": True,
            "warnings": ["Bestehende Auktionen werden entfernt.", "Gebotsverläufe der entfernten Auktionen gehen verloren."],
            "operations": [{
                "type": "auction_replace_with_items",
                "reason": f"Kompletter Austausch des Auktionsbestands mit {count} neuen Premium-Auktionen.",
                "items": _build_generated_items(count, categories),
            }],
        }

    if any(token in lowered for token in ["mach", "erstell", "füge", "neue auktion", "neue aktion"]):
        return {
            "assistant_title": "Neue Auktionen erstellen",
            "assistant_message": f"Ich werde {count} neue Premium-Auktionen hinzufügen.",
            "requires_confirmation": True,
            "warnings": ["Ich füge neue Auktionen hinzu und lasse bestehende aktiv."],
            "operations": [{
                "type": "auction_create_items",
                "reason": f"{count} neue Premium-Auktionen auf Basis deiner Vorgabe erstellen.",
                "items": _build_generated_items(count, categories),
            }],
        }

    if any(token in lowered for token in ["katalog", "standard katalog", "reset auktion", "seed auktion"]):
        return {
            "assistant_title": "Standard-Katalog wiederherstellen",
            "assistant_message": "Ich stelle den aktuellen Premium-Tech-Standardkatalog wieder her.",
            "requires_confirmation": True,
            "warnings": ["Aktive Auktionen werden vollständig durch den Standardkatalog ersetzt."],
            "operations": [{"type": "auction_reseed_current_catalog", "reason": "Aktuellen Premium-Katalog neu aufsetzen."}],
        }

    return None


def _normalize_item(item: dict[str, Any]) -> dict[str, Any]:
    category = _normalize_category(str(item.get("category") or "tech"))
    gallery = _gallery_for_category(category)
    retail_price = float(item.get("retail_price") or 1299)
    retail_price = max(1001.0, min(2000.0, retail_price))
    title = str(item.get("title") or "Neue Premium-Auktion").strip()[:200]
    description = str(item.get("description") or f"Premium {category} Produkt für die neue Admin-Auktion.").strip()[:500]
    features = [str(x).strip()[:60] for x in (item.get("features") or []) if str(x).strip()][:4]
    return {
        "title": title,
        "description": description,
        "retail_price": round(retail_price, 2),
        "category": category,
        "image_url": gallery[0],
        "image_urls": gallery[:4],
        "features": features,
    }


async def _context_snapshot() -> dict[str, Any]:
    active_auctions = await db.auctions.find({"status": "active"}, {"_id": 0, "auction_id": 1, "title": 1, "category": 1, "current_price": 1}).limit(24).to_list(24)
    current_titles = [a.get("title", "") for a in active_auctions[:12]]
    return {
        "active_auction_count": len(active_auctions),
        "sample_active_auctions": current_titles,
        "catalog_count": len(ACTIVE_AUCTION_CATALOG),
        "supported_operations": sorted(SUPPORTED_OPERATIONS),
        "supported_categories": sorted(CATEGORY_IMAGE_POOLS.keys()),
        "default_rules": {
            "auction_starting_price": 0.01,
            "auction_duration_seconds": 604800,
            "retail_price_range": "1001-2000",
            "proposal_before_execution": True,
        },
    }


async def _generate_plan(message: str, conversation_id: str, history: list[dict[str, Any]]) -> dict[str, Any]:
    heuristic = _heuristic_plan(message)
    if heuristic:
        return heuristic

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY fehlt")

    context = await _context_snapshot()
    system_message = f"""
Du bist der BidBlitz Admin KI Assistent für Armend.
Du verstehst natürliche deutsche Admin-Befehle und antwortest IMMER mit validem JSON.
Du führst NIEMALS direkt etwas aus. Du machst immer zuerst einen sicheren Vorschlag.

Unterstützte Operationen:
- auction_reseed_current_catalog
- auction_replace_with_items
- auction_create_items
- auction_delete_by_title
- auction_update_by_title
- monitoring_run_probes
- unsupported_request

Regeln:
- Antworte komplett auf Deutsch.
- Wenn der Nutzer etwas Gefährliches will (löschen/ersetzen), setze requires_confirmation=true.
- Für Auktionen nutze nur retail_price zwischen 1001 und 2000.
- Neue Auktionen sollen als Premium-Tech-Auktionen gedacht sein, wenn der Nutzer nichts anderes sagt.
- Wenn etwas außerhalb der Unterstützung liegt, gib unsupported_request zurück und erkläre kurz was später gebraucht wird.
- Ausgabeformat exakt als JSON-Objekt:
{{
  "assistant_title": "Kurzer Titel",
  "assistant_message": "Kurze Erklärung für Armend",
  "requires_confirmation": true,
  "warnings": ["..."],
  "operations": [
    {{
      "type": "auction_create_items",
      "reason": "Warum",
      "items": [{{"title":"...","description":"...","category":"tech","retail_price":1499,"features":["..."]}}],
      "match_titles": ["optional"],
      "updates": {{"title":"...","description":"...","retail_price":1499}}
    }}
  ]
}}

Aktueller Kontext:
{json.dumps(context, ensure_ascii=False)}

Letzter Verlauf:
{json.dumps(history[-8:], ensure_ascii=False)}
"""

    chat = LlmChat(
        api_key=api_key,
        session_id=conversation_id,
        system_message=system_message,
    ).with_model("openai", "gpt-5.2")

    full_text = ""
    async for event in chat.stream_message(UserMessage(text=message)):
        chunk = getattr(event, "content", None)
        if chunk:
            full_text += chunk

    try:
        parsed = _extract_json(full_text)
    except Exception:
        fallback = _heuristic_plan(message)
        if fallback:
            return fallback
        raise
    parsed.setdefault("assistant_title", "Vorschlag bereit")
    parsed.setdefault("assistant_message", "Ich habe einen Vorschlag vorbereitet.")
    parsed.setdefault("requires_confirmation", True)
    parsed.setdefault("warnings", [])
    parsed.setdefault("operations", [])

    safe_ops = []
    for op in parsed.get("operations", []):
        op_type = op.get("type")
        if op_type not in SUPPORTED_OPERATIONS:
            safe_ops.append({"type": "unsupported_request", "reason": f"Nicht unterstützte Operation: {op_type}"})
            continue
        if op_type in {"auction_replace_with_items", "auction_create_items"}:
            op["items"] = [_normalize_item(item) for item in (op.get("items") or [])][:30]
        if op_type in {"auction_delete_by_title", "auction_update_by_title"}:
            op["match_titles"] = [str(x).strip() for x in (op.get("match_titles") or []) if str(x).strip()][:20]
        if op_type == "auction_update_by_title":
            updates = op.get("updates") or {}
            if "retail_price" in updates:
                updates["retail_price"] = max(1001.0, min(2000.0, float(updates["retail_price"])))
            op["updates"] = updates
        safe_ops.append(op)

    parsed["operations"] = safe_ops
    return parsed


async def _execute_operation(op: dict[str, Any], admin_user_id: str) -> dict[str, Any]:
    op_type = op.get("type")
    now = datetime.now(timezone.utc)

    if op_type == "unsupported_request":
        return {"type": op_type, "ok": False, "message": op.get("reason") or "Noch nicht automatisch ausführbar."}

    if op_type == "monitoring_run_probes":
        results = []
        for flow in MONITORED_FLOWS:
            results.append(await _run_probe(flow))
        await _store_probe_results(results)
        return {"type": op_type, "ok": True, "checked": len(results), "critical": len([r for r in results if r["status"] == "critical"])}

    if op_type == "auction_reseed_current_catalog":
        await db.auctions.delete_many({})
        await db.auction_bids.delete_many({})
        await db.auction_notifications.delete_many({})
        await db.watchlist.delete_many({})
        await db.auto_bids.delete_many({})
        created = []
        for index, product in enumerate(ACTIVE_AUCTION_CATALOG[:TARGET_ACTIVE_AUCTIONS]):
            auction = _build_auction_doc(product, admin_user_id, now, index)
            await db.auctions.insert_one(auction)
            created.append({"auction_id": auction["auction_id"], "title": auction["title"]})
        return {"type": op_type, "ok": True, "created": len(created), "sample_titles": [c["title"] for c in created[:8]]}

    if op_type == "auction_replace_with_items":
        items = [_normalize_item(item) for item in (op.get("items") or [])][:30]
        await db.auctions.delete_many({})
        await db.auction_bids.delete_many({})
        await db.auction_notifications.delete_many({})
        await db.watchlist.delete_many({})
        await db.auto_bids.delete_many({})
        created = []
        for index, product in enumerate(items):
            auction = _build_auction_doc(product, admin_user_id, now, index)
            await db.auctions.insert_one(auction)
            created.append({"auction_id": auction["auction_id"], "title": auction["title"]})
        return {"type": op_type, "ok": True, "created": len(created), "sample_titles": [c["title"] for c in created[:8]]}

    if op_type == "auction_create_items":
        items = [_normalize_item(item) for item in (op.get("items") or [])][:30]
        created = []
        current_active = await db.auctions.count_documents({"status": "active"})
        for offset, product in enumerate(items):
            auction = _build_auction_doc(product, admin_user_id, now, current_active + offset)
            await db.auctions.insert_one(auction)
            created.append({"auction_id": auction["auction_id"], "title": auction["title"]})
        return {"type": op_type, "ok": True, "created": len(created), "sample_titles": [c["title"] for c in created[:8]]}

    if op_type == "auction_delete_by_title":
        titles = [str(x).strip() for x in (op.get("match_titles") or []) if str(x).strip()]
        deleted_titles = []
        for title in titles:
            auctions = await db.auctions.find({"title": title}, {"_id": 0, "auction_id": 1, "title": 1}).to_list(50)
            for auction in auctions:
                await db.auction_bids.delete_many({"auction_id": auction["auction_id"]})
                await db.auction_notifications.delete_many({"auction_id": auction["auction_id"]})
                await db.watchlist.delete_many({"auction_id": auction["auction_id"]})
                await db.auto_bids.delete_many({"auction_id": auction["auction_id"]})
                await db.auctions.delete_one({"auction_id": auction["auction_id"]})
                deleted_titles.append(auction["title"])
        return {"type": op_type, "ok": True, "deleted": len(deleted_titles), "titles": deleted_titles[:20]}

    if op_type == "auction_update_by_title":
        titles = [str(x).strip() for x in (op.get("match_titles") or []) if str(x).strip()]
        updates = op.get("updates") or {}
        normalized_updates = {}
        if updates.get("title"):
            normalized_updates["title"] = str(updates["title"]).strip()[:200]
        if updates.get("description") is not None:
            normalized_updates["description"] = str(updates["description"]).strip()[:500]
        if updates.get("retail_price") is not None:
            normalized_updates["retail_price"] = round(max(1001.0, min(2000.0, float(updates["retail_price"]))), 2)
        normalized_updates["updated_at"] = now.isoformat()
        updated = 0
        for title in titles:
            res = await db.auctions.update_many({"title": title}, {"$set": normalized_updates})
            updated += res.modified_count
        return {"type": op_type, "ok": True, "updated": updated, "fields": list(normalized_updates.keys())}

    return {"type": op_type, "ok": False, "message": "Unbekannte Operation."}


@router.post("/plan")
async def create_plan(req: AdminAssistantPlanRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    conversation_id = req.conversation_id or f"admin-ai-{secrets.token_hex(6)}"
    history = await db.admin_ai_messages.find(
        {"conversation_id": conversation_id, "user_id": str(user["_id"])} ,
        {"_id": 0, "role": 1, "content": 1, "created_at": 1}
    ).sort("created_at", 1).limit(20).to_list(20)

    plan = await _generate_plan(req.message, conversation_id, history)
    action_id = secrets.token_hex(10)
    now = datetime.now(timezone.utc).isoformat()

    await db.admin_ai_messages.insert_many([
        {"conversation_id": conversation_id, "user_id": str(user["_id"]), "role": "user", "content": req.message, "created_at": now},
        {
            "conversation_id": conversation_id,
            "user_id": str(user["_id"]),
            "role": "assistant",
            "content": plan.get("assistant_message", ""),
            "created_at": now,
            "plan_action_id": action_id,
            "plan": plan,
        },
    ])
    await db.admin_ai_actions.insert_one({
        "action_id": action_id,
        "conversation_id": conversation_id,
        "user_id": str(user["_id"]),
        "status": "proposed",
        "original_message": req.message,
        "plan": plan,
        "created_at": now,
    })
    return {"conversation_id": conversation_id, "action_id": action_id, "plan": plan}


@router.post("/confirm")
async def confirm_plan(req: AdminAssistantConfirmRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    action = await db.admin_ai_actions.find_one({"action_id": req.action_id, "user_id": str(user["_id"])}, {"_id": 0})
    if not action:
        raise HTTPException(status_code=404, detail="Aktion nicht gefunden")
    if action.get("status") != "proposed":
        raise HTTPException(status_code=400, detail="Aktion wurde bereits verarbeitet")

    results = []
    for op in action.get("plan", {}).get("operations", []):
        results.append(await _execute_operation(op, str(user["_id"])))

    executed_at = datetime.now(timezone.utc).isoformat()
    await db.admin_ai_actions.update_one(
        {"action_id": req.action_id},
        {"$set": {"status": "executed", "results": results, "executed_at": executed_at}},
    )
    await db.admin_ai_messages.insert_one({
        "conversation_id": action["conversation_id"],
        "user_id": str(user["_id"]),
        "role": "assistant",
        "content": "Ausführung abgeschlossen.",
        "created_at": executed_at,
        "execution_results": results,
    })
    return {"ok": True, "results": results, "conversation_id": action["conversation_id"]}


@router.get("/history")
async def get_history(request: Request, conversation_id: str = ""):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id fehlt")
    messages = await db.admin_ai_messages.find(
        {"conversation_id": conversation_id, "user_id": str(user["_id"])},
        {"_id": 0},
    ).sort("created_at", 1).limit(100).to_list(100)

    plan_ids = [msg.get("plan_action_id") for msg in messages if msg.get("plan_action_id") and not msg.get("plan")]
    if plan_ids:
        actions = await db.admin_ai_actions.find({"action_id": {"$in": plan_ids}}, {"_id": 0, "action_id": 1, "plan": 1, "results": 1, "status": 1}).to_list(100)
        action_map = {action["action_id"]: action for action in actions}
        for msg in messages:
            action_id = msg.get("plan_action_id")
            action = action_map.get(action_id)
            if action and not msg.get("plan"):
                if action.get("status") == "proposed":
                    msg["plan"] = action.get("plan")
                if action.get("results"):
                    msg["execution_results"] = action.get("results")

    return {"messages": messages, "conversation_id": conversation_id}
