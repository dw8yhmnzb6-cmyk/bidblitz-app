"""
Payroll Export & Reports
========================
Monthly reports, CSV exports, DATEV placeholder
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
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
    """DATEV Export Placeholder (coming soon)"""
    return {
        "success": True,
        "message": "DATEV Export coming soon",
        "format": "CSV (DATEV-compatible)",
        "period": {"year": year, "month": month}
    }
