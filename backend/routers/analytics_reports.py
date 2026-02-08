"""
Weekly Analytics Email Reports Router
Sends scheduled analytics summaries to admins
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import uuid
import os
import asyncio

from config import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/analytics-reports", tags=["analytics-reports"])

# Try to import email provider
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY")
    HAS_RESEND = bool(resend.api_key)
except ImportError:
    HAS_RESEND = False


class ReportSubscription(BaseModel):
    email: str
    frequency: str = "weekly"  # weekly, daily, monthly
    include_device_stats: bool = True
    include_revenue_stats: bool = True
    include_user_stats: bool = True
    include_auction_stats: bool = True


class ReportSettings(BaseModel):
    enabled: bool = True
    recipients: List[str] = []
    frequency: str = "weekly"
    send_day: int = 1  # Monday = 0, Sunday = 6
    send_hour: int = 8  # 8 AM


async def get_weekly_analytics_data():
    """Gather analytics data for the past 7 days"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    end_date = datetime.now(timezone.utc).isoformat()
    
    # User stats
    total_users = await db.users.count_documents({})
    new_users = await db.users.count_documents({
        "created_at": {"$gte": start_date}
    })
    active_users = await db.users.count_documents({
        "last_active": {"$gte": start_date}
    })
    
    # Revenue stats
    revenue_pipeline = [
        {"$match": {
            "created_at": {"$gte": start_date},
            "status": {"$in": ["completed", "paid"]}
        }},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$amount"},
            "order_count": {"$sum": 1}
        }}
    ]
    revenue_result = await db.payments.aggregate(revenue_pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    order_count = revenue_result[0]["order_count"] if revenue_result else 0
    
    # Auction stats
    auctions_created = await db.auctions.count_documents({
        "created_at": {"$gte": start_date}
    })
    auctions_completed = await db.auctions.count_documents({
        "end_time": {"$gte": start_date, "$lte": end_date},
        "status": "ended"
    })
    total_bids = await db.bids.count_documents({
        "created_at": {"$gte": start_date}
    })
    
    # Device stats
    device_pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {"_id": "$device_type", "count": {"$sum": 1}}}
    ]
    device_breakdown = await db.device_analytics.aggregate(device_pipeline).to_list(length=10)
    
    device_stats = {"mobile": 0, "tablet": 0, "desktop": 0, "total": 0}
    for d in device_breakdown:
        device_type = d["_id"] or "unknown"
        if device_type in device_stats:
            device_stats[device_type] = d["count"]
            device_stats["total"] += d["count"]
    
    return {
        "period": {
            "start": start_date,
            "end": end_date,
            "days": 7
        },
        "users": {
            "total": total_users,
            "new": new_users,
            "active": active_users
        },
        "revenue": {
            "total": total_revenue,
            "orders": order_count,
            "avg_order": total_revenue / max(1, order_count)
        },
        "auctions": {
            "created": auctions_created,
            "completed": auctions_completed,
            "total_bids": total_bids
        },
        "devices": device_stats
    }


