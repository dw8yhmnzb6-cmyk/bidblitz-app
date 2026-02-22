"""
BidBlitz Pay Analytics API
Comprehensive analytics for BidBlitz Pay transactions, revenue, and user statistics
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional
import io
import csv

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/bidblitz-pay-analytics", tags=["BidBlitz Pay Analytics"])


@router.get("/dashboard")
async def get_dashboard_stats(
    admin: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get comprehensive BidBlitz Pay dashboard statistics"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Parse dates
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    else:
        start_dt = datetime.now(timezone.utc) - timedelta(days=30)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    else:
        end_dt = datetime.now(timezone.utc)
    
    date_filter = {
        "created_at": {
            "$gte": start_dt.isoformat(),
            "$lte": end_dt.isoformat()
        }
    }
    
    # === TRANSACTION STATISTICS ===
    
    # Get all POS transactions in date range
    pos_transactions = await db.pos_transactions.find(date_filter, {"_id": 0}).to_list(10000)
    
    # Get all BidBlitz Pay transactions
    bidblitz_transactions = await db.bidblitz_pay_transactions.find(date_filter, {"_id": 0}).to_list(10000)
    
    # Calculate totals
    total_topups = sum(t.get("amount", 0) for t in pos_transactions if t.get("type") == "pos_topup")
    total_topup_count = sum(1 for t in pos_transactions if t.get("type") == "pos_topup")
    total_bonuses = sum(t.get("bonus", 0) for t in pos_transactions if t.get("type") == "pos_topup")
    
    total_payments = sum(t.get("amount", 0) for t in pos_transactions if t.get("type") == "payment")
    total_payment_count = sum(1 for t in pos_transactions if t.get("type") == "payment")
    total_discounts = sum(t.get("discount_amount", 0) or 0 for t in pos_transactions if t.get("type") == "payment")
    
    total_giftcards = sum(t.get("amount", 0) for t in pos_transactions if t.get("type") == "gift_card_redemption")
    total_giftcard_count = sum(1 for t in pos_transactions if t.get("type") == "gift_card_redemption")
    
    # === USER STATISTICS ===
    
    # Get unique customers
    unique_customers = set()
    for t in pos_transactions:
        if t.get("customer_id"):
            unique_customers.add(t["customer_id"])
        if t.get("user_id"):
            unique_customers.add(t["user_id"])
    
    # Get users with BidBlitz balance
    users_with_balance = await db.users.count_documents({"bidblitz_balance": {"$gt": 0}})
    total_balance_in_system = await db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$bidblitz_balance"}}}
    ]).to_list(1)
    total_balance = total_balance_in_system[0]["total"] if total_balance_in_system else 0
    
    # === DAILY BREAKDOWN ===
    daily_stats = {}
    for t in pos_transactions:
        date_str = t.get("created_at", "")[:10]
        if date_str not in daily_stats:
            daily_stats[date_str] = {
                "date": date_str,
                "topups": 0,
                "topup_count": 0,
                "payments": 0,
                "payment_count": 0,
                "bonuses": 0,
                "giftcards": 0
            }
        
        if t.get("type") == "pos_topup":
            daily_stats[date_str]["topups"] += t.get("amount", 0)
            daily_stats[date_str]["topup_count"] += 1
            daily_stats[date_str]["bonuses"] += t.get("bonus", 0)
        elif t.get("type") == "payment":
            daily_stats[date_str]["payments"] += t.get("amount", 0)
            daily_stats[date_str]["payment_count"] += 1
        elif t.get("type") == "gift_card_redemption":
            daily_stats[date_str]["giftcards"] += t.get("amount", 0)
    
    daily_breakdown = sorted(daily_stats.values(), key=lambda x: x["date"], reverse=True)
    
    # === BRANCH/STAFF STATISTICS ===
    branch_stats = {}
    staff_stats = {}
    
    for t in pos_transactions:
        branch = t.get("branch_name") or t.get("branch_id") or "Unbekannt"
        staff = t.get("staff_name") or t.get("staff_id") or "Unbekannt"
        
        if branch not in branch_stats:
            branch_stats[branch] = {"name": branch, "topups": 0, "payments": 0, "total": 0, "count": 0}
        if staff not in staff_stats:
            staff_stats[staff] = {"name": staff, "topups": 0, "payments": 0, "total": 0, "count": 0}
        
        amount = t.get("amount", 0)
        tx_type = t.get("type", "")
        
        if tx_type == "pos_topup":
            branch_stats[branch]["topups"] += amount
            staff_stats[staff]["topups"] += amount
        elif tx_type == "payment":
            branch_stats[branch]["payments"] += amount
            staff_stats[staff]["payments"] += amount
        
        branch_stats[branch]["total"] += amount
        branch_stats[branch]["count"] += 1
        staff_stats[staff]["total"] += amount
        staff_stats[staff]["count"] += 1
    
    # === TOP CUSTOMERS ===
    customer_stats = {}
    for t in pos_transactions:
        customer_id = t.get("customer_id") or t.get("user_id")
        if not customer_id:
            continue
        
        if customer_id not in customer_stats:
            customer_stats[customer_id] = {
                "id": customer_id,
                "name": t.get("customer_name") or "Unbekannt",
                "barcode": t.get("customer_barcode"),
                "topups": 0,
                "payments": 0,
                "total": 0,
                "count": 0
            }
        
        amount = t.get("amount", 0)
        if t.get("type") == "pos_topup":
            customer_stats[customer_id]["topups"] += amount
        elif t.get("type") == "payment":
            customer_stats[customer_id]["payments"] += amount
        
        customer_stats[customer_id]["total"] += amount
        customer_stats[customer_id]["count"] += 1
    
    top_customers = sorted(customer_stats.values(), key=lambda x: x["total"], reverse=True)[:20]
    
    # === HOURLY DISTRIBUTION ===
    hourly_distribution = {str(h).zfill(2): {"hour": h, "topups": 0, "payments": 0, "count": 0} for h in range(24)}
    for t in pos_transactions:
        try:
            hour = datetime.fromisoformat(t.get("created_at", "").replace("Z", "+00:00")).hour
            hour_key = str(hour).zfill(2)
            if t.get("type") == "pos_topup":
                hourly_distribution[hour_key]["topups"] += t.get("amount", 0)
            elif t.get("type") == "payment":
                hourly_distribution[hour_key]["payments"] += t.get("amount", 0)
            hourly_distribution[hour_key]["count"] += 1
        except:
            pass
    
    return {
        "period": {
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat()
        },
        "overview": {
            "total_revenue": total_topups + total_giftcards,
            "total_topups": total_topups,
            "total_topup_count": total_topup_count,
            "total_bonuses_given": total_bonuses,
            "total_payments": total_payments,
            "total_payment_count": total_payment_count,
            "total_discounts_given": total_discounts,
            "total_giftcards": total_giftcards,
            "total_giftcard_count": total_giftcard_count,
            "net_revenue": total_topups + total_giftcards - total_bonuses - total_discounts,
            "average_topup": total_topups / total_topup_count if total_topup_count > 0 else 0,
            "average_payment": total_payments / total_payment_count if total_payment_count > 0 else 0
        },
        "users": {
            "unique_customers": len(unique_customers),
            "users_with_balance": users_with_balance,
            "total_balance_in_system": total_balance
        },
        "daily_breakdown": daily_breakdown[:30],
        "branch_stats": sorted(branch_stats.values(), key=lambda x: x["total"], reverse=True),
        "staff_stats": sorted(staff_stats.values(), key=lambda x: x["total"], reverse=True)[:20],
        "top_customers": top_customers,
        "hourly_distribution": list(hourly_distribution.values())
    }


@router.get("/transactions")
async def get_all_transactions(
    admin: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    transaction_type: Optional[str] = None,
    branch: Optional[str] = None,
    staff: Optional[str] = None,
    customer_id: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    page: int = 1,
    limit: int = 50
):
    """Get paginated list of all BidBlitz Pay transactions with filters"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Build query
    query = {}
    
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" not in query:
            query["created_at"] = {}
        query["created_at"]["$lte"] = end_date
    
    if transaction_type:
        query["type"] = transaction_type
    
    if branch:
        query["$or"] = [{"branch_name": branch}, {"branch_id": branch}]
    
    if staff:
        query["$or"] = [{"staff_name": staff}, {"staff_id": staff}]
    
    if customer_id:
        query["$or"] = [{"customer_id": customer_id}, {"user_id": customer_id}]
    
    if min_amount:
        query["amount"] = {"$gte": min_amount}
    if max_amount:
        if "amount" not in query:
            query["amount"] = {}
        query["amount"]["$lte"] = max_amount
    
    # Get total count
    total = await db.pos_transactions.count_documents(query)
    
    # Get transactions
    skip = (page - 1) * limit
    transactions = await db.pos_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/export/csv")
