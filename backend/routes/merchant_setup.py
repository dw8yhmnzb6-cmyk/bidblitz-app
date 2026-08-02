from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.feature_flags import PRESETS, service as feature_service
from core.security import get_current_user

router = APIRouter(prefix="/api/merchant-setup", tags=["merchant-setup"])

STEP_ORDER = ["geschaeft", "branche", "produkte", "zahlungen", "geraete", "mitarbeiter", "fertig"]
PRESET_MAP = {
    "Einzelhandel": "retail",
    "Café / Eiscafé": "cafe_eiscafe",
    "Restaurant": "restaurant",
    "Fast Food": "fast_food",
    "Telefonzubehör": "phone_accessories",
    "Supermarkt": "supermarket",
    "Friseur": "hairdresser",
    "Dienstleistung": "service_business",
    "Schwimmbad / Freizeit": "swimming_pool",
    "Sonstiges": "minimal_v1",
}


class MerchantSetupStatePayload(BaseModel):
    current_step: str | None = None
    onboarding_percentage: int | None = Field(default=None, ge=0, le=100)
    business_info: dict[str, Any] | None = None
    business_type: str | None = None
    product_setup: dict[str, Any] | None = None
    payment_methods: dict[str, Any] | None = None
    devices: dict[str, Any] | None = None
    staff_setup: dict[str, Any] | None = None
    completed_steps: list[str] | None = None
    activation_status: str | None = None


class HardwareTestPayload(BaseModel):
    device_key: str
    device_type: str
    test_action: str


class TestSalePayload(BaseModel):
    product_name: str
    amount: float = Field(gt=0)
    payment_method: str


async def _require_merchant_owner(request: Request):
    user = await get_current_user(request)
    merchant = await db.pos_merchants.find_one({"owner_id": str(user["_id"])}, {"_id": 0})
    if user.get("role") == "admin" and not merchant:
        merchant = await db.pos_merchants.find_one({}, {"_id": 0})
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant setup noch nicht gestartet")
    return user, merchant


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _calculate_percentage(completed_steps: list[str]) -> int:
    if not completed_steps:
        return 0
    unique_steps = {step for step in completed_steps if step in STEP_ORDER}
    return round((len(unique_steps) / len(STEP_ORDER)) * 100)


@router.get("/presets")
async def get_setup_presets():
    return {
        "presets": [
            {"label": label, "key": key, "feature_preset": PRESETS.get(key, {})}
            for label, key in PRESET_MAP.items()
        ]
    }


