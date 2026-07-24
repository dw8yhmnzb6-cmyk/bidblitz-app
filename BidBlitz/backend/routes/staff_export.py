"""
Payroll Export & Reports
========================
Monthly reports, CSV exports, DATEV placeholder
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import uuid4
import csv
import io
import os

router = APIRouter(prefix="/api/staff/export", tags=["staff-export"])

from motor.motor_asyncio import AsyncIOMotorClient
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "bidblitz")]

@router.get("/monthly-report")
async def get_monthly_report(
    year: int,
    month: int,
    merchant_id: str = "test-merchant"
):
    """Complete monthly report for all staff"""
    # Date range
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get all staff
    staff_members = await db.staff_members.find(
        {"merchant_id": merchant_id, "active": True},
        {"_id": 0}
    ).to_list(1000)
    
    report = []
    
    for staff in staff_members:
        # Get events
        events = await db.staff_clock_events.find({
            "staff_id": staff["id"],
            "timestamp": {
                "$gte": start_date.isoformat(),
                "$lt": end_date.isoformat()
            }
        }, {"_id": 0}).sort("timestamp", 1).to_list(10000)
        
        # Calculate hours
        total_hours = 0.0
        break_hours = 0.0
        current_shift_start = None
        current_break_start = None
        
        for event in events:
            ts = datetime.fromisoformat(event["timestamp"])
            
            if event["action"] == "clock_in":
                current_shift_start = ts
            elif event["action"] == "clock_out" and current_shift_start:
                duration = (ts - current_shift_start).total_seconds() / 3600
                total_hours += duration
                current_shift_start = None
            elif event["action"] == "break_start":
                current_break_start = ts
            elif event["action"] == "break_end" and current_break_start:
                duration = (ts - current_break_start).total_seconds() / 3600
                break_hours += duration
                current_break_start = None
        
        net_hours = max(0, total_hours - break_hours)
        expected_hours = 160  # ~40h/week * 4 weeks
        overtime_hours = max(0, net_hours - expected_hours)
        
        hourly_rate = staff.get("hourly_rate", 12.0)
        regular_pay = (net_hours - overtime_hours) * hourly_rate
        overtime_pay = overtime_hours * hourly_rate * 1.5
        total_pay = regular_pay + overtime_pay
        
        report.append({
            "staff_id": staff["id"],
            "personal_nr": staff.get("personal_nr") or staff.get("personalnummer") or staff["id"][:8],
            "staff_name": staff["name"],
            "staff_email": staff["email"],
            "total_hours": round(total_hours, 2),
            "break_hours": round(break_hours, 2),
            "net_hours": round(net_hours, 2),
            "overtime_hours": round(overtime_hours, 2),
            "hourly_rate": hourly_rate,
            "regular_pay": round(regular_pay, 2),
            "overtime_pay": round(overtime_pay, 2),
            "total_pay": round(total_pay, 2),
            "events_count": len(events)
        })
    
    return {
        "success": True,
        "period": {"year": year, "month": month},
        "report": report,
        "total_staff": len(report)
    }

@router.get("/csv/monthly")
async def export_monthly_csv(
    year: int,
    month: int,
    merchant_id: str = "test-merchant"
):
    """Export monthly report as CSV"""
    # Get report data
    report_data = await get_monthly_report(year, month, merchant_id)
    
    if not report_data["success"]:
        raise HTTPException(500, "Report generation failed")
    
    report = report_data["report"]
    
    # Create CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "staff_name", "staff_email", "total_hours", "break_hours",
        "net_hours", "overtime_hours", "hourly_rate",
        "regular_pay", "overtime_pay", "total_pay"
    ])
    
    writer.writeheader()
    for row in report:
        writer.writerow({
            "staff_name": row["staff_name"],
            "staff_email": row["staff_email"],
            "total_hours": row["total_hours"],
            "break_hours": row["break_hours"],
            "net_hours": row["net_hours"],
            "overtime_hours": row["overtime_hours"],
            "hourly_rate": row["hourly_rate"],
            "regular_pay": row["regular_pay"],
            "overtime_pay": row["overtime_pay"],
            "total_pay": row["total_pay"]
        })
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=payroll_{year}_{month:02d}.csv"
        }
    )

@router.get("/datev-placeholder")
async def export_datev_placeholder(
    year: int,
    month: int,
    merchant_id: str = "test-merchant"
):
    """Backward-compat: redirects to new /datev/lohn-bewegungsdaten endpoint."""
    return {
        "success": True,
        "deprecated": True,
        "use_instead": "/api/staff/export/datev/lohn-bewegungsdaten",
        "period": {"year": year, "month": month},
    }


# ═══════════════════════════════════════════════════════════════════════════
# DATEV EXTF — Echtes DATEV-Format für Steuerberater (iter114)
# ═══════════════════════════════════════════════════════════════════════════
#
# Spezifikation: DATEV "Lohn und Gehalt" Bewegungsdaten Import
# Format-ID: 510 (Lohnstapel) bzw. CSV-Lohnnebenkosten
# Encoding: Windows-1252 (cp1252) — Pflicht für DATEV
# Trennzeichen: Semikolon (;)
# Dezimaltrennzeichen: Komma (,) für Stunden/Beträge
# Datumsformat: TTMMJJJJ ohne Trenner für EXTF-Header, TT.MM.JJJJ in Daten
#
# Standard-Lohnarten (mappable im Mandanten-Profil):
#   200 = Stundenlohn regulär
#   400 = Überstunden (25 %)
#   500 = Nachtzuschlag (25 %)
#   600 = Sonntagszuschlag (50 %)
#   700 = Feiertagszuschlag (125 %)
# ═══════════════════════════════════════════════════════════════════════════

# DATEV-Berater/Mandant/Wirtschaftsjahr werden pro Merchant aus
# pos_merchants.datev_config gelesen — falls leer wird "0" als Default genommen
# (DATEV-Software lässt User die Werte beim Import manuell setzen).

async def _get_datev_config(merchant_id: str) -> dict:
    """Liest DATEV-Settings (Berater-Nr, Mandant-Nr, etc.) aus Merchant-Profile."""
    m = await db.pos_merchants.find_one({"merchant_id": merchant_id}, {"_id": 0, "datev_config": 1, "company_name": 1})
    cfg = (m or {}).get("datev_config") or {}
    return {
        "berater": str(cfg.get("berater_nr") or "0"),
        "mandant": str(cfg.get("mandant_nr") or "0"),
        "wj_beginn": cfg.get("wj_beginn") or f"{datetime.now().year}0101",
        "lohnart_regular": int(cfg.get("lohnart_regular") or 200),
        "lohnart_overtime": int(cfg.get("lohnart_overtime") or 400),
        "company_name": (m or {}).get("company_name") or "BidBlitz Merchant",
    }


def _fmt_de_decimal(value: float, places: int = 2) -> str:
    """German decimal: 12.5 → '12,50'."""
    return f"{value:.{places}f}".replace(".", ",")


@router.get("/datev/lohn-bewegungsdaten")
async def export_datev_lohn_bewegungsdaten(
    year: int,
    month: int,
    merchant_id: str = "test-merchant",
):
    """
    DATEV EXTF Format 510 — Lohn & Gehalt Bewegungsdaten Import.

    Erzeugt Windows-1252 CSV mit korrekter EXTF-Kopfzeile.
    Direkt importierbar in DATEV Lohn und Gehalt classic / comfort / compact.

    Eine Zeile pro Mitarbeiter pro Lohnart:
      - Lohnart 200 (regulär) mit net_hours
      - Lohnart 400 (Überstunden) mit overtime_hours — nur wenn > 0
    """
    report_data = await get_monthly_report(year, month, merchant_id)
    if not report_data["success"]:
        raise HTTPException(500, "Report-Generierung fehlgeschlagen")

    cfg = await _get_datev_config(merchant_id)
    now = datetime.now(timezone.utc)
    period_start = f"{year:04d}{month:02d}01"
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    period_end = (next_month - timedelta(days=1)).strftime("%Y%m%d")

    # EXTF-Header (DATEV "Stunden und Beträge" Format-ID 510, Version 1062)
    # Aufbau laut DATEV-Schnittstellenbeschreibung Buchungsstapel/Lohn:
    # Feld 1: "EXTF" (Kennung)
    # Feld 2: Versionsnummer (510)
    # Feld 3: Format (1062 = Lohn-Bewegungsdaten)
    # Feld 4: Format-Bezeichnung
    # Feld 5: Format-Version (1)
    # Feld 6: Erzeugt-am (YYYYMMDDHHMMSSFFF)
    # Feld 7: leer (Importiert-am)
    # Feld 8: Herkunft ("MA" = manuell, "RE" = Rechnungswesen)
    # Feld 9: Exportiert-von
    # Feld 10: Importiert-von (leer)
    # Feld 11: Berater
    # Feld 12: Mandant
    # Feld 13: WJ-Beginn (YYYYMMDD)
    # Feld 14: Sachkontenlänge
    # Feld 15: Datum-Beginn (YYYYMMDD)
    # Feld 16: Datum-Ende (YYYYMMDD)
    # Feld 17: Bezeichnung
    # Feld 18: Diktatkürzel
    # Feld 19: Buchungstyp (1 = Finanzbuchführung)
    # Feld 20-29: reserviert
    extf_header = ";".join([
        '"EXTF"',
        "510",
        "1062",
        '"Lohnstapel"',
        "1",
        now.strftime("%Y%m%d%H%M%S000"),
        "",
        '"MA"',
        '"' + cfg["company_name"].replace('"', '') + '"',
        "",
        cfg["berater"],
        cfg["mandant"],
        cfg["wj_beginn"],
        "0",
        period_start,
        period_end,
        '"BidBlitz Lohnstapel ' + f"{year}-{month:02d}" + '"',
        '""',
        "1",
        "0",
        "",
        "",
        "EUR",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
    ])

    # Field-names row
    field_names = ";".join([
        '"Personalnummer"',
        '"Lohnart"',
        '"Stunden"',
        '"Betrag"',
        '"Datum"',
        '"Kostenstelle"',
        '"Notiz"',
    ])

    rows: list[str] = [extf_header, field_names]

    for entry in report_data["report"]:
        personal_nr = entry.get("personal_nr") or entry.get("staff_id") or entry.get("staff_email", "")[:10]
        net_hours = float(entry.get("net_hours") or 0)
        overtime = float(entry.get("overtime_hours") or 0)
        regular = max(0.0, net_hours - overtime)
        rate = float(entry.get("hourly_rate") or 0)

        # Regular-Stunden-Zeile
        if regular > 0:
            rows.append(";".join([
                f'"{personal_nr}"',
                str(cfg["lohnart_regular"]),
                _fmt_de_decimal(regular),
                _fmt_de_decimal(regular * rate),
                f"{month:02d}.{year:04d}",
                '""',
                f'"Reg. Std {entry.get("staff_name", "")}"',
            ]))
        # Überstunden-Zeile
        if overtime > 0:
            rows.append(";".join([
                f'"{personal_nr}"',
                str(cfg["lohnart_overtime"]),
                _fmt_de_decimal(overtime),
                _fmt_de_decimal(overtime * rate * 1.25),
                f"{month:02d}.{year:04d}",
                '""',
                f'"Überstd {entry.get("staff_name", "")} (+25%)"',
            ]))

    # Windows-1252 encoding mit BOM-freier Codepage (DATEV-Standard)
    content = "\r\n".join(rows) + "\r\n"
    try:
        encoded = content.encode("cp1252", errors="replace")
    except Exception:
        encoded = content.encode("latin-1", errors="replace")

    filename = f"EXTF_Lohn_{year}_{month:02d}_Berater{cfg['berater']}_Mand{cfg['mandant']}.csv"
    return StreamingResponse(
        iter([encoded]),
        media_type="text/csv; charset=windows-1252",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-DATEV-Format": "510-1062",
            "X-Period": f"{year}-{month:02d}",
            "X-Entries": str(len(rows) - 2),
        },
    )


@router.get("/datev/lohnstunden-csv")
async def export_datev_lohnstunden_csv(
    year: int,
    month: int,
    merchant_id: str = "test-merchant",
):
    """
    Vereinfachtes DATEV-kompatibles Format ohne EXTF-Header.
    Für Steuerberater die manuell in DATEV Lohn & Gehalt importieren.

    Spalten: Mandant;Personalnummer;Mitarbeiter;Lohnart;Stunden;Stundensatz;Betrag;Periode
    """
    report_data = await get_monthly_report(year, month, merchant_id)
    if not report_data["success"]:
        raise HTTPException(500, "Report-Generierung fehlgeschlagen")

    cfg = await _get_datev_config(merchant_id)

    rows = ["Mandant;Personalnummer;Mitarbeiter;Lohnart;Bezeichnung;Stunden;Stundensatz;Betrag;Periode"]
    for entry in report_data["report"]:
        personal_nr = entry.get("personal_nr") or entry.get("staff_id") or entry.get("staff_email", "")[:10]
        name = entry.get("staff_name") or ""
        net_hours = float(entry.get("net_hours") or 0)
        overtime = float(entry.get("overtime_hours") or 0)
        regular = max(0.0, net_hours - overtime)
        rate = float(entry.get("hourly_rate") or 0)
        periode = f"{month:02d}/{year}"

        if regular > 0:
            rows.append(";".join([
                cfg["mandant"], personal_nr, name,
                str(cfg["lohnart_regular"]), "Stundenlohn",
                _fmt_de_decimal(regular), _fmt_de_decimal(rate),
                _fmt_de_decimal(regular * rate), periode,
            ]))
        if overtime > 0:
            rows.append(";".join([
                cfg["mandant"], personal_nr, name,
                str(cfg["lohnart_overtime"]), "Überstunden +25%",
                _fmt_de_decimal(overtime), _fmt_de_decimal(rate * 1.25),
                _fmt_de_decimal(overtime * rate * 1.25), periode,
            ]))

    content = "\r\n".join(rows) + "\r\n"
    encoded = content.encode("cp1252", errors="replace")
    filename = f"DATEV_Lohnstunden_{year}_{month:02d}.csv"
    return StreamingResponse(
        iter([encoded]),
        media_type="text/csv; charset=windows-1252",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/datev/preview")
async def datev_preview(
    year: int,
    month: int,
    merchant_id: str = "test-merchant",
):
    """JSON-Preview der DATEV-Export-Zeilen (vor dem Download zum Validieren)."""
    report_data = await get_monthly_report(year, month, merchant_id)
    if not report_data["success"]:
        raise HTTPException(500, "Report-Generierung fehlgeschlagen")

    cfg = await _get_datev_config(merchant_id)
    entries = []
    for entry in report_data["report"]:
        net_hours = float(entry.get("net_hours") or 0)
        overtime = float(entry.get("overtime_hours") or 0)
        regular = max(0.0, net_hours - overtime)
        rate = float(entry.get("hourly_rate") or 0)
        personal_nr = entry.get("personal_nr") or entry.get("staff_id") or entry.get("staff_email", "")[:10]
        if regular > 0:
            entries.append({
                "personal_nr": personal_nr,
                "name": entry.get("staff_name"),
                "lohnart": cfg["lohnart_regular"],
                "bezeichnung": "Stundenlohn",
                "stunden": round(regular, 2),
                "stundensatz": rate,
                "betrag": round(regular * rate, 2),
            })
        if overtime > 0:
            entries.append({
                "personal_nr": personal_nr,
                "name": entry.get("staff_name"),
                "lohnart": cfg["lohnart_overtime"],
                "bezeichnung": "Überstunden +25%",
                "stunden": round(overtime, 2),
                "stundensatz": round(rate * 1.25, 2),
                "betrag": round(overtime * rate * 1.25, 2),
            })

    return {
        "success": True,
        "period": f"{month:02d}/{year}",
        "merchant_id": merchant_id,
        "config": cfg,
        "total_entries": len(entries),
        "total_hours": round(sum(e["stunden"] for e in entries), 2),
        "total_amount": round(sum(e["betrag"] for e in entries), 2),
        "entries": entries,
    }


@router.post("/datev/config")
async def update_datev_config(
    merchant_id: str,
    berater_nr: Optional[str] = None,
    mandant_nr: Optional[str] = None,
    wj_beginn: Optional[str] = None,
    lohnart_regular: Optional[int] = None,
    lohnart_overtime: Optional[int] = None,
):
    """Speichert DATEV-Konfiguration (Berater-Nr, Mandant-Nr, Lohnarten) für Merchant."""
    update_doc = {}
    if berater_nr is not None:
        update_doc["datev_config.berater_nr"] = berater_nr
    if mandant_nr is not None:
        update_doc["datev_config.mandant_nr"] = mandant_nr
    if wj_beginn is not None:
        update_doc["datev_config.wj_beginn"] = wj_beginn
    if lohnart_regular is not None:
        update_doc["datev_config.lohnart_regular"] = lohnart_regular
    if lohnart_overtime is not None:
        update_doc["datev_config.lohnart_overtime"] = lohnart_overtime
    if not update_doc:
        raise HTTPException(400, "Keine Änderungen angegeben")
    await db.pos_merchants.update_one(
        {"merchant_id": merchant_id},
        {"$set": update_doc},
        upsert=True,
    )
    cfg = await _get_datev_config(merchant_id)
    return {"success": True, "config": cfg}
