"""Authentication router - Login, Register, 2FA, Password Reset"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
import uuid
import random
import resend

from config import db, logger, RESEND_API_KEY, SENDER_EMAIL, REFERRAL_MIN_DEPOSIT, REFERRER_REWARD_BIDS, REFEREE_REWARD_BIDS
from dependencies import (
    hash_password, verify_password, validate_password_strength, create_token,
    get_current_user, generate_2fa_secret, generate_2fa_qr_code, verify_2fa_code,
    log_security_event, check_login_attempts, check_vpn_proxy, get_client_ip
)
from schemas import (
    UserCreate, UserLogin, ForgotPasswordRequest, VerifyResetCodeRequest,
    ResetPasswordRequest, TwoFactorEnable, TwoFactorDisable
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

if RESEND_API_KEY and RESEND_API_KEY != 're_123_placeholder':
    resend.api_key = RESEND_API_KEY


async def generate_customer_number():
    """Generate unique customer number in format: BID-XXXXXX"""
    while True:
        # Generate 6-digit number
        number = random.randint(100000, 999999)
        customer_number = f"BID-{number}"
        
        # Check if it already exists
        existing = await db.users.find_one({"customer_number": customer_number})
        if not existing:
            return customer_number


# ==================== REGISTER ====================

@router.post("/register")
async def register(user: UserCreate, request: Request):
    client_ip = get_client_ip(request)
    
    # VPN/Proxy check disabled - allow mobile devices and all connections
    # vpn_check = await check_vpn_proxy(client_ip)
    # if vpn_check.get("is_vpn") or vpn_check.get("is_proxy") or vpn_check.get("is_datacenter"):
    #     await log_security_event("registration_blocked_vpn", "unknown", {
    #         "email": user.email,
    #         "vpn_check": vpn_check
    #     }, client_ip)
    #     raise HTTPException(
    #         status_code=403,
    #         detail="VPN, Proxy oder Datacenter-Verbindungen sind nicht erlaubt. Bitte deaktivieren Sie Ihren VPN und versuchen Sie es erneut."
    #     )
    
    # Check IP registration limit
    existing_from_ip = await db.users.count_documents({"registration_ip": client_ip})
    if existing_from_ip >= 2:
        await log_security_event("registration_blocked_ip_limit", "unknown", {
            "email": user.email,
            "existing_accounts": existing_from_ip
        }, client_ip)
        raise HTTPException(
            status_code=403,
            detail="Maximal 2 Konten pro Haushalt erlaubt. Kontaktieren Sie den Support bei Fragen."
        )
    
    # Check if email exists
    existing = await db.users.find_one({"email": user.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    # Validate password strength
    is_valid, message = validate_password_strength(user.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Handle referral
    referred_by = None
    if user.referral_code:
        referrer = await db.users.find_one({"referral_code": user.referral_code.upper()})
        if referrer:
            referred_by = referrer["id"]
    
    user_id = str(uuid.uuid4())
    referral_code = user_id[:8].upper()
    customer_number = await generate_customer_number()
    
    new_user = {
        "id": user_id,
        "email": user.email.lower(),
        "password": hash_password(user.password),
        "name": user.name,
        "customer_number": customer_number,  # Unique customer number for payments
        "bids_balance": 10,  # Welcome bids
        "is_admin": False,
        "is_blocked": False,
        # KYC Verification - User needs admin approval
        "kyc_status": "pending",  # pending, approved, rejected
        "kyc_id_front": None,  # URL to ID front image
        "kyc_id_back": None,   # URL to ID back image
        "kyc_selfie": None,    # URL to selfie with ID
        "kyc_submitted_at": None,
        "kyc_reviewed_at": None,
        "kyc_reviewed_by": None,
        "kyc_rejection_reason": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "won_auctions": [],
        "total_bids_placed": 0,
        "source": user.source,
        "referral_code": referral_code,
        "referred_by": referred_by,
        "referral_reward_pending": referred_by is not None,  # Reward pending until €5 deposit
        "total_deposits": 0.0,
        "registration_ip": client_ip,
        "last_login_ip": None,
        "two_factor_secret": None,
        "two_factor_enabled": False
    }
    
    await db.users.insert_one(new_user)
    
    # Check if this email is an approved wholesale customer waiting to be linked
    wholesale_customer = await db.wholesale_customers.find_one({"email": user.email.lower(), "user_id": None})
    if wholesale_customer:
        # Link the wholesale customer to this new user
        await db.wholesale_customers.update_one(
            {"id": wholesale_customer["id"]},
            {"$set": {"user_id": user_id}}
        )
        # Mark user as wholesale
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_wholesale": True, "wholesale_id": wholesale_customer["id"]}}
        )
        logger.info(f"🏢 Wholesale customer {wholesale_customer['company_name']} linked to new user {user.email}")
    
    # Log successful registration
    await log_security_event("registration_success", user_id, {
        "email": user.email,
        "referred_by": referred_by,
        "wholesale_linked": wholesale_customer is not None
    }, client_ip)
    
    token = create_token(user_id)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": new_user["email"],
            "name": new_user["name"],
            "bids_balance": new_user["bids_balance"],
            "is_admin": False,
            "referral_code": referral_code
        }
    }

# ==================== LOGIN ====================

@router.post("/login")
async def login(credentials: UserLogin, request: Request):
    client_ip = get_client_ip(request)
    
    # Check login attempts
    can_login, wait_minutes = await check_login_attempts(client_ip, credentials.email)
    if not can_login:
        raise HTTPException(
            status_code=429,
            detail=f"Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie {wait_minutes} Minuten."
        )
    
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user["password"]):
        await log_security_event("login_failed", user["id"] if user else "unknown", {
            "email": credentials.email,
            "reason": "invalid_credentials"
        }, client_ip)
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    if user.get("is_blocked"):
        raise HTTPException(status_code=403, detail="Konto gesperrt. Kontaktieren Sie den Support.")
    
    # Check 2FA
    if user.get("two_factor_enabled") and user.get("two_factor_secret"):
        if not credentials.two_factor_code:
            return {"requires_2fa": True, "message": "Bitte geben Sie Ihren 2FA-Code ein"}
        
        if not verify_2fa_code(user["two_factor_secret"], credentials.two_factor_code):
            await log_security_event("login_failed_2fa", user["id"], {
                "email": credentials.email,
                "reason": "invalid_2fa_code"
            }, client_ip)
            raise HTTPException(status_code=401, detail="Ungültiger 2FA-Code")
    
    # Update last login IP
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login_ip": client_ip}}
    )
    
    await log_security_event("login_success", user["id"], {
        "email": credentials.email
    }, client_ip)
    
    token = create_token(user["id"], user.get("is_admin", False))
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user["bids_balance"],
            "is_admin": user.get("is_admin", False),
            "is_manager": user.get("is_manager", False),
            "role": user.get("role", "user"),
            "two_factor_enabled": user.get("two_factor_enabled", False)
        }
    }

# ==================== GET CURRENT USER ====================

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "bids_balance": user["bids_balance"],
        "is_admin": user.get("is_admin", False),
        "is_vip": user.get("is_vip", False),
        "is_influencer": user.get("is_influencer", False),
        "is_manager": user.get("is_manager", False),
        "role": user.get("role", "user"),
        "influencer_code": user.get("influencer_code"),
        "referral_code": user.get("referral_code", user["id"][:8].upper()),
        "two_factor_enabled": user.get("two_factor_enabled", False),
        "avatar_url": user.get("avatar_url"),
        "vip_status": user.get("vip_status"),
        "vip_period_end": user.get("vip_period_end"),
        "vip_expires_at": user.get("vip_expires_at"),
        "login_streak": user.get("login_streak", 0),
        "last_daily_reward": user.get("last_daily_reward")
    }


# ==================== GOOGLE OAUTH ====================

import httpx

@router.post("/google")
async def google_oauth(session_id: str, request: Request):
    """
    Process Google OAuth session_id from Emergent Auth.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    client_ip = get_client_ip(request)
    
    try:
        # Verify session_id with Emergent Auth
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Ungültige Google-Sitzung")
            
            google_data = response.json()
    except httpx.RequestError as e:
        logger.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Google-Authentifizierung")
    
    email = google_data.get("email", "").lower()
    name = google_data.get("name", "Google User")
    picture = google_data.get("picture", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="E-Mail nicht von Google erhalten")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        # Existing user - update avatar if needed and log in
        if picture and not existing_user.get("avatar_url"):
            await db.users.update_one(
                {"id": existing_user["id"]},
                {"$set": {"avatar_url": picture, "last_login_ip": client_ip}}
            )
        
        await log_security_event("google_login_success", existing_user["id"], {
            "email": email
        }, client_ip)
        
        token = create_token(existing_user["id"], existing_user.get("is_admin", False))
        
        return {
            "token": token,
            "user": {
                "id": existing_user["id"],
                "email": existing_user["email"],
                "name": existing_user["name"],
                "bids_balance": existing_user["bids_balance"],
                "is_admin": existing_user.get("is_admin", False),
                "two_factor_enabled": existing_user.get("two_factor_enabled", False)
            },
            "is_new_user": False
        }
    else:
        # New user - create account
        user_id = str(uuid.uuid4())
        referral_code = user_id[:8].upper()
        
        new_user = {
            "id": user_id,
            "email": email,
            "password": None,  # Google users don't have password
            "name": name,
            "avatar_url": picture,
            "bids_balance": 10,  # Welcome bids
            "is_admin": False,
            "is_blocked": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "won_auctions": [],
            "total_bids_placed": 0,
            "source": "google",
            "referral_code": referral_code,
            "referred_by": None,
            "total_deposits": 0.0,
            "registration_ip": client_ip,
            "last_login_ip": client_ip,
            "two_factor_secret": None,
            "two_factor_enabled": False
        }
        
        await db.users.insert_one(new_user)
        
        await log_security_event("google_registration_success", user_id, {
            "email": email
        }, client_ip)
        
        token = create_token(user_id)
        
        return {
            "token": token,
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "bids_balance": 10,
                "is_admin": False,
                "referral_code": referral_code
            },
            "is_new_user": True
        }


