"""
Push Notification Service für Staff Management
===============================================
Send push notifications to staff before shift starts
"""
import os
import json
from datetime import datetime, timezone, timedelta
import httpx

ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID")
ONESIGNAL_API_KEY = os.getenv("ONESIGNAL_API_KEY")

async def send_shift_reminder(staff_email, staff_name, shift_title, shift_start, minutes_before=30):
    """
    Send push notification reminder before shift
    
    Args:
        staff_email: Email to identify user
        staff_name: Name for personalization
        shift_title: Shift title
        shift_start: Shift start datetime (ISO string)
        minutes_before: Minutes before shift to send notification
    """
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        print("⚠️ OneSignal not configured - skipping push notification")
        return {"success": False, "reason": "not_configured"}
    
    # Calculate send time
    shift_dt = datetime.fromisoformat(shift_start)
    send_at = shift_dt - timedelta(minutes=minutes_before)
    
    if send_at <= datetime.now(timezone.utc):
        print("⚠️ Shift too soon - cannot schedule notification")
        return {"success": False, "reason": "too_late"}
    
    # Prepare notification
    notification_data = {
        "app_id": ONESIGNAL_APP_ID,
        "include_external_user_ids": [staff_email],
        "headings": {"en": f"Schicht in {minutes_before} Minuten", "de": f"Schicht in {minutes_before} Minuten"},
        "contents": {
            "en": f"Hi {staff_name}, deine Schicht '{shift_title}' beginnt bald!",
            "de": f"Hi {staff_name}, deine Schicht '{shift_title}' beginnt bald!"
        },
        "send_after": send_at.isoformat(),
        "data": {
            "type": "shift_reminder",
            "shift_title": shift_title,
            "shift_start": shift_start
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://onesignal.com/api/v1/notifications",
                json=notification_data,
                headers={
                    "Authorization": f"Basic {ONESIGNAL_API_KEY}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                return {"success": True, "notification_id": result.get("id"), "send_at": send_at.isoformat()}
            else:
                print(f"❌ OneSignal error: {response.status_code} - {response.text}")
                return {"success": False, "reason": "api_error", "status": response.status_code}
                
    except Exception as e:
        print(f"❌ Push notification failed: {str(e)}")
        return {"success": False, "reason": "exception", "error": str(e)}


async def send_leave_status_notification(staff_email, staff_name, leave_type, status, start_date, end_date):
    """
    Send notification when leave request is approved/rejected
    """
    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        return {"success": False, "reason": "not_configured"}
    
    status_text = "genehmigt" if status == "approved" else "abgelehnt"
    leave_text = "Urlaub" if leave_type == "vacation" else "Krankmeldung" if leave_type == "sick" else "Antrag"
    
    notification_data = {
        "app_id": ONESIGNAL_APP_ID,
        "include_external_user_ids": [staff_email],
        "headings": {"de": f"{leave_text} {status_text}"},
        "contents": {
            "de": f"Hi {staff_name}, dein {leave_text} vom {start_date} bis {end_date} wurde {status_text}."
        },
        "data": {
            "type": "leave_status",
            "leave_type": leave_type,
            "status": status
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://onesignal.com/api/v1/notifications",
                json=notification_data,
                headers={
                    "Authorization": f"Basic {ONESIGNAL_API_KEY}",
                    "Content-Type": "application/json"
                },
                timeout=10.0
            )
            
            return {"success": response.status_code == 200}
                
    except Exception as e:
        print(f"❌ Push notification failed: {str(e)}")
        return {"success": False, "error": str(e)}
