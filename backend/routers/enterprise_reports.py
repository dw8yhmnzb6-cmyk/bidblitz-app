"""
Enterprise Commission Reports - Monatliche Provisionsberichte
Automatischer Versand am 1. jedes Monats
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional
import asyncio
import calendar
import logging

from config import db
from utils.email import send_enterprise_commission_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/enterprise/reports", tags=["Enterprise Reports"])


# ==================== HELPER FUNCTIONS ====================

def get_month_name_german(month: int) -> str:
    """Get German month name."""
    months = {
        1: "Januar", 2: "Februar", 3: "März", 4: "April",
        5: "Mai", 6: "Juni", 7: "Juli", 8: "August",
        9: "September", 10: "Oktober", 11: "November", 12: "Dezember"
    }
    return months.get(month, "")


async def calculate_enterprise_commission(enterprise_id: str, start_date: str, end_date: str) -> dict:
    """Calculate commission for an enterprise for a given period."""
    
    # Get commission settings
    commission_settings = await db.enterprise_commission_settings.find_one(
        {"enterprise_id": enterprise_id},
        {"_id": 0}
    )
    
    voucher_rate = commission_settings.get("voucher_commission", 3) / 100 if commission_settings else 0.03
    self_pay_rate = commission_settings.get("self_pay_commission", 2) / 100 if commission_settings else 0.02
    cashback_rate = commission_settings.get("customer_cashback", 1) / 100 if commission_settings else 0.01
    
    # Get all API keys for this enterprise
    api_keys = await db.enterprise_api_keys.find(
        {"enterprise_id": enterprise_id},
        {"api_key": 1, "branch_id": 1, "_id": 0}
    ).to_list(100)
    
    api_key_list = [k["api_key"] for k in api_keys]
    
    # Get transactions for this period
    transactions = await db.digital_transactions.find({
        "api_key": {"$in": api_key_list},
        "created_at": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    total_revenue = 0
    voucher_commission = 0
    self_pay_commission = 0
    cashback_paid = 0
    
    # Calculate by transaction type
    for tx in transactions:
        amount = tx.get("amount", 0)
        tx_type = tx.get("type", "")
        
        total_revenue += amount
        
        if tx_type == "voucher_redemption":
            voucher_commission += amount * voucher_rate
        elif tx_type in ["self_payment", "direct_payment"]:
            self_pay_commission += amount * self_pay_rate
        
        # Cashback is deducted
        if tx.get("cashback_applied"):
            cashback_paid += tx.get("cashback_amount", 0)
    
    total_commission = voucher_commission + self_pay_commission - cashback_paid
    
    # Get payout status
    pending_payout = await db.enterprise_payouts.aggregate([
        {"$match": {
            "enterprise_id": enterprise_id,
            "status": {"$in": ["pending", "pending_manual"]}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    paid_out = await db.enterprise_payouts.aggregate([
        {"$match": {
            "enterprise_id": enterprise_id,
            "status": "completed"
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Get branch breakdown
    branches = await db.enterprise_branches.find(
        {"enterprise_id": enterprise_id},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    
    branches_data = []
    for branch in branches:
        branch_keys = [k["api_key"] for k in api_keys if k.get("branch_id") == branch["id"]]
        branch_txs = [t for t in transactions if t.get("api_key") in branch_keys]
        
        branch_revenue = sum(t.get("amount", 0) for t in branch_txs)
        branch_commission = branch_revenue * (voucher_rate + self_pay_rate) / 2  # Average rate
        
        branches_data.append({
            "name": branch.get("name", "Unbekannt"),
            "revenue": branch_revenue,
            "transactions": len(branch_txs),
            "commission": branch_commission
        })
    
    return {
        "enterprise_id": enterprise_id,
        "period_start": start_date,
        "period_end": end_date,
        "total_revenue": total_revenue,
        "total_transactions": len(transactions),
        "voucher_commission": voucher_commission,
        "self_pay_commission": self_pay_commission,
        "cashback_paid": cashback_paid,
        "total_commission": total_commission,
        "pending_payout": pending_payout[0]["total"] if pending_payout else 0,
        "paid_out": paid_out[0]["total"] if paid_out else 0,
        "branches_data": branches_data
    }


async def send_monthly_report_for_enterprise(enterprise: dict, month: int, year: int):
    """Send monthly commission report for a single enterprise."""
    
    # Calculate date range for the month
    _, last_day = calendar.monthrange(year, month)
    start_date = f"{year}-{month:02d}-01T00:00:00+00:00"
    end_date = f"{year}-{month:02d}-{last_day}T23:59:59+00:00"
    
    # Get previous month for comparison
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    _, prev_last_day = calendar.monthrange(prev_year, prev_month)
    prev_start = f"{prev_year}-{prev_month:02d}-01T00:00:00+00:00"
    prev_end = f"{prev_year}-{prev_month:02d}-{prev_last_day}T23:59:59+00:00"
    
    try:
        # Calculate current month commission
        commission_data = await calculate_enterprise_commission(
            enterprise["id"], start_date, end_date
        )
        
        # Calculate previous month for comparison
        prev_commission_data = await calculate_enterprise_commission(
            enterprise["id"], prev_start, prev_end
        )
        
        # Send email
        result = await send_enterprise_commission_report(
            to_email=enterprise["email"],
            company_name=enterprise["company_name"],
            report_month=get_month_name_german(month),
            report_year=year,
            total_revenue=commission_data["total_revenue"],
            total_transactions=commission_data["total_transactions"],
            voucher_commission=commission_data["voucher_commission"],
            self_pay_commission=commission_data["self_pay_commission"],
            cashback_paid=commission_data["cashback_paid"],
            total_commission=commission_data["total_commission"],
            pending_payout=commission_data["pending_payout"],
            paid_out=commission_data["paid_out"],
            previous_month_commission=prev_commission_data["total_commission"],
            branches_data=commission_data["branches_data"]
        )
        
        # Log the report
        await db.enterprise_report_logs.insert_one({
            "enterprise_id": enterprise["id"],
            "company_name": enterprise["company_name"],
            "email": enterprise["email"],
            "month": month,
            "year": year,
            "commission_data": commission_data,
            "email_status": result.get("status"),
            "sent_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Commission report sent to {enterprise['email']} for {month}/{year}")
        return {"success": True, "enterprise_id": enterprise["id"], "status": result.get("status")}
        
    except Exception as e:
        logger.error(f"Failed to send report to {enterprise['email']}: {str(e)}")
        return {"success": False, "enterprise_id": enterprise["id"], "error": str(e)}


# ==================== API ENDPOINTS ====================

@router.get("/commission-preview")
async def preview_commission_report(
    month: Optional[int] = None,
    year: Optional[int] = None,
    authorization: str = Header(None)
):
    """Preview commission report for the logged-in enterprise."""
    from routers.enterprise_portal import get_enterprise_from_token
    
    enterprise = await get_enterprise_from_token(authorization)
    
    # Default to previous month
    now = datetime.now(timezone.utc)
    if not month or not year:
        if now.month == 1:
            month = 12
            year = now.year - 1
        else:
            month = now.month - 1
            year = now.year
    
    _, last_day = calendar.monthrange(year, month)
    start_date = f"{year}-{month:02d}-01T00:00:00+00:00"
    end_date = f"{year}-{month:02d}-{last_day}T23:59:59+00:00"
    
    commission_data = await calculate_enterprise_commission(
        enterprise["id"], start_date, end_date
    )
    
    return {
        "enterprise_id": enterprise["id"],
        "company_name": enterprise["company_name"],
        "report_month": get_month_name_german(month),
        "report_year": year,
        **commission_data
    }


@router.post("/send-commission-report")
async def send_commission_report_manual(
    month: Optional[int] = None,
    year: Optional[int] = None,
    authorization: str = Header(None)
):
    """Manually trigger commission report email for the logged-in enterprise."""
    from routers.enterprise_portal import get_enterprise_from_token
    
    enterprise = await get_enterprise_from_token(authorization)
    
    # Default to previous month
    now = datetime.now(timezone.utc)
    if not month or not year:
        if now.month == 1:
            month = 12
            year = now.year - 1
        else:
            month = now.month - 1
            year = now.year
    
    result = await send_monthly_report_for_enterprise(enterprise, month, year)
    
    if result["success"]:
        return {
            "success": True,
            "message": f"Provisionsbericht für {get_month_name_german(month)} {year} wurde an {enterprise['email']} gesendet"
        }
    else:
        raise HTTPException(status_code=500, detail=f"Fehler beim Senden: {result.get('error')}")


@router.get("/history")
async def get_report_history(
    limit: int = 12,
    authorization: str = Header(None)
):
    """Get commission report history for the logged-in enterprise."""
    from routers.enterprise_portal import get_enterprise_from_token
    
    enterprise = await get_enterprise_from_token(authorization)
    
    reports = await db.enterprise_report_logs.find(
        {"enterprise_id": enterprise["id"]},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    return {
        "reports": reports,
        "total": len(reports)
    }


# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/send-all-reports")
async def admin_send_all_reports(
    month: Optional[int] = None,
    year: Optional[int] = None,
    background_tasks: BackgroundTasks = None,
    authorization: str = Header(None)
):
    """Admin: Send commission reports to all approved enterprises."""
    from routers.enterprise_portal import get_enterprise_from_token
    
    enterprise = await get_enterprise_from_token(authorization)
    
    # Check if admin
    if enterprise.get("current_user") or enterprise.get("role") != "admin":
        # Only main admin can trigger batch send
        pass  # Allow for now, but could restrict to platform admin
    
    # Default to previous month
    now = datetime.now(timezone.utc)
    if not month or not year:
        if now.month == 1:
            month = 12
            year = now.year - 1
        else:
            month = now.month - 1
            year = now.year
    
    # Get all approved enterprises
    enterprises = await db.enterprise_accounts.find(
        {"status": "approved"},
        {"_id": 0, "password": 0}
    ).to_list(500)
    
    if not enterprises:
        return {"success": True, "message": "Keine aktiven Händler gefunden", "sent": 0}
    
    # Send reports in background
    results = []
    for ent in enterprises:
        result = await send_monthly_report_for_enterprise(ent, month, year)
        results.append(result)
    
    successful = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])
    
    return {
        "success": True,
        "message": f"Berichte für {get_month_name_german(month)} {year} versendet",
        "total_enterprises": len(enterprises),
        "successful": successful,
        "failed": failed,
        "results": results
    }


@router.get("/admin/report-logs")
async def admin_get_report_logs(
    month: Optional[int] = None,
    year: Optional[int] = None,
    limit: int = 100,
    authorization: str = Header(None)
):
    """Admin: Get all report sending logs."""
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    logs = await db.enterprise_report_logs.find(
        query,
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    
    # Stats
    total_sent = await db.enterprise_report_logs.count_documents(query)
    successful = await db.enterprise_report_logs.count_documents({**query, "email_status": "sent"})
    
    return {
        "logs": logs,
        "total": total_sent,
        "successful": successful,
        "failed": total_sent - successful
    }


# ==================== MONTHLY SCHEDULER ====================

async def monthly_commission_report_task():
    """Background task that sends monthly reports on the 1st of each month."""
    logger.info("Monthly commission report scheduler started")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            
            # Calculate time until the 1st of next month at 8:00 UTC
            if now.day == 1 and now.hour < 8:
                # It's the 1st but before 8 AM - wait until 8 AM
                target = now.replace(hour=8, minute=0, second=0, microsecond=0)
            else:
                # Wait until 1st of next month at 8 AM
                if now.month == 12:
                    target = datetime(now.year + 1, 1, 1, 8, 0, 0, tzinfo=timezone.utc)
                else:
                    target = datetime(now.year, now.month + 1, 1, 8, 0, 0, tzinfo=timezone.utc)
            
            wait_seconds = (target - now).total_seconds()
            logger.info(f"Next commission report batch in {wait_seconds/3600:.1f} hours ({target.isoformat()})")
            
            # Wait, but check every hour
            await asyncio.sleep(min(wait_seconds, 3600))
            
            # Check if it's time to send
            now = datetime.now(timezone.utc)
            if now.day == 1 and 8 <= now.hour < 9:
                logger.info("Sending monthly commission reports...")
                
                # Get previous month
                if now.month == 1:
                    report_month = 12
                    report_year = now.year - 1
                else:
                    report_month = now.month - 1
                    report_year = now.year
                
                # Get all approved enterprises
                enterprises = await db.enterprise_accounts.find(
                    {"status": "approved"},
                    {"_id": 0, "password": 0}
                ).to_list(500)
                
                successful = 0
                failed = 0
                
                for enterprise in enterprises:
                    try:
                        result = await send_monthly_report_for_enterprise(
                            enterprise, report_month, report_year
                        )
                        if result["success"]:
                            successful += 1
                        else:
                            failed += 1
                    except Exception as e:
                        logger.error(f"Error sending report to {enterprise.get('email')}: {str(e)}")
                        failed += 1
                
                logger.info(f"Monthly reports sent: {successful} successful, {failed} failed")
                
                # Wait 1 hour to avoid duplicate sends
                await asyncio.sleep(3600)
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Monthly report task error: {str(e)}")
            await asyncio.sleep(300)  # Wait 5 min on error