# ==================== DAILY LOGIN REWARD ====================

@router.post("/claim-daily-reward")
async def claim_daily_reward(user: dict = Depends(get_current_user)):
    """Claim daily login reward - users get 1-5 free bids per day"""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    
    # Check if already claimed today
    last_reward = user.get("last_daily_reward")
    if last_reward and last_reward.startswith(today_str):
        raise HTTPException(status_code=400, detail="Tägliche Belohnung bereits abgeholt!")
    
    # Get game config
    config = await db.game_config.find_one({"id": "main"}, {"_id": 0})
    if not config:
        config = {"daily_reward_enabled": True, "daily_reward_min_bids": 1, "daily_reward_max_bids": 5,
                  "streak_bonus_day_7": 10, "streak_bonus_day_14": 20, "streak_bonus_day_30": 50}
    
    if not config.get("daily_reward_enabled", True):
        raise HTTPException(status_code=400, detail="Tägliche Belohnungen sind deaktiviert")
    
    # Calculate streak
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    current_streak = user.get("login_streak", 0)
    
    if last_reward and last_reward.startswith(yesterday_str):
        # Continue streak
        new_streak = current_streak + 1
    else:
        # Reset streak
        new_streak = 1
    
    # Calculate reward (random between min and max)
    min_bids = config.get("daily_reward_min_bids", 1)
    max_bids = config.get("daily_reward_max_bids", 5)
    base_reward = random.randint(min_bids, max_bids)
    
    # Add streak bonus
    streak_bonus = 0
    bonus_message = None
    if new_streak == 7:
        streak_bonus = config.get("streak_bonus_day_7", 10)
        bonus_message = f"🔥 7-Tage-Streak! +{streak_bonus} Bonus-Gebote!"
    elif new_streak == 14:
        streak_bonus = config.get("streak_bonus_day_14", 20)
        bonus_message = f"🔥 14-Tage-Streak! +{streak_bonus} Bonus-Gebote!"
    elif new_streak == 30:
        streak_bonus = config.get("streak_bonus_day_30", 50)
        bonus_message = f"🔥 30-Tage-Streak! +{streak_bonus} Bonus-Gebote!"
    elif new_streak % 7 == 0:
        streak_bonus = 5
        bonus_message = f"🎉 {new_streak}-Tage-Streak! +{streak_bonus} Bonus-Gebote!"
    
    total_reward = base_reward + streak_bonus
    
    # Update user
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$inc": {"bids_balance": total_reward},
            "$set": {
                "last_daily_reward": now.isoformat(),
                "login_streak": new_streak
            }
        }
    )
    
    # Log reward
    await db.daily_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "bids_given": total_reward,
        "base_reward": base_reward,
        "streak_bonus": streak_bonus,
        "streak_day": new_streak,
        "claimed_at": now.isoformat()
    })
    
    # Check for streak achievements
    if new_streak == 7:
        await check_and_grant_achievement(user["id"], "streak_7")
    elif new_streak == 30:
        await check_and_grant_achievement(user["id"], "streak_30")
    
    return {
        "success": True,
        "bids_received": total_reward,
        "base_reward": base_reward,
        "streak_bonus": streak_bonus,
        "current_streak": new_streak,
        "bonus_message": bonus_message,
        "new_balance": user["bids_balance"] + total_reward
    }