def generate_html_report(data: dict, report_date: str) -> str:
    """Generate HTML email content for the analytics report"""
    
    mobile_percent = (data["devices"]["mobile"] / max(1, data["devices"]["total"])) * 100
    desktop_percent = (data["devices"]["desktop"] / max(1, data["devices"]["total"])) * 100
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">📊 Wöchentlicher Analytics-Report</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">{report_date}</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
                <!-- User Stats -->
                <div style="margin-bottom: 25px;">
                    <h2 style="color: #1E293B; font-size: 18px; margin: 0 0 15px 0; display: flex; align-items: center;">
                        👥 Nutzer-Statistiken
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div style="background: #F1F5F9; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #64748B; font-size: 12px;">Gesamt</div>
                            <div style="color: #1E293B; font-size: 24px; font-weight: bold;">{data['users']['total']:,}</div>
                        </div>
                        <div style="background: #ECFDF5; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #10B981; font-size: 12px;">Neu</div>
                            <div style="color: #10B981; font-size: 24px; font-weight: bold;">+{data['users']['new']:,}</div>
                        </div>
                        <div style="background: #EEF2FF; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #6366F1; font-size: 12px;">Aktiv</div>
                            <div style="color: #6366F1; font-size: 24px; font-weight: bold;">{data['users']['active']:,}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Revenue Stats -->
                <div style="margin-bottom: 25px;">
                    <h2 style="color: #1E293B; font-size: 18px; margin: 0 0 15px 0;">
                        💰 Umsatz
                    </h2>
                    <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); padding: 20px; border-radius: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="color: #92400E; font-size: 12px;">Gesamtumsatz</div>
                                <div style="color: #78350F; font-size: 32px; font-weight: bold;">€{data['revenue']['total']:,.2f}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="color: #92400E; font-size: 12px;">Bestellungen</div>
                                <div style="color: #78350F; font-size: 20px; font-weight: bold;">{data['revenue']['orders']:,}</div>
                            </div>
                        </div>
                        <div style="margin-top: 10px; color: #92400E; font-size: 13px;">
                            Ø Bestellwert: €{data['revenue']['avg_order']:.2f}
                        </div>
                    </div>
                </div>
                
                <!-- Auction Stats -->
                <div style="margin-bottom: 25px;">
                    <h2 style="color: #1E293B; font-size: 18px; margin: 0 0 15px 0;">
                        🔨 Auktionen
                    </h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                        <div style="background: #F1F5F9; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #64748B; font-size: 12px;">Erstellt</div>
                            <div style="color: #1E293B; font-size: 24px; font-weight: bold;">{data['auctions']['created']:,}</div>
                        </div>
                        <div style="background: #ECFDF5; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #10B981; font-size: 12px;">Abgeschlossen</div>
                            <div style="color: #10B981; font-size: 24px; font-weight: bold;">{data['auctions']['completed']:,}</div>
                        </div>
                        <div style="background: #FEF2F2; padding: 15px; border-radius: 10px; text-align: center;">
                            <div style="color: #EF4444; font-size: 12px;">Gebote</div>
                            <div style="color: #EF4444; font-size: 24px; font-weight: bold;">{data['auctions']['total_bids']:,}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Device Stats -->
                <div style="margin-bottom: 15px;">
                    <h2 style="color: #1E293B; font-size: 18px; margin: 0 0 15px 0;">
                        📱 Geräte-Verteilung
                    </h2>
                    <div style="background: #F8FAFC; padding: 20px; border-radius: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; background: #EC4899; border-radius: 50%;"></div>
                                <span style="color: #64748B;">Mobile</span>
                            </div>
                            <span style="color: #1E293B; font-weight: bold;">{data['devices']['mobile']:,} ({mobile_percent:.1f}%)</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; background: #8B5CF6; border-radius: 50%;"></div>
                                <span style="color: #64748B;">Tablet</span>
                            </div>
                            <span style="color: #1E293B; font-weight: bold;">{data['devices']['tablet']:,}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; background: #06B6D4; border-radius: 50%;"></div>
                                <span style="color: #64748B;">Desktop</span>
                            </div>
                            <span style="color: #1E293B; font-weight: bold;">{data['devices']['desktop']:,} ({desktop_percent:.1f}%)</span>
                        </div>
                        <!-- Progress Bar -->
                        <div style="margin-top: 15px; height: 8px; background: #E2E8F0; border-radius: 4px; overflow: hidden; display: flex;">
                            <div style="width: {mobile_percent}%; background: #EC4899;"></div>
                            <div style="width: {(data['devices']['tablet'] / max(1, data['devices']['total'])) * 100}%; background: #8B5CF6;"></div>
                            <div style="width: {desktop_percent}%; background: #06B6D4;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #F8FAFC; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="color: #64748B; font-size: 13px; margin: 0;">
                    Dieser Report wird automatisch jeden Montag gesendet.<br>
                    <a href="#" style="color: #7C3AED;">Report-Einstellungen ändern</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


async def send_analytics_email(recipient: str, html_content: str, subject: str):
    """Send analytics email using Resend"""
    if not HAS_RESEND:
        print(f"📧 [MOCK] Would send email to {recipient}: {subject}")
        return True
    
    try:
        resend.Emails.send({
            "from": "BidBlitz Analytics <analytics@bidblitz.de>",
            "to": [recipient],
            "subject": subject,
            "html": html_content
        })
        return True
    except Exception as e:
        print(f"Email send error: {e}")
        return False


