from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.database import db
from routes.qr_table_order import _rotate_token

router = APIRouter(prefix="/api/scan", tags=["scan"])


class ScanResolveRequest(BaseModel):
    code: str = Field(..., min_length=2, max_length=400)


def _extract_path(code: str) -> str:
    if code.startswith("http://") or code.startswith("https://"):
        parsed = urlparse(code)
        return parsed.path or ""
    return code


@router.post("/resolve")
async def resolve_scan(req: ScanResolveRequest):
    raw = req.code.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Code fehlt")

    code = raw.upper()
    path = _extract_path(raw)

    if "/order/qr/" in path:
        token = path.split("/order/qr/", 1)[1].split("/", 1)[0].strip()
        if token:
            return {"ok": True, "type": "table_order", "route": f"/order/qr/{token}"}

    if "/order/" in path and "/order/qr/" not in path:
        token = path.split("/order/", 1)[1].split("/", 1)[0].strip()
        if token:
            return {"ok": True, "type": "table_order", "route": f"/order/{token}"}

    if "/pay/checkout/" in path:
        session_id = path.split("/pay/checkout/", 1)[1].split("/", 1)[0].strip()
        if session_id:
            return {"ok": True, "type": "checkout", "route": f"/pay/checkout/{session_id}"}

    if "/invoice/pay/" in path:
        scan_code = path.split("/invoice/pay/", 1)[1].split("/", 1)[0].strip()
        if scan_code:
            return {"ok": True, "type": "invoice", "route": f"/invoice/pay/{scan_code}"}

    if code.startswith("CS_"):
        return {"ok": True, "type": "checkout", "route": f"/pay/checkout/{raw}"}

    if code.startswith("TBL-"):
        table = await db.pos_tables.find_one({"scan_code": code}, {"_id": 0, "table_id": 1})
        if not table:
            raise HTTPException(status_code=404, detail="Tisch-Code nicht gefunden")
        fresh = await _rotate_token(table["table_id"])
        return {"ok": True, "type": "table_order", "route": f"/order/qr/{fresh['token']}", "scan_code": code}

    if code.startswith("BBINV-") or raw.startswith("inv_") or code.startswith("INV-"):
        invoice = await db.invoices.find_one(
            {"$or": [{"scan_code": code}, {"invoice_id": raw}, {"invoice_number": code}]},
            {"_id": 0, "scan_code": 1, "invoice_id": 1},
        )
        if not invoice:
            raise HTTPException(status_code=404, detail="Rechnungs-Code nicht gefunden")
        target = invoice.get("scan_code") or invoice.get("invoice_id") or raw
        return {"ok": True, "type": "invoice", "route": f"/invoice/pay/{target}"}

    if code.startswith("BLZ-"):
        return {
            "ok": True,
            "type": "wallet_barcode",
            "action": "cashier",
            "message": "Kunden-Barcode erkannt. Bitte in den Kassieren-Modus wechseln.",
        }

    raise HTTPException(status_code=400, detail="Unbekannter Scan-Code")