@router.get("/state")
async def get_setup_state(request: Request):
    user, merchant = await _require_merchant_owner(request)
    progress = await db.merchant_setup_progress.find_one({"merchant_id": merchant["merchant_id"]}, {"_id": 0}) or {}
    stores = await db.pos_stores.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    registers = await db.pos_registers.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0, "api_key": 0}).sort("created_at", -1).to_list(20)
    staff = await db.pos_staff.find({"merchant_id": merchant["merchant_id"], "active": True}, {"_id": 0}).to_list(100)
    products = await db.pos_products.find({"merchant_id": merchant["merchant_id"], "active": True}, {"_id": 0}).to_list(200)
    tests = await db.onboarding_test_sales.find({"merchant_id": merchant["merchant_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {
        "merchant": merchant,
        "progress": {
            "merchant_id": merchant["merchant_id"],
            "current_step": progress.get("current_step", "geschaeft"),
            "completed_steps": progress.get("completed_steps", []),
            "onboarding_percentage": progress.get("onboarding_percentage", 0),
            "business_info": progress.get("business_info", {}),
            "business_type": progress.get("business_type"),
            "product_setup": progress.get("product_setup", {}),
            "payment_methods": progress.get("payment_methods", {}),
            "devices": progress.get("devices", {}),
            "staff_setup": progress.get("staff_setup", {}),
            "activation_status": progress.get("activation_status", "incomplete"),
            "updated_at": progress.get("updated_at"),
        },
        "stores": stores,
        "registers": registers,
        "staff": staff,
        "products": products,
        "test_sales": tests,
        "should_open_pos": bool(progress.get("activation_status") == "ready"),
        "viewer": {"id": str(user["_id"]), "email": user.get("email"), "role": user.get("role")},
    }


@router.put("/state")
async def save_setup_state(request: Request, payload: MerchantSetupStatePayload):
    user, merchant = await _require_merchant_owner(request)
    existing = await db.merchant_setup_progress.find_one({"merchant_id": merchant["merchant_id"]}, {"_id": 0}) or {}
    completed_steps = payload.completed_steps or existing.get("completed_steps", [])
    if payload.current_step and payload.current_step not in completed_steps and payload.current_step in STEP_ORDER[:-1]:
        completed_steps = list(dict.fromkeys([*completed_steps, payload.current_step]))
    percentage = payload.onboarding_percentage if payload.onboarding_percentage is not None else _calculate_percentage(completed_steps)
    merged = {
        "merchant_id": merchant["merchant_id"],
        "owner_id": merchant["owner_id"],
        "current_step": payload.current_step or existing.get("current_step") or "geschaeft",
        "completed_steps": completed_steps,
        "onboarding_percentage": percentage,
        "business_info": payload.business_info if payload.business_info is not None else existing.get("business_info", {}),
        "business_type": payload.business_type if payload.business_type is not None else existing.get("business_type"),
        "product_setup": payload.product_setup if payload.product_setup is not None else existing.get("product_setup", {}),
        "payment_methods": payload.payment_methods if payload.payment_methods is not None else existing.get("payment_methods", {}),
        "devices": payload.devices if payload.devices is not None else existing.get("devices", {}),
        "staff_setup": payload.staff_setup if payload.staff_setup is not None else existing.get("staff_setup", {}),
        "activation_status": payload.activation_status or existing.get("activation_status") or "incomplete",
        "updated_at": _now_iso(),
        "created_at": existing.get("created_at") or _now_iso(),
        "updated_by": user.get("email"),
    }
    await db.merchant_setup_progress.update_one({"merchant_id": merchant["merchant_id"]}, {"$set": merged}, upsert=True)
    return {"ok": True, "progress": merged}


@router.post("/apply-preset")
async def apply_business_preset(request: Request, payload: dict[str, str]):
    user, merchant = await _require_merchant_owner(request)
    business_type = payload.get("business_type") or "Sonstiges"
    preset_key = PRESET_MAP.get(business_type, "minimal_v1")
    await feature_service.apply_preset(preset_key, actor={"_id": str(user["_id"]), "role": user.get("role")}, ip=request.client.host if request.client else "")
    await db.merchant_setup_progress.update_one(
        {"merchant_id": merchant["merchant_id"]},
        {"$set": {"business_type": business_type, "feature_preset": preset_key, "updated_at": _now_iso(), "updated_by": user.get("email")}},
        upsert=True,
    )
    return {"ok": True, "business_type": business_type, "feature_preset": preset_key}


@router.post("/hardware-test")
async def hardware_test(request: Request, payload: HardwareTestPayload):
    user, merchant = await _require_merchant_owner(request)
    test_result = {
        "merchant_id": merchant["merchant_id"],
        "device_key": payload.device_key,
        "device_type": payload.device_type,
        "test_action": payload.test_action,
        "status": "not_connected",
        "message": "Kein bestätigter Hardware-Handshake in dieser Preview-Umgebung.",
        "tested_at": _now_iso(),
        "tested_by": user.get("email"),
    }
    await db.merchant_setup_progress.update_one(
        {"merchant_id": merchant["merchant_id"]},
        {"$set": {f"devices.{payload.device_key}": test_result, "updated_at": _now_iso(), "updated_by": user.get("email")}},
        upsert=True,
    )
    return {"ok": True, "result": test_result}


@router.post("/test-sale")
async def create_onboarding_test_sale(request: Request, payload: TestSalePayload):
    user, merchant = await _require_merchant_owner(request)
    doc = {
        "test_sale_id": f"TEST-{merchant['merchant_id']}-{int(datetime.now(timezone.utc).timestamp())}",
        "merchant_id": merchant["merchant_id"],
        "owner_id": merchant["owner_id"],
        "product_name": payload.product_name,
        "amount": round(payload.amount, 2),
        "payment_method": payload.payment_method,
        "label": "TESTZAHLUNG – KEIN ECHTES GELD",
        "status": "successful",
        "created_at": _now_iso(),
        "created_by": user.get("email"),
    }
    await db.onboarding_test_sales.insert_one(doc)
    await db.merchant_setup_progress.update_one(
        {"merchant_id": merchant["merchant_id"]},
        {"$set": {"test_sale_completed": True, "current_step": "fertig", "activation_status": "ready", "updated_at": _now_iso(), "updated_by": user.get("email")}, "$addToSet": {"completed_steps": "fertig"}},
        upsert=True,
    )
    return {"ok": True, "test_sale": doc}


@router.get("/admin/overview")
async def admin_onboarding_overview(request: Request):
    await _require_admin(request)
    rows = await db.merchant_setup_progress.find({}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    merchant_map = {row["merchant_id"]: row for row in await db.pos_merchants.find({}, {"_id": 0, "merchant_id": 1, "business_name": 1, "business_type": 1, "status": 1}).to_list(500)}
    enriched = []
    for row in rows:
        merchant = merchant_map.get(row["merchant_id"], {})
        staff_count = await db.pos_staff.count_documents({"merchant_id": row["merchant_id"], "active": True})
        enriched.append({
            "merchant_id": row["merchant_id"],
            "merchant": merchant.get("business_name") or row.get("business_info", {}).get("business_name") or row.get("business_info", {}).get("name") or row["merchant_id"],
            "onboarding_percentage": row.get("onboarding_percentage", 0),
            "current_step": row.get("current_step", "geschaeft"),
            "selected_business_type": row.get("business_type") or merchant.get("business_type"),
            "configured_devices": list((row.get("devices") or {}).keys()),
            "enabled_payment_methods": [key for key, value in (row.get("payment_methods") or {}).items() if value in {True, "enabled", "beta"}],
            "staff_count": staff_count,
            "test_sale_completed": bool(row.get("test_sale_completed", False)),
            "activation_status": row.get("activation_status", merchant.get("status", "incomplete")),
            "blockers": [] if row.get("activation_status") == "ready" else ["setup_incomplete"],
            "updated_at": row.get("updated_at"),
        })
    return {"rows": enriched}