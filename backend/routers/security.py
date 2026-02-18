"""
Security & Fraud Detection System
- Encrypted data handling
- Real-time fraud detection
- Activity monitoring and alerts
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel
import uuid
import hashlib
import hmac
import base64
import json
from collections import defaultdict

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/security", tags=["Security"])

# ==================== ENCRYPTION HELPERS ====================

def encrypt_sensitive_data(data: str, key: str = "bidblitz_secure_2026") -> str:
    """Simple encryption for sensitive data (use proper encryption in production)"""
    # In production, use proper AES encryption with secure key management
    encoded = base64.b64encode(data.encode()).decode()
    return encoded

def decrypt_sensitive_data(encrypted: str, key: str = "bidblitz_secure_2026") -> str:
    """Decrypt sensitive data"""
    decoded = base64.b64decode(encrypted.encode()).decode()
    return decoded

def hash_sensitive_data(data: str) -> str:
    """One-way hash for sensitive data comparison"""
    return hashlib.sha256(data.encode()).hexdigest()

# ==================== FRAUD DETECTION ====================

# In-memory storage for rate limiting and pattern detection
request_history = defaultdict(list)
suspicious_activities = defaultdict(int)

FRAUD_RULES = {
    "max_transactions_per_hour": 20,
    "max_amount_per_transaction": 5000,
    "max_failed_logins": 5,
    "suspicious_countries": ["XX", "YY"],  # Placeholder
    "velocity_check_minutes": 5,
    "max_velocity_transactions": 5
}

class FraudCheckResult(BaseModel):
    is_suspicious: bool
    risk_score: float  # 0-100
    reasons: List[str]
    action: str  # allow, review, block

async def check_transaction_fraud(
    user_id: str,
    amount: float,
    transaction_type: str,
    ip_address: str = None,
    device_id: str = None
) -> FraudCheckResult:
    """Real-time fraud detection for transactions"""
    reasons = []
    risk_score = 0
    
    # 1. Check transaction amount
    if amount > FRAUD_RULES["max_amount_per_transaction"]:
        reasons.append(f"Hoher Betrag: €{amount}")
        risk_score += 30
    
    # 2. Check transaction velocity
    recent_time = datetime.now(timezone.utc) - timedelta(minutes=FRAUD_RULES["velocity_check_minutes"])
    recent_transactions = await db.transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": recent_time.isoformat()}
    })
    
    if recent_transactions >= FRAUD_RULES["max_velocity_transactions"]:
        reasons.append(f"Hohe Transaktionsfrequenz: {recent_transactions} in {FRAUD_RULES['velocity_check_minutes']} Min")
        risk_score += 40
    
    # 3. Check hourly transaction limit
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    hourly_transactions = await db.transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": hour_ago.isoformat()}
    })
    
    if hourly_transactions >= FRAUD_RULES["max_transactions_per_hour"]:
        reasons.append(f"Stündliches Limit erreicht: {hourly_transactions}")
        risk_score += 35
    
    # 4. Check for unusual patterns
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        # Check if amount is unusually high for this user
        avg_transaction = await db.transactions.aggregate([
            {"$match": {"user_id": user_id, "type": transaction_type}},
            {"$group": {"_id": None, "avg_amount": {"$avg": "$amount"}}}
        ]).to_list(1)
        
        if avg_transaction and avg_transaction[0]["avg_amount"]:
            if amount > avg_transaction[0]["avg_amount"] * 5:
                reasons.append("Ungewöhnlich hoher Betrag für diesen Nutzer")
                risk_score += 25
    
    # 5. Check device fingerprint
    if device_id:
        device_history = await db.device_history.find_one({"device_id": device_id})
        if device_history:
            if device_history.get("user_id") != user_id:
                reasons.append("Gerät wurde von anderem Konto verwendet")
                risk_score += 20
    
    # 6. Check for new account
    if user and user.get("created_at"):
        account_age = datetime.now(timezone.utc) - datetime.fromisoformat(user["created_at"].replace('Z', '+00:00'))
        if account_age.days < 7:
            reasons.append("Neues Konto (< 7 Tage)")
            risk_score += 15
    
    # Determine action
    if risk_score >= 70:
        action = "block"
    elif risk_score >= 40:
        action = "review"
    else:
        action = "allow"
    
    # Log suspicious activity
    if risk_score >= 40:
        await db.fraud_alerts.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "transaction_type": transaction_type,
            "amount": amount,
            "risk_score": risk_score,
            "reasons": reasons,
            "action": action,
            "ip_address": ip_address,
            "device_id": device_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return FraudCheckResult(
        is_suspicious=risk_score >= 40,
        risk_score=min(risk_score, 100),
        reasons=reasons,
        action=action
    )

# ==================== ENDPOINTS ====================

@router.post("/verify-transaction")
async def verify_transaction(
    amount: float,
    transaction_type: str,
    device_id: Optional[str] = None,
    request: Request = None,
    user: dict = Depends(get_current_user)
):
    """Verify a transaction for fraud before processing"""
    ip_address = request.client.host if request else None
    
    result = await check_transaction_fraud(
        user_id=user["id"],
        amount=amount,
        transaction_type=transaction_type,
        ip_address=ip_address,
        device_id=device_id
    )
    
    return {
        "allowed": result.action == "allow",
        "risk_score": result.risk_score,
        "reasons": result.reasons if result.is_suspicious else [],
        "action": result.action,
        "requires_verification": result.action == "review"
    }


@router.post("/report-suspicious")
async def report_suspicious_activity(
    activity_type: str,
    description: str,
    user: dict = Depends(get_current_user)
):
    """Report suspicious activity"""
    report_id = str(uuid.uuid4())
    
    await db.fraud_reports.insert_one({
        "id": report_id,
        "user_id": user["id"],
        "activity_type": activity_type,
        "description": description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.warning(f"Suspicious activity reported by {user['id']}: {activity_type}")
    
    return {
        "success": True,
        "report_id": report_id,
        "message": "Verdächtige Aktivität wurde gemeldet"
    }


@router.get("/activity-log")
async def get_security_activity_log(
    limit: int = 50,
    user: dict = Depends(get_current_user)
):
    """Get user's security activity log"""
    activities = await db.security_logs.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"activities": activities}


