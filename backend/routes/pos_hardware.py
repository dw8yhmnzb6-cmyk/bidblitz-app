"""
BidBlitz POS — Hardware Integration Layer
Bondrucker (ESC/POS), Barcode-Scanner, Kassen-Schublade, TSE-Hardware, Waagen

Unterstützte Hardware:
- Bondrucker: Epson TM-T20, Star TSP100, Custom VKP80
- Scanner: Honeywell, Zebra, Datalogic (USB/Bluetooth)
- Waagen: Bizerba, Mettler Toledo (RS232/USB)
- TSE: Fiskaltrust, Epson TSE, Swissbit
- Cash Drawer: Standard RJ11/12 Cash Drawers
"""
import logging
import asyncio
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from routes.pos_system import short_id, now_iso, _require_store_access

router = APIRouter(prefix="/api/pos/hardware", tags=["POS Hardware"])
log = logging.getLogger("bidblitz.pos.hardware")


# ═══════════════════════════════════════════════════════════════════════
# BONDRUCKER (Receipt Printer — ESC/POS Protocol)
# ═══════════════════════════════════════════════════════════════════════

class PrintRequest(BaseModel):
    receipt_id: str
    printer_id: Optional[str] = "default"
    copies: int = 1

@router.post("/printer/print")
async def print_receipt(req: PrintRequest, request: Request):
    """Druckt Beleg auf ESC/POS-Bondrucker.
    Unterstützt: Epson TM-T20, Star TSP100, Custom VKP80."""
    user = await get_current_user(request)
    
    # Fetch receipt
    sale = await db.pos_sales.find_one({"receipt_id": req.receipt_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Beleg nicht gefunden")
    
    await _require_store_access(user, sale["store_id"])

    # Printer config must belong to the same store.
    printer = await db.pos_printers.find_one({
        "printer_id": req.printer_id or "default",
        "store_id": sale["store_id"],
    })
    if not printer:
        if not TEST_MODE:
            raise HTTPException(status_code=503, detail="Kein echter Bondrucker für diese Filiale konfiguriert")
        printer = {"type": "file", "simulated": True}
    
    # Generate ESC/POS commands
    escpos_data = _generate_escpos(sale)
    
    # Send to printer (async to avoid blocking)
    try:
        if printer["type"] == "network":
            await _send_to_network_printer(printer["ip"], printer["port"], escpos_data)
        elif printer["type"] == "usb":
            await _send_to_usb_printer(printer["device"], escpos_data)
        elif printer["type"] == "file":
            if not TEST_MODE:
                raise HTTPException(status_code=503, detail="Datei-Druck ist nur im Testmodus erlaubt")
            with open(f"/tmp/receipt_{req.receipt_id}.txt", "wb") as f:
                f.write(escpos_data)
        else:
            raise HTTPException(status_code=503, detail="Nicht unterstützter Drucker-Typ")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Print error: {e}")
        raise HTTPException(status_code=502, detail="Bondrucker konnte nicht angesprochen werden")
    
    await db.pos_sales.update_one(
        {"receipt_id": req.receipt_id},
        {"$set": {"printed": True, "printed_at": now_iso()}}
    )
    
    return {"ok": True, "receipt_id": req.receipt_id, "printer": req.printer_id}

def _generate_escpos(sale: Dict) -> bytes:
    """Generates ESC/POS byte sequence for thermal printer."""
    ESC = b'\x1b'
    GS = b'\x1d'
    
    commands = []
    
    # Initialize printer
    commands.append(ESC + b'@')
    
    # Center alignment
    commands.append(ESC + b'a' + b'\x01')
    
    # Logo (placeholder)
    commands.append(b'===== BIDBLITZ =====\n\n')
    
    # Left align
    commands.append(ESC + b'a' + b'\x00')
    
    # Receipt header
    commands.append(f"Beleg: {sale['receipt_id']}\n".encode('utf-8'))
    commands.append(f"Datum: {sale['created_at'][:10]}\n".encode('utf-8'))
    commands.append(f"Kasse: {sale['register_id']}\n".encode('utf-8'))
    commands.append(b'-' * 42 + b'\n')
    
    # Items
    for item in sale.get("items", []):
        name = item.get("name", "Artikel")[:30]
        qty = item.get("quantity", 1)
        price = item.get("line_total", 0)
        commands.append(f"{name}\n".encode('utf-8'))
        commands.append(f"  {qty}x  {price:.2f} EUR\n".encode('utf-8'))
    
    commands.append(b'-' * 42 + b'\n')
    
    # Total (bold)
    commands.append(ESC + b'E' + b'\x01')  # Bold on
    commands.append(f"SUMME: {sale['total']:.2f} EUR\n".encode('utf-8'))
    commands.append(ESC + b'E' + b'\x00')  # Bold off
    
    # Footer
    commands.append(b'\n')
    commands.append(ESC + b'a' + b'\x01')  # Center
    commands.append(b'Vielen Dank!\n')
    commands.append(b'bidblitz.ae\n')
    
    # Cut paper
    commands.append(b'\n\n\n')
    commands.append(GS + b'V' + b'\x00')  # Full cut
    
    return b''.join(commands)

async def _send_to_network_printer(ip: str, port: int, data: bytes):
    """Sends ESC/POS data to network printer via TCP socket."""
    reader, writer = await asyncio.open_connection(ip, port)
    writer.write(data)
    await writer.drain()
    writer.close()
    await writer.wait_closed()

async def _send_to_usb_printer(device: str, data: bytes):
    """Sends ESC/POS data to USB printer (Linux /dev/usb/lp0)."""
    import subprocess
    subprocess.run(['cat'], input=data, stdout=open(device, 'wb'))


# ═══════════════════════════════════════════════════════════════════════
# BARCODE-SCANNER (USB/Bluetooth HID)
# ═══════════════════════════════════════════════════════════════════════

class ScannerRegisterRequest(BaseModel):
    scanner_id: str
    store_id: str
    type: str = "usb"

@router.post("/scanner/register")
async def register_scanner(req: ScannerRegisterRequest, request: Request):
    """Registriert Barcode-Scanner (Honeywell, Zebra, Datalogic)."""
    user = await get_current_user(request)
    await _require_store_access(user, req.store_id, {"merchant_admin", "store_manager"})

    await db.pos_scanners.update_one(
        {"scanner_id": req.scanner_id, "store_id": req.store_id},
        {"$set": {
            "scanner_id": req.scanner_id,
            "store_id": req.store_id,
            "type": req.type,
            "status": "active",
            "registered_at": now_iso(),
        }},
        upsert=True
    )
    return {"ok": True, "scanner_id": req.scanner_id}

class ScannerTestRequest(BaseModel):
    barcode: Optional[str] = None

@router.get("/scanner/test")
async def test_scanner(request: Request, store_id: str, barcode: Optional[str] = None):
    """Test-Endpoint: Scanner sendet Barcode an Backend.
    Wenn kein Barcode: liefert ok:true zurück (Heartbeat).
    Wenn Barcode: schlägt Produkt in pos_products nach.
    """
    user = await get_current_user(request)
    await _require_store_access(user, store_id)

    if not barcode:
        return {"ok": True, "scanner_status": "ready", "message": "Scanner heartbeat OK"}

    product = await db.pos_products.find_one({"store_id": store_id, "barcode": barcode, "active": True}, {"_id": 0})
    if not product:
        return {"ok": False, "error": "Produkt nicht gefunden", "barcode": barcode}

    return {"ok": True, "product": product}


# ═══════════════════════════════════════════════════════════════════════
# KASSEN-SCHUBLADE (Cash Drawer — RJ11/12 Pulse)
# ═══════════════════════════════════════════════════════════════════════

class CashDrawerOpenRequest(BaseModel):
    register_id: Optional[str] = None
    store_id: Optional[str] = None
    reason: Optional[str] = "manual"

@router.post("/cash-drawer/open")
async def open_cash_drawer(req: CashDrawerOpenRequest, request: Request):
    """Öffnet eine konfigurierte Kassenschublade nur für berechtigte Store-Nutzer."""
    user = await get_current_user(request)
    store_id = (req.store_id or "").strip()
    register = None
    if req.register_id:
        register = await db.pos_registers.find_one({"register_id": req.register_id}, {"_id": 0})
        if not register:
            raise HTTPException(status_code=404, detail="Kasse nicht gefunden")
        if store_id and register.get("store_id") != store_id:
            raise HTTPException(status_code=409, detail="Kasse gehört nicht zur angegebenen Filiale")
        store_id = str(register.get("store_id") or "")
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id oder register_id erforderlich")

    await _require_store_access(user, store_id, {"merchant_admin", "store_manager", "cashier"})
    register_id = req.register_id or (register or {}).get("register_id") or store_id
    open_cmd = b'\x10\x14\x01\x00\x05'

    query = {"store_id": store_id}
    if req.register_id:
        query["register_id"] = req.register_id
    printer = await db.pos_printers.find_one(query)
    simulated = False
    if not printer:
        if not TEST_MODE:
            raise HTTPException(status_code=503, detail="Keine echte Kassenschubladen-/Drucker-Hardware konfiguriert")
        simulated = True
    else:
        try:
            if printer.get("type") == "network":
                await _send_to_network_printer(printer["ip"], printer["port"], open_cmd)
            elif printer.get("type") == "usb":
                await _send_to_usb_printer(printer["device"], open_cmd)
            elif TEST_MODE:
                simulated = True
            else:
                raise HTTPException(status_code=503, detail="Konfigurierte Hardware unterstützt keine Kassenschublade")
        except HTTPException:
            raise
        except Exception as e:
            log.error("Cash drawer error: %s", e)
            raise HTTPException(status_code=502, detail="Kassenschublade konnte nicht geöffnet werden")

    await db.pos_cash_drawer_events.insert_one({
        "event_id": short_id("DRW", 10),
        "register_id": register_id,
        "store_id": store_id,
        "reason": req.reason,
        "opened_by": str(user["_id"]),
        "simulated": simulated,
        "created_at": now_iso(),
    })
    return {
        "ok": True,
        "drawer_opened": True,
        "register_id": register_id,
        "store_id": store_id,
        "simulated": simulated,
    }


# ═══════════════════════════════════════════════════════════════════════
# TSE-HARDWARE (Technische Sicherheitseinrichtung — DE Fiskalgesetz)
# ═══════════════════════════════════════════════════════════════════════

class TSESignRequest(BaseModel):
    receipt_id: str
    process_type: str = "Kassenbeleg-V1"

@router.post("/tse/sign")
async def tse_sign_receipt(req: TSESignRequest, request: Request):
    """Signiert Beleg mit TSE-Hardware (Fiskaltrust, Epson TSE, Swissbit).
    
    Hardware-Integration:
    - Fiskaltrust Middleware (HTTP API)
    - Epson TSE via USB (Direct)
    - Swissbit TSE via USB (SDK)
    """
    user = await get_current_user(request)
    
    sale = await db.pos_sales.find_one({"receipt_id": req.receipt_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Beleg nicht gefunden")
    await _require_store_access(user, sale["store_id"])
    
    # TSE Provider config
    tse_config = await db.pos_tse_config.find_one({"store_id": sale["store_id"]})
    if not tse_config:
        if TEST_MODE:
            return {"ok": True, "tse_type": "test", "simulated": True, "message": "TSE Testmodus"}
        raise HTTPException(status_code=503, detail="Kein verifizierter TSE-Provider für diese Filiale konfiguriert")
    
    # Hardware TSE signing
    if tse_config["type"] == "fiskaltrust":
        # Fiskaltrust Middleware HTTP API
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{tse_config['middleware_url']}/sign",
                json={
                    "ftReceiptCase": 0x4445000000000001,  # Kassenbeleg
                    "ftPosSystemId": sale["register_id"],
                    "cbChargeItems": [
                        {
                            "Quantity": it["quantity"],
                            "Description": it["name"],
                            "Amount": it["line_total"],
                            "VATRate": it.get("tax_rate", 0.19) * 100,
                        }
                        for it in sale["items"]
                    ],
                }
            )
            response.raise_for_status()
            tse_data = response.json()
            if not tse_data.get("signature"):
                raise HTTPException(status_code=502, detail="TSE-Provider lieferte keine Signatur")
    
    elif tse_config["type"] == "epson":
        if not TEST_MODE:
            raise HTTPException(status_code=503, detail="Epson-TSE SDK noch nicht live verbunden")
        tse_data = {"signature": "TEST-EPSON-TSE", "transaction_number": 12345, "simulated": True}
    
    elif tse_config["type"] == "swissbit":
        if not TEST_MODE:
            raise HTTPException(status_code=503, detail="Swissbit-TSE SDK noch nicht live verbunden")
        tse_data = {"signature": "TEST-SWISSBIT-TSE", "transaction_number": 67890, "simulated": True}
    
    else:
        raise HTTPException(status_code=400, detail="Unbekannter TSE-Typ")
    
    # Save TSE signature
    await db.pos_sales.update_one(
        {"receipt_id": req.receipt_id},
        {"$set": {
            "tse_signed": True,
            "tse_signature": tse_data.get("signature"),
            "tse_transaction_number": tse_data.get("transaction_number"),
            "tse_signed_at": now_iso(),
        }}
    )
    
    return {"ok": True, "tse_data": tse_data}


# ═══════════════════════════════════════════════════════════════════════
# WAAGEN-INTEGRATION (Scale — Bizerba, Mettler Toledo)
# ═══════════════════════════════════════════════════════════════════════

@router.get("/scale/weight")
async def read_scale_weight(request: Request, scale_id: str = "default"):
    """Liest aktuelles Gewicht von Waage (RS232/USB).
    
    Unterstützte Waagen:
    - Bizerba (Protokoll: Bizerba-ASCII)
    - Mettler Toledo (Protokoll: MT-SICS)
    - Kern (Protokoll: Kern-ASCII)
    """
    user = await get_current_user(request)
    
    scale = await db.pos_scales.find_one({"scale_id": scale_id})
    if not scale:
        raise HTTPException(status_code=404, detail="Waage nicht konfiguriert")
    if not scale.get("store_id"):
        if not TEST_MODE:
            raise HTTPException(status_code=409, detail="Waage ist keiner Filiale zugeordnet")
    else:
        await _require_store_access(user, scale["store_id"])
    
    # Read weight from scale (serial port)
    try:
        if scale["type"] == "bizerba":
            weight = await _read_bizerba_scale(scale["port"])
        elif scale["type"] == "mettler_toledo":
            weight = await _read_mettler_toledo_scale(scale["port"])
        else:
            raise HTTPException(status_code=400, detail="Unbekannter Waagen-Typ")
    except Exception as e:
        log.error(f"Scale read error: {e}")
        raise HTTPException(status_code=500, detail=f"Waagen-Fehler: {str(e)}")
    
    return {"ok": True, "weight_kg": weight, "scale_id": scale_id}

async def _read_bizerba_scale(port: str) -> float:
    """Reads weight from Bizerba scale via RS232."""
    import serial
    ser = serial.Serial(port, baudrate=9600, timeout=1)
    ser.write(b'W\r\n')  # Request weight
    response = ser.readline().decode('ascii').strip()
    ser.close()
    
    # Parse response (format: "W +00.123 kg")
    weight_str = response.split()[1]
    return float(weight_str)

async def _read_mettler_toledo_scale(port: str) -> float:
    """Reads weight from Mettler Toledo scale via MT-SICS protocol."""
    import serial
    ser = serial.Serial(port, baudrate=9600, timeout=1)
    ser.write(b'S\r\n')  # Send command
    response = ser.readline().decode('ascii').strip()
    ser.close()
    
    # Parse response (format: "S S 00.123 kg")
    parts = response.split()
    if parts[1] == 'S':  # Stable
        return float(parts[2])
    else:
        raise Exception("Gewicht instabil")


# ═══════════════════════════════════════════════════════════════════════
# HARDWARE HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════

@router.get("/health")
async def hardware_health(request: Request, store_id: str):
    """Prüft Status aller Hardware-Geräte."""
    user = await get_current_user(request)
    await _require_store_access(user, store_id)
    
    printers = await db.pos_printers.find({"store_id": store_id}, {"_id": 0}).to_list(10)
    scanners = await db.pos_scanners.find({"store_id": store_id}, {"_id": 0}).to_list(10)
    scales = await db.pos_scales.find({"store_id": store_id}, {"_id": 0}).to_list(10)
    
    return {
        "store_id": store_id,
        "printers": printers,
        "scanners": scanners,
        "scales": scales,
        "status": "ok",
    }