@router.get("/settings")
async def get_report_settings(user: dict = Depends(get_current_user)):
    """Get current report settings"""
    if user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = await db.analytics_report_settings.find_one({"type": "weekly"})
    if not settings:
        # Default settings
        settings = {
            "type": "weekly",
            "enabled": True,
            "recipients": [],
            "frequency": "weekly",
            "send_day": 0,  # Monday
            "send_hour": 8,
            "include_device_stats": True,
            "include_revenue_stats": True,
            "include_user_stats": True,
            "include_auction_stats": True
        }
    
    # Remove MongoDB _id
    settings.pop("_id", None)
    return settings


@router.post("/settings")
async def update_report_settings(
    settings: ReportSettings,
    user: dict = Depends(get_current_user)
):
    """Update report settings"""
    if user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.analytics_report_settings.update_one(
        {"type": "weekly"},
        {"$set": {
            "type": "weekly",
            "enabled": settings.enabled,
            "recipients": settings.recipients,
            "frequency": settings.frequency,
            "send_day": settings.send_day,
            "send_hour": settings.send_hour,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": user.get("id")
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Einstellungen gespeichert"}


@router.post("/subscribe")
async def subscribe_to_reports(
    subscription: ReportSubscription,
    user: dict = Depends(get_current_user)
):
    """Subscribe to analytics reports"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    await db.analytics_report_subscriptions.update_one(
        {"email": subscription.email},
        {"$set": {
            "email": subscription.email,
            "frequency": subscription.frequency,
            "include_device_stats": subscription.include_device_stats,
            "include_revenue_stats": subscription.include_revenue_stats,
            "include_user_stats": subscription.include_user_stats,
            "include_auction_stats": subscription.include_auction_stats,
            "subscribed_at": datetime.now(timezone.utc).isoformat(),
            "subscribed_by": user.get("id"),
            "is_active": True
        }},
        upsert=True
    )
    
    return {"success": True, "message": f"E-Mail {subscription.email} für Reports abonniert"}


@router.delete("/unsubscribe/{email}")
async def unsubscribe_from_reports(
    email: str,
    user: dict = Depends(get_current_user)
):
    """Unsubscribe from analytics reports"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    await db.analytics_report_subscriptions.update_one(
        {"email": email},
        {"$set": {"is_active": False}}
    )
    
    return {"success": True, "message": f"E-Mail {email} abgemeldet"}


@router.post("/send-now")
async def send_report_now(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Manually trigger sending of analytics report"""
    if user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get report data
    data = await get_weekly_analytics_data()
    report_date = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    html_content = generate_html_report(data, f"Woche bis {report_date}")
    
    # Get subscribers
    subscribers = await db.analytics_report_subscriptions.find(
        {"is_active": True}
    ).to_list(length=100)
    
    # Also check settings recipients
    settings = await db.analytics_report_settings.find_one({"type": "weekly"})
    recipients = set()
    
    for sub in subscribers:
        recipients.add(sub["email"])
    
    if settings and settings.get("recipients"):
        for email in settings["recipients"]:
            recipients.add(email)
    
    # Add current admin user if no recipients
    if not recipients:
        admin_email = user.get("email")
        if admin_email:
            recipients.add(admin_email)
    
    # Send emails in background
    sent_count = 0
    for email in recipients:
        success = await send_analytics_email(
            email, 
            html_content, 
            f"📊 BidBlitz Wöchentlicher Analytics-Report - {report_date}"
        )
        if success:
            sent_count += 1
    
    # Log the send
    await db.analytics_report_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "weekly",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "recipients": list(recipients),
        "sent_count": sent_count,
        "triggered_by": user.get("id"),
        "data_summary": {
            "users_total": data["users"]["total"],
            "revenue_total": data["revenue"]["total"],
            "auctions_completed": data["auctions"]["completed"]
        }
    })
    
    return {
        "success": True,
        "message": f"Report an {sent_count} Empfänger gesendet",
        "recipients": list(recipients),
        "has_email_service": HAS_RESEND
    }


@router.get("/preview")
async def preview_report(user: dict = Depends(get_current_user)):
    """Preview the analytics report without sending"""
    if user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    data = await get_weekly_analytics_data()
    report_date = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    html_content = generate_html_report(data, f"Woche bis {report_date}")
    
    return {
        "html": html_content,
        "data": data,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/logs")
async def get_report_logs(
    limit: int = 20,
    user: dict = Depends(get_current_user)
):
    """Get history of sent reports"""
    if user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logs = await db.analytics_report_logs.find(
        {},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(length=limit)
    
    return {"logs": logs}