@router.get("/daily-reward-status")
async def get_daily_reward_status(user: dict = Depends(get_current_user)):
    """Check if user can claim daily reward"""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    
    last_reward = user.get("last_daily_reward")
    can_claim = not (last_reward and last_reward.startswith(today_str))
    
    # Calculate time until next reward
    next_reward_time = None
    if not can_claim:
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        next_reward_time = tomorrow.isoformat()
    
    return {
        "can_claim": can_claim,
        "current_streak": user.get("login_streak", 0),
        "last_claimed": last_reward,
        "next_reward_time": next_reward_time
    }


# ==================== ACHIEVEMENTS ====================

async def check_and_grant_achievement(user_id: str, achievement_id: str):
    """Helper function to check and grant an achievement"""
    # Check if already has
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    if existing:
        return False
    
    # Achievement definitions (same as admin.py)
    achievements = {
        "first_win": {"bids_reward": 5},
        "wins_10": {"bids_reward": 20},
        "wins_50": {"bids_reward": 100},
        "wins_100": {"bids_reward": 250},
        "night_owl": {"bids_reward": 15},
        "early_bird": {"bids_reward": 5},
        "big_spender": {"bids_reward": 30},
        "lucky_winner": {"bids_reward": 10},
        "streak_7": {"bids_reward": 10},
        "streak_30": {"bids_reward": 50},
        "referral_5": {"bids_reward": 25},
        "beginner_champ": {"bids_reward": 15},
    }
    
    achievement = achievements.get(achievement_id)
    if not achievement:
        return False
    
    # Grant achievement
    await db.user_achievements.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "achievement_id": achievement_id,
        "granted_at": datetime.now(timezone.utc).isoformat(),
        "granted_by": "system"
    })
    
    # Grant bids reward
    if achievement.get("bids_reward", 0) > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": achievement["bids_reward"]}}
        )
    
    logger.info(f"Achievement {achievement_id} granted to user {user_id}")
    return True


