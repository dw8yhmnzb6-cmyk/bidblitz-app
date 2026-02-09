"""User Reports Router - Report issues and suspicious activity"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid

from config import db, logger
from dependencies import get_current_user, get_admin_user

router = APIRouter(prefix="/user-reports", tags=["User Reports"])

# Report categories
REPORT_CATEGORIES = {
    "technical": "Technisches Problem",
    "auction": "Auktionsproblem",
    "payment": "Zahlungsproblem",
    "user": "Nutzerverhalten",
    "fraud": "Betrugsverdacht",
    "other": "Sonstiges"
}

PRIORITY_LEVELS = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "urgent": 4
}

# ==================== SCHEMAS ====================

class ReportCreate(BaseModel):
    category: str
    subject: str
    description: str
    related_auction_id: Optional[str] = None
    related_user_id: Optional[str] = None
    screenshots: Optional[List[str]] = None

class ReportResponse(BaseModel):
    response: str
    status: str  # in_progress, resolved, closed

# ==================== USER ENDPOINTS ====================

@router.get("/categories")
async def get_report_categories():
    """Get available report categories"""
    return {"categories": REPORT_CATEGORIES}

@router.post("/submit")
async def submit_report(report: ReportCreate, user: dict = Depends(get_current_user)):
    """Submit a new report"""
    user_id = user["id"]
    
    if report.category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Ungültige Kategorie")
    
    # Auto-determine priority
    priority = "medium"
    if report.category in ["fraud", "payment"]:
        priority = "high"
    elif report.category == "technical":
        priority = "medium"
    
    # Create report
    report_id = str(uuid.uuid4())
    report_doc = {
        "id": report_id,
        "user_id": user_id,
        "user_email": user.get("email"),
        "user_name": user.get("name", user.get("username")),
        "category": report.category,
        "category_name": REPORT_CATEGORIES[report.category],
        "subject": report.subject,
        "description": report.description,
        "related_auction_id": report.related_auction_id,
        "related_user_id": report.related_user_id,
        "screenshots": report.screenshots or [],
        "priority": priority,
        "status": "open",  # open, in_progress, resolved, closed
        "messages": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.insert_one(report_doc)
    
    logger.info(f"New report {report_id} submitted by {user_id}: {report.category}")
    
    return {
        "success": True,
        "report_id": report_id,
        "message": "Dein Bericht wurde eingereicht. Wir melden uns schnellstmöglich."
    }

@router.get("/my-reports")
async def get_my_reports(user: dict = Depends(get_current_user)):
    """Get user's submitted reports"""
    reports = await db.user_reports.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"reports": reports}

@router.get("/my-reports/{report_id}")
async def get_report_detail(report_id: str, user: dict = Depends(get_current_user)):
    """Get specific report details"""
    report = await db.user_reports.find_one(
        {"id": report_id, "user_id": user["id"]},
        {"_id": 0}
    )
    
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    
    return {"report": report}

