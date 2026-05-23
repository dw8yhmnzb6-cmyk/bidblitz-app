"""Restaurant / Café table system with QR, service calls and printer slip API."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from core.database import db
from core.email import FRONTEND_URL
from core.security import get_current_user
from routes.pos_inventory import _record_movement
from routes.pos_hardware import _send_to_network_printer, _send_to_usb_printer

router = APIRouter(tags=["restaurant-table-system"])

TABLE_STATUS = {"free", "occupied", "order_open", "service_call", "bill_requested"}
ORDER_STATUS = {"new", "accepted", "preparing", "ready", "served", "paid", "closed"}
SERVICE_TYPES = {"service", "bill", "problem"}
SERVICE_STATUS = {"open", "accepted", "done"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(5)}"


def table_scan_code() -> str:
    return f"TBL-{secrets.token_hex(5).upper()}"


def normalize_table_status(raw: Optional[str], has_open_orders: bool = False, has_open_calls: bool = False, has_bill_call: bool = False) -> str:
    if has_bill_call:
        return "bill_requested"
    if has_open_calls:
        return "service_call"
    if has_open_orders:
        return "order_open"
    if raw in TABLE_STATUS:
        return raw
    if raw in {"available", None, ""}:
        return "free"
    if raw in {"occupied", "reserved"}:
        return "occupied"
    return "free"


def build_public_url(path: str, origin: str = "") -> str:
    base = (origin or FRONTEND_URL or "").rstrip("/")
    return f"{base}{path}" if base else path


async def resolve_store(store_id: Optional[str], user: dict | None = None) -> dict:
    queries: list[dict[str, Any]] = []
    if store_id:
        queries.append({"store_id": store_id})
    if user:
        if user.get("store_id"):
            queries.append({"store_id": user.get("store_id")})
        if user.get("merchant_id"):
            queries.append({"merchant_id": user.get("merchant_id")})
        queries.append({"owner_id": str(user.get("_id"))})
        if user.get("email"):
            queries.extend([
                {"owner_email": user.get("email")},
                {"email": user.get("email")},
                {"merchant_email": user.get("email")},
            ])
    for query in queries:
        store = await db.pos_stores.find_one(query, {"_id": 0})
        if store:
            return store
    if user and user.get("role") == "admin":
        first_store = await db.pos_stores.find({}, {"_id": 0}).sort("created_at", 1).limit(1).to_list(1)
        if first_store:
            return first_store[0]
    if not store_id:
        first_table = await db.pos_tables.find({"active": {"$ne": False}}, {"_id": 0, "store_id": 1}).sort("created_at", 1).limit(1).to_list(1)
        if first_table and first_table[0].get("store_id"):
            first_store = await db.pos_stores.find_one({"store_id": first_table[0]["store_id"]}, {"_id": 0})
            if first_store:
                return first_store
            return {"store_id": first_table[0]["store_id"], "merchant_id": first_table[0]["store_id"], "name": "Restaurant"}
    if store_id:
        return {"store_id": store_id, "merchant_id": store_id, "name": "Restaurant"}
    raise HTTPException(status_code=404, detail="Store nicht gefunden")


async def require_staff(request: Request, store_id: Optional[str] = None) -> tuple[dict, dict]:
    user = await get_current_user(request)
    store = await resolve_store(store_id, user)
    return user, store


async def get_table_doc(table_id: str) -> dict:
    table = await db.pos_tables.find_one({"table_id": table_id, "active": {"$ne": False}}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Tisch nicht gefunden")
    return table


def escpos_text(title: str, subtitle: str, lines: list[str]) -> bytes:
    esc = b"\x1b"
    gs = b"\x1d"
    parts = [esc + b"@", esc + b"a" + b"\x01"]
    parts.append(("-------------------------\n" + title + "\n" + subtitle + "\n").encode("utf-8"))
    parts.append(esc + b"a" + b"\x00")
    for line in lines:
        parts.append(f"{line}\n".encode("utf-8"))
    parts.append(("-------------------------\n").encode("utf-8"))
    parts.append(f"Zeit: {datetime.now().strftime('%H:%M')}\n".encode("utf-8"))
    parts.append(b"\n\n\n")
    parts.append(gs + b"V" + b"\x00")
    return b"".join(parts)


async def print_slip(store_id: str, slip_type: Literal["kitchen", "service", "bill"], title: str, lines: list[str]) -> dict:
    printer = await db.pos_printers.find_one(
        {
            "store_id": store_id,
            "$or": [{"role": slip_type}, {"printer_id": slip_type}, {"printer_id": "default"}],
        },
        {"_id": 0},
    )
    data = escpos_text(title, slip_type.upper(), lines)
    output_path = f"/tmp/{slip_type}_{secrets.token_hex(4)}.txt"
    try:
        if printer and printer.get("type") == "network":
            await _send_to_network_printer(printer["ip"], int(printer.get("port", 9100) or 9100), data)
        elif printer and printer.get("type") == "usb":
            await _send_to_usb_printer(printer["device"], data)
        else:
            with open(output_path, "wb") as handle:
                handle.write(data)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Druckfehler: {exc}")
    return {"ok": True, "slip_type": slip_type, "printer": (printer or {}).get("printer_id", "file"), "file": output_path}


async def create_live_event(store_id: str, event_type: str, message: str, payload: dict) -> None:
    await db.restaurant_live_events.insert_one({
        "event_id": make_id("evt"),
        "store_id": store_id,
        "event_type": event_type,
        "message": message,
        "payload": payload,
        "created_at": now_iso(),
    })


async def refresh_table_status(table_id: str) -> None:
    table = await db.pos_tables.find_one({"table_id": table_id}, {"_id": 0, "status": 1})
    if not table:
        return
    open_orders = await db.pos_guest_orders.count_documents({"table_id": table_id, "status": {"$in": ["new", "accepted", "preparing", "ready", "served"]}})
    open_calls = await db.pos_service_calls.count_documents({"table_id": table_id, "status": {"$in": ["open", "accepted"]}, "type": {"$ne": "bill"}})
    bill_calls = await db.pos_service_calls.count_documents({"table_id": table_id, "status": {"$in": ["open", "accepted"]}, "type": "bill"})
    status = normalize_table_status(table.get("status"), has_open_orders=open_orders > 0, has_open_calls=open_calls > 0, has_bill_call=bill_calls > 0)
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": {"status": status, "updated_at": now_iso()}})


async def serialize_table(table: dict, origin: str = "") -> dict:
    table_id = table.get("table_id")
    open_orders = await db.pos_guest_orders.count_documents({"table_id": table_id, "status": {"$in": ["new", "accepted", "preparing", "ready", "served"]}})
    open_calls = await db.pos_service_calls.count_documents({"table_id": table_id, "status": {"$in": ["open", "accepted"]}, "type": {"$ne": "bill"}})
    bill_calls = await db.pos_service_calls.count_documents({"table_id": table_id, "status": {"$in": ["open", "accepted"]}, "type": "bill"})
    last_order = await db.pos_guest_orders.find({"table_id": table_id}, {"_id": 0, "created_at": 1}).sort("created_at", -1).limit(1).to_list(1)
    qr_path = table.get("qr_code_url") or f"/table/{table_id}"
    return {
        "id": table_id,
        "table_id": table_id,
        "store_id": table.get("store_id"),
        "table_number": table.get("table_number") or table.get("number") or table.get("name") or table_id[-4:],
        "table_name": table.get("table_name") or table.get("name") or f"Tisch {table.get('table_number') or table_id[-4:]}",
        "area": table.get("area") or table.get("section") or "Gastraum",
        "button_id": table.get("button_id", ""),
        "x": int(table.get("x", 24) or 24),
        "y": int(table.get("y", 24) or 24),
        "qr_code_url": qr_path,
        "qr_code_absolute_url": build_public_url(qr_path, origin),
        "scan_code": table.get("scan_code") or table_scan_code(),
        "status": normalize_table_status(table.get("status"), has_open_orders=open_orders > 0, has_open_calls=open_calls > 0, has_bill_call=bill_calls > 0),
        "created_at": table.get("created_at"),
        "open_order_count": open_orders,
        "open_service_call_count": open_calls + bill_calls,
        "wait_started_at": (last_order[0] if last_order else {}).get("created_at") or table.get("updated_at") or table.get("created_at"),
    }


async def store_owner_email(store: dict) -> str:
    for field in ["merchant_email", "owner_email", "email", "contact_email"]:
        if store.get(field):
            return str(store.get(field)).strip().lower()
    if store.get("owner_id"):
        user = await db.users.find_one({"_id": store.get("owner_id")}, {"_id": 0, "email": 1})
        if user and user.get("email"):
            return str(user["email"]).strip().lower()
    if store.get("merchant_id"):
        user = await db.users.find_one({"merchant_id": store.get("merchant_id")}, {"_id": 0, "email": 1})
        if user and user.get("email"):
            return str(user["email"]).strip().lower()
    admin = await db.users.find_one({"role": {"$in": ["admin", "merchant"]}}, {"_id": 0, "email": 1})
    if admin and admin.get("email"):
        return str(admin["email"]).strip().lower()
    return ""


async def create_payment_link(table: dict, store: dict, origin: str = "", fallback_email: str = "") -> Optional[str]:
    orders = await db.pos_guest_orders.find(
        {"table_id": table["table_id"], "status": {"$in": ["new", "accepted", "preparing", "ready", "served"]}},
        {"_id": 0},
    ).to_list(200)
    if not orders:
        return None
    existing_link = next((order.get("payment_link") for order in orders if order.get("payment_link")), None)
    if existing_link:
        return existing_link
    merchant_email = await store_owner_email(store)
    if not merchant_email and fallback_email:
        merchant_email = fallback_email.strip().lower()
    if not merchant_email:
        return None
    items: list[dict[str, Any]] = []
    subtotal = 0.0
    for order in orders:
        for item in order.get("items", []):
            line_total = float(item.get("line_total") or item.get("unit_price") or 0) * float(item.get("quantity") or 1)
            subtotal += line_total
            items.append({
                "description": item.get("name", "Artikel"),
                "quantity": int(item.get("quantity") or 1),
                "unit_price": round(float(item.get("unit_price") or 0), 2),
                "total": round(line_total, 2),
            })
    tax = round(subtotal * 0.19, 2)
    total = round(subtotal + tax, 2)
    scan_code = f"BBINV-{secrets.token_hex(5).upper()}"
    invoice_id = make_id("inv")
    invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(3).upper()}"
    payment_url = build_public_url(f"/invoice/pay/{scan_code}", origin)
    await db.invoices.insert_one({
        "invoice_id": invoice_id,
        "invoice_number": invoice_number,
        "scan_code": scan_code,
        "user_email": merchant_email,
        "client_name": f"Tisch {table.get('table_number') or table.get('table_name')}",
        "client_email": "",
        "items": items,
        "subtotal": round(subtotal, 2),
        "tax": tax,
        "tax_rate": 19,
        "total": total,
        "notes": f"Restaurant-Tischzahlung {table.get('table_name') or table.get('table_number')}",
        "due_days": 1,
        "status": "sent",
        "pay_url": f"/invoice/pay/{scan_code}",
        "public_pay_url": payment_url,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "source": "restaurant_table_system",
        "table_id": table["table_id"],
        "store_id": table.get("store_id"),
        "order_ids": [order.get("order_id") for order in orders],
    })
    await db.pos_guest_orders.update_many(
        {"table_id": table["table_id"], "status": {"$in": ["new", "accepted", "preparing", "ready", "served"]}},
        {"$set": {"payment_link": payment_url, "invoice_id": invoice_id, "invoice_number": invoice_number, "updated_at": now_iso()}},
    )
    return payment_url


class TableCreateRequest(BaseModel):
    store_id: Optional[str] = None
    table_number: str = Field(..., min_length=1, max_length=30)
    table_name: str = Field(..., min_length=1, max_length=80)
    area: str = Field("Gastraum", min_length=1, max_length=60)
    button_id: str = Field("", max_length=80)
    x: int = 24
    y: int = 24


class TableUpdateRequest(BaseModel):
    table_number: Optional[str] = None
    table_name: Optional[str] = None
    area: Optional[str] = None
    button_id: Optional[str] = None
    status: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None


class PublicOrderItem(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1, le=99)
    note: Optional[str] = Field(None, max_length=200)


class OrderCreateRequest(BaseModel):
    table_id: str
    guest_name: Optional[str] = Field(None, max_length=80)
    items: list[PublicOrderItem]
    pay_now: bool = False


class OrderStatusRequest(BaseModel):
    status: str


class ServiceCallCreateRequest(BaseModel):
    table_id: str
    type: Literal["service", "bill", "problem"] = "service"
    button_id: Optional[str] = None


class ServiceCallStatusRequest(BaseModel):
    status: Literal["open", "accepted", "done"]


class ButtonWebhookRequest(BaseModel):
    button_id: str
    event: str = "pressed"
    type: Literal["service", "bill", "problem"] = "service"


class PrinterConfigRequest(BaseModel):
    store_id: Optional[str] = None
    printer_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=80)
    role: Literal["kitchen", "service", "bill"] = "kitchen"
    type: Literal["network", "usb", "file"] = "network"
    ip: str = ""
    port: int = 9100
    device: str = ""


class PrinterTestRequest(BaseModel):
    store_id: Optional[str] = None
    role: Literal["kitchen", "service", "bill"] = "kitchen"


@router.post("/api/tables")
async def create_table_endpoint(req: TableCreateRequest, request: Request):
    _, store = await require_staff(request, req.store_id)
    table_id = make_id("tbl")
    doc = {
        "table_id": table_id,
        "store_id": store.get("store_id"),
        "merchant_id": store.get("merchant_id") or store.get("store_id"),
        "table_number": req.table_number.strip(),
        "table_name": req.table_name.strip(),
        "name": req.table_name.strip(),
        "number": req.table_number.strip(),
        "area": req.area.strip(),
        "section": req.area.strip(),
        "button_id": req.button_id.strip(),
        "x": int(req.x),
        "y": int(req.y),
        "scan_code": table_scan_code(),
        "qr_code_url": f"/table/{table_id}",
        "status": "free",
        "active": True,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    if req.button_id:
        existing = await db.pos_tables.find_one({"button_id": req.button_id.strip(), "active": {"$ne": False}}, {"_id": 0, "table_id": 1})
        if existing:
            raise HTTPException(status_code=409, detail="Button-ID bereits vergeben")
    await db.pos_tables.insert_one({**doc})
    return {"ok": True, "table": await serialize_table(doc, request.headers.get("origin", ""))}


@router.get("/api/tables")
async def list_tables_endpoint(request: Request, store_id: Optional[str] = Query(default=None)):
    _, store = await require_staff(request, store_id)
    tables = await db.pos_tables.find({"store_id": store.get("store_id"), "active": {"$ne": False}}, {"_id": 0}).sort("table_number", 1).to_list(500)
    items = [await serialize_table(table, request.headers.get("origin", "")) for table in tables]
    return {"tables": items, "store": store}


@router.get("/api/tables/{table_id}")
async def get_table_endpoint(table_id: str, request: Request):
    await get_current_user(request)
    table = await get_table_doc(table_id)
    return {"table": await serialize_table(table, request.headers.get("origin", ""))}


@router.put("/api/tables/{table_id}")
async def update_table_endpoint(table_id: str, req: TableUpdateRequest, request: Request):
    await get_current_user(request)
    table = await get_table_doc(table_id)
    update_doc: dict[str, Any] = {"updated_at": now_iso()}
    if req.table_number is not None:
        update_doc["table_number"] = req.table_number.strip()
        update_doc["number"] = req.table_number.strip()
    if req.table_name is not None:
        update_doc["table_name"] = req.table_name.strip()
        update_doc["table_name"] = req.table_name.strip()
        update_doc["name"] = req.table_name.strip()
    if req.area is not None:
        update_doc["area"] = req.area.strip()
        update_doc["section"] = req.area.strip()
    if req.button_id is not None:
        existing = await db.pos_tables.find_one({"button_id": req.button_id.strip(), "table_id": {"$ne": table_id}, "active": {"$ne": False}}, {"_id": 0, "table_id": 1})
        if existing:
            raise HTTPException(status_code=409, detail="Button-ID bereits vergeben")
        update_doc["button_id"] = req.button_id.strip()
    if req.x is not None:
        update_doc["x"] = int(req.x)
    if req.y is not None:
        update_doc["y"] = int(req.y)
    if req.status is not None:
        if req.status not in TABLE_STATUS:
            raise HTTPException(status_code=400, detail="Ungültiger Tischstatus")
        update_doc["status"] = req.status
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": update_doc})
    merged = {**table, **update_doc}
    return {"ok": True, "table": await serialize_table(merged, request.headers.get("origin", ""))}


@router.delete("/api/tables/{table_id}")
async def delete_table_endpoint(table_id: str, request: Request):
    await get_current_user(request)
    await get_table_doc(table_id)
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": {"active": False, "updated_at": now_iso()}})
    return {"ok": True}


@router.post("/api/tables/{table_id}/generate-qr")
async def generate_qr_endpoint(table_id: str, request: Request):
    await get_current_user(request)
    table = await get_table_doc(table_id)
    qr_path = f"/table/{table_id}"
    scan_code = table.get("scan_code") or table_scan_code()
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": {"qr_code_url": qr_path, "scan_code": scan_code, "updated_at": now_iso()}})
    return {
        "ok": True,
        "table_id": table_id,
        "qr_code_url": qr_path,
        "qr_code_absolute_url": build_public_url(qr_path, request.headers.get("origin", "")),
        "scan_code": scan_code,
    }


@router.get("/api/tables/{table_id}/menu")
async def public_table_menu(table_id: str, request: Request):
    table = await get_table_doc(table_id)
    store = await resolve_store(table.get("store_id"))
    products = await db.pos_products.find({"store_id": table.get("store_id"), "active": True}, {"_id": 0}).sort("category", 1).to_list(500)
    return {
        "table": await serialize_table(table, request.headers.get("origin", "")),
        "store": {"store_id": store.get("store_id"), "name": store.get("name") or store.get("store_name") or "Speisekarte"},
        "products": products,
    }


@router.post("/api/tables/{table_id}/bill-link")
async def build_bill_link(table_id: str, request: Request):
    user, store = await require_staff(request)
    table = await get_table_doc(table_id)
    payment_link = await create_payment_link(table, store, request.headers.get("origin", ""), user.get("email", ""))
    if not payment_link:
        raise HTTPException(status_code=400, detail="Kein Zahlungslink möglich")
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": {"status": "bill_requested", "updated_at": now_iso()}})
    return {"ok": True, "payment_link": payment_link}


@router.post("/api/tables/{table_id}/bill-link/public")
async def build_public_bill_link(table_id: str, request: Request):
    table = await get_table_doc(table_id)
    store = await resolve_store(table.get("store_id"))
    payment_link = await create_payment_link(table, store, request.headers.get("origin", ""))
    if not payment_link:
        raise HTTPException(status_code=400, detail="Kein Zahlungslink möglich")
    await db.pos_tables.update_one({"table_id": table_id}, {"$set": {"status": "bill_requested", "updated_at": now_iso()}})
    return {"ok": True, "payment_link": payment_link}


@router.get("/api/table-hardware")
async def hardware_config_endpoint(request: Request, store_id: Optional[str] = Query(default=None)):
    _, store = await require_staff(request, store_id)
    printers = await db.pos_printers.find({"store_id": store.get("store_id")}, {"_id": 0}).sort("role", 1).to_list(50)
    return {
        "store_id": store.get("store_id"),
        "printers": printers,
        "button_webhook_url": build_public_url("/api/button-webhook", request.headers.get("origin", "")),
        "nfc_base_url": build_public_url("/table/", request.headers.get("origin", "")),
    }


@router.post("/api/table-hardware/printers")
async def save_printer_mapping(req: PrinterConfigRequest, request: Request):
    _, store = await require_staff(request, req.store_id)
    printer_id = req.printer_id or make_id("printer")
    doc = {
        "store_id": store.get("store_id"),
        "role": req.role,
        "name": req.name.strip(),
        "type": req.type,
        "ip": req.ip.strip(),
        "port": int(req.port or 9100),
        "device": req.device.strip(),
        "active": True,
        "updated_at": now_iso(),
    }
    await db.pos_printers.update_one(
        {"store_id": store.get("store_id"), "role": req.role},
        {"$set": doc, "$setOnInsert": {"created_at": now_iso(), "printer_id": printer_id}},
        upsert=True,
    )
    return {"ok": True, "printer": {**doc, "printer_id": printer_id}}


@router.post("/api/table-hardware/printers/test")
async def test_printer_mapping(req: PrinterTestRequest, request: Request):
    _, store = await require_staff(request, req.store_id)
    result = await print_slip(
        store.get("store_id"),
        req.role,
        "TESTBON",
        [
            f"Rolle: {req.role}",
            "USB / NETZWERK TEST",
            f"Store: {store.get('store_id')}",
        ],
    )
    return {"ok": True, "result": result}


@router.post("/api/orders")
async def create_order_endpoint(req: OrderCreateRequest, request: Request):
    table = await get_table_doc(req.table_id)
    items: list[dict[str, Any]] = []
    total = 0.0
    for raw in req.items:
        product = await db.pos_products.find_one({"product_id": raw.product_id, "store_id": table.get("store_id"), "active": True}, {"_id": 0})
        if not product:
            continue
        qty = int(raw.quantity or 1)
        if product.get("track_stock") and float(product.get("stock", 0) or 0) < qty:
            raise HTTPException(status_code=409, detail=f"{product.get('name')} nicht ausreichend auf Lager")
        unit_price = round(float(product.get("price", 0) or 0), 2)
        line_total = round(unit_price * qty, 2)
        total += line_total
        items.append({
            "product_id": product.get("product_id"),
            "name": product.get("name"),
            "category": product.get("category", "Küche"),
            "quantity": qty,
            "unit_price": unit_price,
            "line_total": line_total,
            "note": raw.note,
        })
    if not items:
        raise HTTPException(status_code=400, detail="Keine gültigen Artikel")
    order_id = make_id("ord")
    doc = {
        "order_id": order_id,
        "table_id": req.table_id,
        "table_number": table.get("table_number") or table.get("number") or table.get("table_name"),
        "table_name": table.get("table_name") or table.get("name"),
        "store_id": table.get("store_id"),
        "merchant_id": table.get("merchant_id") or table.get("store_id"),
        "items": items,
        "total_price": round(total, 2),
        "total": round(total, 2),
        "status": "new",
        "payment_status": "unpaid",
        "guest_name": req.guest_name,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "status_history": [{"status": "new", "at": now_iso()}],
    }
    await db.pos_guest_orders.insert_one({**doc})
    for item in items:
        product = await db.pos_products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product and product.get("track_stock"):
            before = float(product.get("stock", 0) or 0)
            after = round(before - float(item.get("quantity", 0) or 0), 3)
            await db.pos_products.update_one({"product_id": item["product_id"]}, {"$set": {"stock": after, "updated_at": now_iso()}})
            await _record_movement(
                product=product,
                store_id=table.get("store_id"),
                merchant_id=table.get("merchant_id") or table.get("store_id"),
                type_="sale",
                qty=-float(item.get("quantity", 0) or 0),
                before=before,
                after=after,
                reference_id=order_id,
                actor_id="restaurant_table_system",
                note=f"Tisch {doc['table_number']} QR Bestellung",
            )
    await db.pos_tables.update_one({"table_id": req.table_id}, {"$set": {"status": "order_open", "updated_at": now_iso(), "occupied_since": now_iso()}})
    await create_live_event(table.get("store_id"), "order_created", f"Tisch {doc['table_number']} hat bestellt", {"order_id": order_id, "table_id": req.table_id})
    await print_slip(
        table.get("store_id"),
        "kitchen",
        f"TISCH {doc['table_number']}",
        [*(f"{item['quantity']}x {item['name']}" for item in items), f"Gesamt {doc['total_price']:.2f} EUR"],
    )
    return {"ok": True, "order": doc}


@router.get("/api/orders")
async def list_orders_endpoint(
    request: Request,
    store_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    _, store = await require_staff(request, store_id)
    query: dict[str, Any] = {"store_id": store.get("store_id")}
    if status:
        query["status"] = status
    orders = await db.pos_guest_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"orders": orders}


@router.put("/api/orders/{order_id}/status")
async def update_order_status_endpoint(order_id: str, req: OrderStatusRequest, request: Request):
    await get_current_user(request)
    if req.status not in ORDER_STATUS:
        raise HTTPException(status_code=400, detail="Ungültiger Bestellstatus")
    order = await db.pos_guest_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Bestellung nicht gefunden")
    update_doc = {
        "status": req.status,
        "updated_at": now_iso(),
        "payment_status": "paid" if req.status == "paid" else order.get("payment_status", "unpaid"),
    }
    await db.pos_guest_orders.update_one(
        {"order_id": order_id},
        {"$set": update_doc, "$push": {"status_history": {"status": req.status, "at": now_iso()}}},
    )
    if req.status == "paid":
        await create_live_event(order.get("store_id"), "order_paid", f"Tisch {order.get('table_number')} bezahlt", {"order_id": order_id, "table_id": order.get("table_id")})
    await refresh_table_status(order.get("table_id"))
    return {"ok": True, "status": req.status}


@router.post("/api/service-call")
async def create_service_call_endpoint(req: ServiceCallCreateRequest, request: Request):
    table = await get_table_doc(req.table_id)
    if req.type not in SERVICE_TYPES:
        raise HTTPException(status_code=400, detail="Ungültiger Service-Call")
    call_id = make_id("svc")
    doc = {
        "id": call_id,
        "service_call_id": call_id,
        "table_id": req.table_id,
        "table_number": table.get("table_number") or table.get("number") or table.get("table_name"),
        "table_name": table.get("table_name") or table.get("name"),
        "store_id": table.get("store_id"),
        "button_id": req.button_id or table.get("button_id", ""),
        "type": req.type,
        "status": "open",
        "created_at": now_iso(),
        "accepted_by": None,
        "completed_at": None,
    }
    await db.pos_service_calls.insert_one({**doc})
    await db.pos_tables.update_one({"table_id": req.table_id}, {"$set": {"status": "bill_requested" if req.type == "bill" else "service_call", "updated_at": now_iso()}})
    label = "Rechnung angefordert" if req.type == "bill" else "Service ruft" if req.type == "service" else "Problem gemeldet"
    await create_live_event(table.get("store_id"), "service_call", f"Tisch {doc['table_number']} ruft Service", {"service_call_id": call_id, "type": req.type, "table_id": req.table_id})
    await print_slip(table.get("store_id"), "service", f"TISCH {doc['table_number']}", [label])
    return {"ok": True, "service_call": doc}


@router.get("/api/service-call")
async def list_service_calls_endpoint(
    request: Request,
    store_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    _, store = await require_staff(request, store_id)
    query: dict[str, Any] = {"store_id": store.get("store_id")}
    if status:
        query["status"] = status
    items = await db.pos_service_calls.find(query, {"_id": 0}).sort("created_at", -1).to_list(300)
    return {"service_calls": items}


@router.put("/api/service-call/{service_call_id}/status")
async def update_service_call_status_endpoint(service_call_id: str, req: ServiceCallStatusRequest, request: Request):
    user = await get_current_user(request)
    if req.status not in SERVICE_STATUS:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    call = await db.pos_service_calls.find_one({"service_call_id": service_call_id}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Service-Call nicht gefunden")
    update_doc: dict[str, Any] = {"status": req.status, "updated_at": now_iso()}
    if req.status == "accepted":
        update_doc["accepted_by"] = user.get("email") or user.get("name") or str(user.get("_id"))
    if req.status == "done":
        update_doc["completed_at"] = now_iso()
        if call.get("type") == "bill":
            await print_slip(call.get("store_id"), "bill", f"TISCH {call.get('table_number')}", ["RECHNUNG GEBRACHT"])
    await db.pos_service_calls.update_one({"service_call_id": service_call_id}, {"$set": update_doc})
    await refresh_table_status(call.get("table_id"))
    return {"ok": True, "status": req.status}


@router.post("/api/button-webhook")
async def button_webhook_endpoint(req: ButtonWebhookRequest):
    if req.event != "pressed":
        return {"ok": True, "ignored": True}
    table = await db.pos_tables.find_one({"button_id": req.button_id, "active": {"$ne": False}}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Button-ID unbekannt")
    call_id = make_id("svc")
    doc = {
        "id": call_id,
        "service_call_id": call_id,
        "table_id": table.get("table_id"),
        "table_number": table.get("table_number") or table.get("number") or table.get("table_name"),
        "table_name": table.get("table_name") or table.get("name"),
        "store_id": table.get("store_id"),
        "button_id": req.button_id,
        "type": req.type,
        "status": "open",
        "created_at": now_iso(),
        "accepted_by": None,
        "completed_at": None,
        "source": "button_webhook",
    }
    await db.pos_service_calls.insert_one({**doc})
    await db.pos_tables.update_one({"table_id": table.get("table_id")}, {"$set": {"status": "bill_requested" if req.type == "bill" else "service_call", "updated_at": now_iso()}})
    await create_live_event(table.get("store_id"), "service_call", f"Tisch {doc['table_number']} ruft Service", {"service_call_id": call_id, "button_id": req.button_id})
    await print_slip(table.get("store_id"), "service", f"TISCH {doc['table_number']}", ["SERVICE RUF", f"Button {req.button_id}"])
    return {"ok": True, "message": f"Tisch {doc['table_number']} ruft Service", "service_call_id": call_id}