@router.get("/achievements")
async def get_user_achievements(user: dict = Depends(get_current_user)):
    """Get user's earned achievements"""
    achievements = await db.user_achievements.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Achievement definitions
    all_achievements = [
        {"id": "first_win", "name": "Erster Sieg", "description": "Gewinne deine erste Auktion", "icon": "🏆", "bids_reward": 5},
        {"id": "wins_10", "name": "Sammler", "description": "Gewinne 10 Auktionen", "icon": "🎯", "bids_reward": 20},
        {"id": "wins_50", "name": "Profi", "description": "Gewinne 50 Auktionen", "icon": "⭐", "bids_reward": 100},
        {"id": "wins_100", "name": "Meister", "description": "Gewinne 100 Auktionen", "icon": "👑", "bids_reward": 250},
        {"id": "night_owl", "name": "Nachteule", "description": "Gewinne 5 Nacht-Auktionen", "icon": "🦉", "bids_reward": 15},
        {"id": "early_bird", "name": "Frühaufsteher", "description": "Biete vor 8 Uhr morgens", "icon": "🐦", "bids_reward": 5},
        {"id": "big_spender", "name": "Großzügig", "description": "Kaufe Gebote für über €100", "icon": "💎", "bids_reward": 30},
        {"id": "lucky_winner", "name": "Glückspilz", "description": "Gewinne mit nur 1 Gebot", "icon": "🍀", "bids_reward": 10},
        {"id": "streak_7", "name": "Wochensieger", "description": "7 Tage Login-Streak", "icon": "🔥", "bids_reward": 10},
        {"id": "streak_30", "name": "Monatssieger", "description": "30 Tage Login-Streak", "icon": "💪", "bids_reward": 50},
        {"id": "referral_5", "name": "Werber", "description": "Werbe 5 Freunde", "icon": "👥", "bids_reward": 25},
        {"id": "beginner_champ", "name": "Anfänger-Champion", "description": "Gewinne 3 Anfänger-Auktionen", "icon": "🎓", "bids_reward": 15},
    ]
    
    earned_ids = {a["achievement_id"] for a in achievements}
    
    return {
        "earned": [a for a in all_achievements if a["id"] in earned_ids],
        "locked": [a for a in all_achievements if a["id"] not in earned_ids],
        "total_earned": len(earned_ids),
        "total_available": len(all_achievements)
    }