@router.post("/my-reports/{report_id}/message")
async def add_message_to_report(report_id: str, message: str, user: dict = Depends(get_current_user)):
    """Add a follow-up message to a report"""
    report = await db.user_reports.find_one({
        "id": report_id,
        "user_id": user["id"],
        "status": {"$ne": "closed"}
    })
    
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden oder bereits geschlossen")
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "from": "user",
        "user_id": user["id"],
        "user_name": user.get("name", user.get("username")),
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.update_one(
        {"id": report_id},
        {
            "$push": {"messages": message_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "message_id": message_doc["id"]}

# ==================== QUICK REPORT ENDPOINTS ====================

@router.post("/quick/auction/{auction_id}")
async def quick_report_auction(auction_id: str, reason: str, user: dict = Depends(get_current_user)):
    """Quick report an auction issue"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    report_id = str(uuid.uuid4())
    await db.user_reports.insert_one({
        "id": report_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "category": "auction",
        "category_name": "Auktionsproblem",
        "subject": f"Problem mit Auktion {auction_id[:8]}",
        "description": reason,
        "related_auction_id": auction_id,
        "priority": "medium",
        "status": "open",
        "quick_report": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "report_id": report_id}

@router.post("/quick/user/{reported_user_id}")
async def quick_report_user(reported_user_id: str, reason: str, user: dict = Depends(get_current_user)):
    """Quick report a user"""
    if reported_user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Du kannst dich nicht selbst melden")
    
    reported = await db.users.find_one({"id": reported_user_id}, {"_id": 0, "name": 1, "username": 1})
    
    if not reported:
        raise HTTPException(status_code=404, detail="Nutzer nicht gefunden")
    
    report_id = str(uuid.uuid4())
    await db.user_reports.insert_one({
        "id": report_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "category": "user",
        "category_name": "Nutzerverhalten",
        "subject": f"Meldung: {reported.get('name', reported.get('username', 'Nutzer'))}",
        "description": reason,
        "related_user_id": reported_user_id,
        "priority": "medium",
        "status": "open",
        "quick_report": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "report_id": report_id}

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/all")
async def get_all_reports(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    admin: dict = Depends(get_admin_user)
):
    """Get all reports with filters"""
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    
    reports = await db.user_reports.find(
        query,
        {"_id": 0}
    ).sort([
        ("priority", -1),
        ("created_at", 1)
    ]).limit(limit).to_list(limit)
    
    return {"reports": reports, "count": len(reports)}

@router.get("/admin/stats")
async def get_report_stats(admin: dict = Depends(get_admin_user)):
    """Get report statistics"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    total = await db.user_reports.count_documents({})
    open_count = await db.user_reports.count_documents({"status": "open"})
    in_progress = await db.user_reports.count_documents({"status": "in_progress"})
    resolved = await db.user_reports.count_documents({"status": "resolved"})
    
    # This week
    new_this_week = await db.user_reports.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # By category
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_category = await db.user_reports.aggregate(category_pipeline).to_list(10)
    
    # High priority open
    urgent = await db.user_reports.count_documents({
        "status": "open",
        "priority": {"$in": ["high", "urgent"]}
    })
    
    return {
        "total": total,
        "by_status": {
            "open": open_count,
            "in_progress": in_progress,
            "resolved": resolved
        },
        "new_this_week": new_this_week,
        "by_category": {c["_id"]: c["count"] for c in by_category},
        "urgent_open": urgent
    }

@router.put("/admin/{report_id}/status")
async def update_report_status(
    report_id: str,
    status: str,
    admin: dict = Depends(get_admin_user)
):
    """Update report status"""
    valid_statuses = ["open", "in_progress", "resolved", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    result = await db.user_reports.update_one(
        {"id": report_id},
        {"$set": {
            "status": status,
            "updated_by": admin["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    
    return {"success": True}

@router.put("/admin/{report_id}/priority")
async def update_report_priority(
    report_id: str,
    priority: str,
    admin: dict = Depends(get_admin_user)
):
    """Update report priority"""
    if priority not in PRIORITY_LEVELS:
        raise HTTPException(status_code=400, detail="Ungültige Priorität")
    
    result = await db.user_reports.update_one(
        {"id": report_id},
        {"$set": {
            "priority": priority,
            "updated_by": admin["id"],
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    
    return {"success": True}

@router.post("/admin/{report_id}/respond")
async def respond_to_report(
    report_id: str,
    response: ReportResponse,
    admin: dict = Depends(get_admin_user)
):
    """Add admin response to report"""
    report = await db.user_reports.find_one({"id": report_id})
    
    if not report:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    
    message_doc = {
        "id": str(uuid.uuid4()),
        "from": "admin",
        "admin_id": admin["id"],
        "admin_name": admin.get("name", "Support"),
        "message": response.response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.update_one(
        {"id": report_id},
        {
            "$push": {"messages": message_doc},
            "$set": {
                "status": response.status,
                "updated_by": admin["id"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Send notification to user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": report["user_id"],
        "title": "Antwort auf deinen Bericht",
        "message": f"Dein Bericht '{report['subject'][:30]}...' wurde beantwortet",
        "type": "support",
        "link": f"/reports/{report_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}

@router.put("/admin/{report_id}/assign")
async def assign_report(
    report_id: str,
    assignee_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Assign report to a staff member"""
    result = await db.user_reports.update_one(
        {"id": report_id},
        {"$set": {
            "assigned_to": assignee_id,
            "assigned_by": admin["id"],
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "status": "in_progress"
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bericht nicht gefunden")
    
    return {"success": True}


user_reports_router = router
