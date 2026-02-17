"""Microsoft OAuth Authentication Router"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
import httpx
import os
import jwt
from datetime import datetime, timezone
import uuid

from config import db, logger
from dependencies import create_token

router = APIRouter(prefix="/auth/microsoft", tags=["Microsoft Auth"])

# Microsoft OAuth Configuration
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID", "common")  # "common" for multi-tenant
MICROSOFT_REDIRECT_URI = os.environ.get("MICROSOFT_REDIRECT_URI", "")

# Microsoft OAuth URLs
MICROSOFT_AUTH_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
MICROSOFT_USERINFO_URL = "https://graph.microsoft.com/v1.0/me"


@router.get("/login")
async def microsoft_login(request: Request):
    """Initiate Microsoft OAuth login"""
    if not MICROSOFT_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")
    
    # Get redirect URI from environment or construct from request
    redirect_uri = MICROSOFT_REDIRECT_URI
    if not redirect_uri:
        redirect_uri = str(request.url_for("microsoft_callback"))
    
    # Build authorization URL
    scope = "openid profile email User.Read"
    state = str(uuid.uuid4())  # CSRF protection
    
    auth_url = (
        f"{MICROSOFT_AUTH_URL}?"
        f"client_id={MICROSOFT_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"response_mode=query&"
        f"scope={scope}&"
        f"state={state}"
    )
    
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def microsoft_callback(request: Request, code: str = None, error: str = None, state: str = None):
    """Handle Microsoft OAuth callback"""
    if error:
        logger.error(f"Microsoft OAuth error: {error}")
        return RedirectResponse(url=f"/login?error=microsoft_auth_failed")
    
    if not code:
        return RedirectResponse(url=f"/login?error=no_code")
    
    try:
        # Get redirect URI
        redirect_uri = MICROSOFT_REDIRECT_URI
        if not redirect_uri:
            redirect_uri = str(request.url_for("microsoft_callback"))
        
        # Exchange code for token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                MICROSOFT_TOKEN_URL,
                data={
                    "client_id": MICROSOFT_CLIENT_ID,
                    "client_secret": MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                    "scope": "openid profile email User.Read"
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                return RedirectResponse(url=f"/login?error=token_exchange_failed")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # Get user info from Microsoft Graph
            user_response = await client.get(
                MICROSOFT_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                logger.error(f"User info failed: {user_response.text}")
                return RedirectResponse(url=f"/login?error=user_info_failed")
            
            ms_user = user_response.json()
        
        # Extract user info
        email = ms_user.get("mail") or ms_user.get("userPrincipalName", "").lower()
        name = ms_user.get("displayName", "")
        microsoft_id = ms_user.get("id")
        
        if not email:
            return RedirectResponse(url=f"/login?error=no_email")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
        
        if existing_user:
            # Update Microsoft ID if not set
            if not existing_user.get("microsoft_id"):
                await db.users.update_one(
                    {"id": existing_user["id"]},
                    {"$set": {"microsoft_id": microsoft_id, "auth_provider": "microsoft"}}
                )
            
            # Create JWT token
            token = create_token(existing_user["id"], existing_user.get("is_admin", False))
            
            logger.info(f"Microsoft login successful for existing user: {email}")
            return RedirectResponse(url=f"/auth/callback?token={token}")
        
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            new_user = {
                "id": user_id,
                "email": email.lower(),
                "name": name,
                "username": name.split()[0] if name else email.split("@")[0],
                "password": None,  # OAuth users don't have password
                "auth_provider": "microsoft",
                "microsoft_id": microsoft_id,
                "bids_balance": 10,  # Welcome bonus
                "is_admin": False,
                "is_vip": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "email_verified": True,  # Microsoft accounts are verified
                "profile_image": None
            }
            
            await db.users.insert_one(new_user)
            
            # Create JWT token
            token = create_token(user_id, False)
            
            logger.info(f"New user created via Microsoft: {email}")
            return RedirectResponse(url=f"/auth/callback?token={token}&new_user=true")
    
    except Exception as e:
        logger.error(f"Microsoft OAuth error: {e}")
        return RedirectResponse(url=f"/login?error=microsoft_auth_error")


microsoft_auth_router = router