# ==================== PASSWORD RESET ====================

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    user = await db.users.find_one({"email": request.email.lower()})
    
    reset_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.password_resets.delete_many({"email": request.email.lower()})
    await db.password_resets.insert_one({
        "email": request.email.lower(),
        "code": reset_code,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response = {"message": "Falls ein Konto existiert, wurde eine E-Mail gesendet"}
    
    if user and RESEND_API_KEY and RESEND_API_KEY != 're_123_placeholder':
        try:
            resend.Emails.send({
                "from": SENDER_EMAIL,
                "to": [request.email],
                "subject": f"Ihr Passwort-Reset-Code: {reset_code}",
                "html": f"""
                <h2>Passwort zurücksetzen</h2>
                <p>Ihr Code lautet: <strong>{reset_code}</strong></p>
                <p>Gültig für 15 Minuten.</p>
                """
            })
        except Exception as e:
            logger.error(f"Failed to send reset email: {e}")
    else:
        response["demo_code"] = reset_code
    
    return response

@router.post("/verify-reset-code")
async def verify_reset_code(request: VerifyResetCodeRequest):
    reset = await db.password_resets.find_one({
        "email": request.email.lower(),
        "code": request.code
    })
    
    if not reset:
        raise HTTPException(status_code=400, detail="Ungültiger Code")
    
    if datetime.fromisoformat(reset["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code abgelaufen")
    
    return {"valid": True}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    reset = await db.password_resets.find_one({
        "email": request.email.lower(),
        "code": request.code
    })
    
    if not reset:
        raise HTTPException(status_code=400, detail="Ungültiger Code")
    
    if datetime.fromisoformat(reset["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code abgelaufen")
    
    is_valid, message = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    await db.users.update_one(
        {"email": request.email.lower()},
        {"$set": {"password": hash_password(request.new_password)}}
    )
    
    await db.password_resets.delete_many({"email": request.email.lower()})
    
    return {"message": "Passwort erfolgreich geändert"}

# ==================== 2FA ENDPOINTS ====================

@router.post("/2fa/setup")
async def setup_2fa(user: dict = Depends(get_current_user)):
    if user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA ist bereits aktiviert")
    
    secret = generate_2fa_secret()
    qr_code = generate_2fa_qr_code(user["email"], secret)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_secret": secret}}
    )
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "message": "Scannen Sie den QR-Code mit Ihrer Authenticator-App"
    }

@router.post("/2fa/enable")
async def enable_2fa(request: TwoFactorEnable, user: dict = Depends(get_current_user)):
    if user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA ist bereits aktiviert")
    
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="Bitte richten Sie zuerst 2FA ein")
    
    if not verify_2fa_code(secret, request.code):
        raise HTTPException(status_code=400, detail="Ungültiger Code")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_enabled": True}}
    )
    
    await log_security_event("2fa_enabled", user["id"], {"email": user["email"]})
    
    return {"message": "2FA erfolgreich aktiviert"}