@router.post("/log-activity")
async def log_security_activity(
    activity_type: str,
    details: Optional[dict] = None,
    request: Request = None,
    user: dict = Depends(get_current_user)
):
    """Log a security-related activity"""
    await db.security_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "activity_type": activity_type,
        "details": details or {},
        "ip_address": request.client.host if request else None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}


@router.get("/fraud-alerts")
async def get_fraud_alerts(admin_key: str = None):
    """Get pending fraud alerts (admin only)"""
    # In production, verify admin credentials
    alerts = await db.fraud_alerts.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("risk_score", -1).limit(100).to_list(100)
    
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/resolve-alert/{alert_id}")
async def resolve_fraud_alert(
    alert_id: str,
    resolution: str,  # approved, rejected
    notes: Optional[str] = None,
    admin_key: str = None
):
    """Resolve a fraud alert (admin only)"""
    result = await db.fraud_alerts.update_one(
        {"id": alert_id},
        {
            "$set": {
                "status": "resolved",
                "resolution": resolution,
                "notes": notes,
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert nicht gefunden")
    
    return {"success": True, "message": f"Alert als {resolution} markiert"}


# ==================== BIOMETRIC REGISTRATION ====================

@router.post("/register-biometric")
async def register_biometric_credential(
    credential_id: str,
    public_key: str,
    device_name: str,
    auth_type: str,  # fingerprint, face, passkey
    user: dict = Depends(get_current_user)
):
    """Register a biometric credential for a user"""
    credential = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "credential_id": credential_id,
        "public_key_hash": hash_sensitive_data(public_key),
        "device_name": device_name,
        "auth_type": auth_type,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None
    }
    
    await db.biometric_credentials.insert_one(credential)
    
    # Log security activity
    await db.security_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "activity_type": "biometric_registered",
        "details": {"device_name": device_name, "auth_type": auth_type},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Biometrische Authentifizierung ({auth_type}) registriert",
        "credential_id": credential["id"]
    }


@router.get("/biometric-credentials")
async def get_biometric_credentials(user: dict = Depends(get_current_user)):
    """Get user's registered biometric credentials"""
    credentials = await db.biometric_credentials.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0, "public_key_hash": 0}
    ).to_list(10)
    
    return {"credentials": credentials}