async def export_transactions_csv(
    admin: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    transaction_type: Optional[str] = None
):
    """Export all transactions as CSV file"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Build query
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" not in query:
            query["created_at"] = {}
        query["created_at"]["$lte"] = end_date
    if transaction_type:
        query["type"] = transaction_type
    
    # Get all transactions
    transactions = await db.pos_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(50000)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    # Header
    writer.writerow([
        "Datum", "Uhrzeit", "Typ", "Betrag (€)", "Bonus (€)", "Rabatt (€)",
        "Kunde", "Kunden-Barcode", "Filiale", "Mitarbeiter", "Transaktions-ID"
    ])
    
    # Data
    for t in transactions:
        created_at = t.get("created_at", "")
        date_part = created_at[:10] if created_at else ""
        time_part = created_at[11:19] if len(created_at) > 19 else ""
        
        tx_type = t.get("type", "")
        type_label = {
            "pos_topup": "Aufladung",
            "payment": "Zahlung",
            "gift_card_redemption": "Gutschein"
        }.get(tx_type, tx_type)
        
        writer.writerow([
            date_part,
            time_part,
            type_label,
            f"{t.get('amount', 0):.2f}".replace(".", ","),
            f"{t.get('bonus', 0):.2f}".replace(".", ","),
            f"{t.get('discount_amount', 0) or 0:.2f}".replace(".", ","),
            t.get("customer_name", ""),
            t.get("customer_barcode", ""),
            t.get("branch_name", ""),
            t.get("staff_name", ""),
            t.get("id", "")
        ])
    
    output.seek(0)
    
    # Generate filename
    now = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"bidblitz_pay_export_{now}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/summary")
async def export_summary_report(
    admin: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Export summary report as CSV"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Get dashboard stats
    stats = await get_dashboard_stats(admin, start_date, end_date)
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    
    # Overview Section
    writer.writerow(["=== BIDBLITZ PAY ANALYSE ==="])
    writer.writerow([f"Zeitraum: {stats['period']['start'][:10]} bis {stats['period']['end'][:10]}"])
    writer.writerow([])
    
    writer.writerow(["=== ÜBERSICHT ==="])
    writer.writerow(["Kennzahl", "Wert"])
    writer.writerow(["Gesamtumsatz", f"€{stats['overview']['total_revenue']:.2f}".replace(".", ",")])
    writer.writerow(["Aufladungen", f"€{stats['overview']['total_topups']:.2f}".replace(".", ",")])
    writer.writerow(["Anzahl Aufladungen", stats['overview']['total_topup_count']])
    writer.writerow(["Durchschnittl. Aufladung", f"€{stats['overview']['average_topup']:.2f}".replace(".", ",")])
    writer.writerow(["Boni ausgegeben", f"€{stats['overview']['total_bonuses_given']:.2f}".replace(".", ",")])
    writer.writerow(["Zahlungen", f"€{stats['overview']['total_payments']:.2f}".replace(".", ",")])
    writer.writerow(["Anzahl Zahlungen", stats['overview']['total_payment_count']])
    writer.writerow(["Rabatte gewährt", f"€{stats['overview']['total_discounts_given']:.2f}".replace(".", ",")])
    writer.writerow(["Gutscheine", f"€{stats['overview']['total_giftcards']:.2f}".replace(".", ",")])
    writer.writerow(["Netto-Umsatz", f"€{stats['overview']['net_revenue']:.2f}".replace(".", ",")])
    writer.writerow([])
    
    writer.writerow(["=== KUNDEN ==="])
    writer.writerow(["Aktive Kunden", stats['users']['unique_customers']])
    writer.writerow(["Kunden mit Guthaben", stats['users']['users_with_balance']])
    writer.writerow(["Gesamt-Guthaben im System", f"€{stats['users']['total_balance_in_system']:.2f}".replace(".", ",")])
    writer.writerow([])
    
    writer.writerow(["=== TAGESÜBERSICHT ==="])
    writer.writerow(["Datum", "Aufladungen", "Anzahl", "Zahlungen", "Anzahl", "Boni"])
    for day in stats['daily_breakdown'][:30]:
        writer.writerow([
            day['date'],
            f"€{day['topups']:.2f}".replace(".", ","),
            day['topup_count'],
            f"€{day['payments']:.2f}".replace(".", ","),
            day['payment_count'],
            f"€{day['bonuses']:.2f}".replace(".", ",")
        ])
    writer.writerow([])
    
    writer.writerow(["=== FILIALEN ==="])
    writer.writerow(["Filiale", "Aufladungen", "Zahlungen", "Gesamt", "Transaktionen"])
    for branch in stats['branch_stats']:
        writer.writerow([
            branch['name'],
            f"€{branch['topups']:.2f}".replace(".", ","),
            f"€{branch['payments']:.2f}".replace(".", ","),
            f"€{branch['total']:.2f}".replace(".", ","),
            branch['count']
        ])
    writer.writerow([])
    
    writer.writerow(["=== TOP KUNDEN ==="])
    writer.writerow(["Name", "Aufladungen", "Zahlungen", "Gesamt", "Transaktionen"])
    for customer in stats['top_customers'][:20]:
        writer.writerow([
            customer['name'],
            f"€{customer['topups']:.2f}".replace(".", ","),
            f"€{customer['payments']:.2f}".replace(".", ","),
            f"€{customer['total']:.2f}".replace(".", ","),
            customer['count']
        ])
    
    output.seek(0)
    
    now = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"bidblitz_pay_summary_{now}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/customer/{customer_id}")
async def get_customer_details(
    customer_id: str,
    admin: dict = Depends(get_current_user)
):
    """Get detailed statistics for a specific customer"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Get customer info
    customer = await db.users.find_one(
        {"$or": [{"id": customer_id}, {"customer_number": customer_id}, {"barcode": customer_id}]},
        {"_id": 0, "password": 0, "two_factor_secret": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Get all transactions for this customer
    transactions = await db.pos_transactions.find(
        {"$or": [{"customer_id": customer["id"]}, {"user_id": customer["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Calculate statistics
    total_topups = sum(t.get("amount", 0) for t in transactions if t.get("type") == "pos_topup")
    total_payments = sum(t.get("amount", 0) for t in transactions if t.get("type") == "payment")
    total_bonuses = sum(t.get("bonus", 0) for t in transactions if t.get("type") == "pos_topup")
    
    return {
        "customer": {
            "id": customer["id"],
            "name": customer.get("name"),
            "email": customer.get("email"),
            "customer_number": customer.get("customer_number"),
            "barcode": customer.get("barcode"),
            "bidblitz_balance": customer.get("bidblitz_balance", 0),
            "created_at": customer.get("created_at")
        },
        "statistics": {
            "total_topups": total_topups,
            "total_payments": total_payments,
            "total_bonuses_received": total_bonuses,
            "total_transactions": len(transactions),
            "current_balance": customer.get("bidblitz_balance", 0)
        },
        "recent_transactions": transactions[:50]
    }