@router.post("/2fa/disable")
async def disable_2fa(request: TwoFactorDisable, user: dict = Depends(get_current_user)):
    if not user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA ist nicht aktiviert")
    
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    
    if not verify_2fa_code(user["two_factor_secret"], request.code):
        raise HTTPException(status_code=400, detail="Ungültiger 2FA-Code")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_enabled": False, "two_factor_secret": None}}
    )
    
    await log_security_event("2fa_disabled", user["id"], {"email": user["email"]})
    
    return {"message": "2FA erfolgreich deaktiviert"}

# ==================== 2FA BACKUP CODES ====================

import secrets

def generate_backup_codes(count: int = 10) -> list:
    """Generate backup codes for 2FA"""
    codes = []
    for _ in range(count):
        code = secrets.token_hex(4).upper()  # 8 character hex code
        codes.append(f"{code[:4]}-{code[4:]}")
    return codes

@router.post("/2fa/backup-codes/generate")
async def generate_2fa_backup_codes(user: dict = Depends(get_current_user)):
    """Generate new backup codes (requires 2FA to be enabled)"""
    if not user.get("two_factor_enabled"):
        raise HTTPException(status_code=400, detail="2FA muss zuerst aktiviert sein")
    
    # Generate new codes
    codes = generate_backup_codes(10)
    
    # Hash codes before storing
    from hashlib import sha256
    hashed_codes = [sha256(code.encode()).hexdigest() for code in codes]
    
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "two_factor_backup_codes": hashed_codes,
                "backup_codes_generated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    await log_security_event("backup_codes_generated", user["id"], {"count": len(codes)})
    
    return {
        "message": "Neue Backup-Codes generiert. Speichern Sie diese sicher!",
        "codes": codes,
        "warning": "Diese Codes werden nur einmal angezeigt!"
    }

@router.post("/2fa/backup-codes/verify")
async def verify_backup_code(code: str, user: dict = Depends(get_current_user)):
    """Verify and consume a backup code"""
    from hashlib import sha256
    
    if not user.get("two_factor_backup_codes"):
        raise HTTPException(status_code=400, detail="Keine Backup-Codes vorhanden")
    
    # Clean code format
    clean_code = code.replace("-", "").replace(" ", "").upper()
    if len(clean_code) == 8:
        clean_code = f"{clean_code[:4]}-{clean_code[4:]}"
    
    hashed_input = sha256(clean_code.encode()).hexdigest()
    
    if hashed_input not in user["two_factor_backup_codes"]:
        await log_security_event("backup_code_failed", user["id"], {"reason": "invalid_code"})
        raise HTTPException(status_code=400, detail="Ungültiger Backup-Code")
    
    # Remove used code
    new_codes = [c for c in user["two_factor_backup_codes"] if c != hashed_input]
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"two_factor_backup_codes": new_codes}}
    )
    
    await log_security_event("backup_code_used", user["id"], {"remaining": len(new_codes)})
    
    return {
        "valid": True,
        "message": "Backup-Code verifiziert",
        "remaining_codes": len(new_codes)
    }

@router.get("/2fa/backup-codes/count")
async def get_backup_codes_count(user: dict = Depends(get_current_user)):
    """Get count of remaining backup codes"""
    codes = user.get("two_factor_backup_codes", [])
    return {
        "remaining": len(codes),
        "total": 10,
        "generated_at": user.get("backup_codes_generated_at")
    }

@router.get("/2fa/status")
async def get_2fa_status(user: dict = Depends(get_current_user)):
    """Get comprehensive 2FA status"""
    backup_codes = user.get("two_factor_backup_codes", [])
    
    return {
        "enabled": user.get("two_factor_enabled", False),
        "has_secret": bool(user.get("two_factor_secret")),
        "backup_codes": {
            "remaining": len(backup_codes),
            "generated_at": user.get("backup_codes_generated_at"),
            "low_warning": len(backup_codes) <= 2
        },
        "last_used": user.get("two_factor_last_used"),
        "setup_at": user.get("two_factor_enabled_at")
    }