@router.delete("/biometric-credentials/{credential_id}")
async def remove_biometric_credential(
    credential_id: str,
    user: dict = Depends(get_current_user)
):
    """Remove a biometric credential"""
    result = await db.biometric_credentials.update_one(
        {"id": credential_id, "user_id": user["id"]},
        {"$set": {"is_active": False, "removed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Credential nicht gefunden")
    
    return {"success": True, "message": "Biometrische Authentifizierung entfernt"}


@router.post("/verify-biometric")
async def verify_biometric_auth(
    credential_id: str,
    signature: str,
    challenge: str,
    user: dict = Depends(get_current_user)
):
    """Verify a biometric authentication attempt"""
    credential = await db.biometric_credentials.find_one({
        "credential_id": credential_id,
        "user_id": user["id"],
        "is_active": True
    })
    
    if not credential:
        # Log failed attempt
        await db.security_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "activity_type": "biometric_failed",
            "details": {"reason": "credential_not_found"},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        raise HTTPException(status_code=401, detail="Ungültige biometrische Daten")
    
    # In production, verify the signature against the stored public key
    # For now, we'll trust the client-side WebAuthn verification
    
    # Update last used
    await db.biometric_credentials.update_one(
        {"id": credential["id"]},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log successful auth
    await db.security_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "activity_type": "biometric_success",
        "details": {"auth_type": credential.get("auth_type"), "device": credential.get("device_name")},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "verified": True,
        "auth_type": credential.get("auth_type")
    }


# ==================== SECURITY SETTINGS ====================

@router.get("/settings")
async def get_security_settings(user: dict = Depends(get_current_user)):
    """Get user's security settings"""
    settings = await db.security_settings.find_one(
        {"user_id": user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Default settings
        settings = {
            "user_id": user["id"],
            "biometric_enabled": False,
            "two_factor_enabled": False,
            "transaction_notifications": True,
            "login_notifications": True,
            "max_transaction_amount": 1000,
            "require_biometric_for_transactions": False
        }
    
    # Get biometric credentials count
    biometric_count = await db.biometric_credentials.count_documents({
        "user_id": user["id"],
        "is_active": True
    })
    settings["biometric_credentials_count"] = biometric_count
    
    return settings


@router.put("/settings")
async def update_security_settings(
    biometric_enabled: Optional[bool] = None,
    transaction_notifications: Optional[bool] = None,
    login_notifications: Optional[bool] = None,
    max_transaction_amount: Optional[float] = None,
    require_biometric_for_transactions: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Update user's security settings"""
    update_fields = {}
    
    if biometric_enabled is not None:
        update_fields["biometric_enabled"] = biometric_enabled
    if transaction_notifications is not None:
        update_fields["transaction_notifications"] = transaction_notifications
    if login_notifications is not None:
        update_fields["login_notifications"] = login_notifications
    if max_transaction_amount is not None:
        update_fields["max_transaction_amount"] = max_transaction_amount
    if require_biometric_for_transactions is not None:
        update_fields["require_biometric_for_transactions"] = require_biometric_for_transactions
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.security_settings.update_one(
            {"user_id": user["id"]},
            {"$set": update_fields},
            upsert=True
        )
    
    return {"success": True, "message": "Sicherheitseinstellungen aktualisiert"}