@router.post("/2fa/verify-only")
async def verify_2fa_code_only(code: str, user: dict = Depends(get_current_user)):
    """Verify a 2FA code without login (for sensitive actions)"""
    if not user.get("two_factor_enabled"):
        return {"valid": True, "message": "2FA nicht aktiviert"}
    
    secret = user.get("two_factor_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA-Secret nicht gefunden")
    
    if verify_2fa_code(secret, code):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"two_factor_last_used": datetime.now(timezone.utc).isoformat()}}
        )
        return {"valid": True, "message": "Code verifiziert"}
    
    # Try backup code
    from hashlib import sha256
    clean_code = code.replace("-", "").replace(" ", "").upper()
    if len(clean_code) == 8:
        clean_code = f"{clean_code[:4]}-{clean_code[4:]}"
    
    hashed_input = sha256(clean_code.encode()).hexdigest()
    backup_codes = user.get("two_factor_backup_codes", [])
    
    if hashed_input in backup_codes:
        # Remove used backup code
        new_codes = [c for c in backup_codes if c != hashed_input]
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"two_factor_backup_codes": new_codes}}
        )
        return {
            "valid": True, 
            "message": "Backup-Code verwendet",
            "backup_code_used": True,
            "remaining_codes": len(new_codes)
        }
    
    raise HTTPException(status_code=400, detail="Ungültiger Code")


# ==================== ADMIN PASSWORD MANAGEMENT ====================

from pydantic import BaseModel as PydanticBaseModel

class AdminChangePasswordRequest(PydanticBaseModel):
    user_id: str
    new_password: str

class AdminChangeOwnPasswordRequest(PydanticBaseModel):
    current_password: str
    new_password: str


@router.post("/admin/change-own-password")
async def admin_change_own_password(
    request: AdminChangeOwnPasswordRequest,
    admin: dict = Depends(get_current_user)
):
    """Admin changes their own password"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Verify current password
    if not verify_password(request.current_password, admin["password"]):
        raise HTTPException(status_code=401, detail="Aktuelles Passwort ist falsch")
    
    # Validate new password strength
    is_valid, message = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Hash and update password
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": admin["id"]},
        {"$set": {
            "password": new_hash,
            "password_changed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_security_event("admin_password_changed", admin["id"], {
        "email": admin["email"],
        "changed_by": "self"
    })
    
    return {"success": True, "message": "Passwort erfolgreich geändert"}


@router.post("/admin/reset-user-password")
async def admin_reset_user_password(
    request: AdminChangePasswordRequest,
    admin: dict = Depends(get_current_user)
):
    """Admin resets any user's password"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    # Find target user
    target_user = await db.users.find_one({"id": request.user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Validate new password strength
    is_valid, message = validate_password_strength(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Hash and update password
    new_hash = hash_password(request.new_password)
    await db.users.update_one(
        {"id": request.user_id},
        {"$set": {
            "password": new_hash,
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
            "password_reset_by_admin": True
        }}
    )
    
    await log_security_event("admin_reset_user_password", admin["id"], {
        "admin_email": admin["email"],
        "target_user_id": request.user_id,
        "target_email": target_user.get("email")
    })
    
    return {
        "success": True, 
        "message": f"Passwort für {target_user.get('email')} erfolgreich zurückgesetzt"
    }


@router.get("/admin/users")
async def admin_get_all_users(
    admin: dict = Depends(get_current_user),
    search: str = None,
    limit: int = 50
):
    """Admin gets list of all users for password management"""
    if not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin-Zugang erforderlich")
    
    query = {}
    if search:
        query = {
            "$or": [
                {"email": {"$regex": search, "$options": "i"}},
                {"name": {"$regex": search, "$options": "i"}}
            ]
        }
    
    users = await db.users.find(
        query,
        {"_id": 0, "password": 0, "two_factor_secret": 0, "two_factor_backup_codes": 0}
    ).limit(limit).to_list(limit)
    
    return {"users": users, "count": len(users)}
