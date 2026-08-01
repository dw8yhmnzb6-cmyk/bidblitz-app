from datetime import datetime, timezone, timedelta

import jwt
from bson import ObjectId
from fastapi import HTTPException, Request

from core.config import COOKIE_SAMESITE, COOKIE_SECURE, JWT_ALGORITHM, JWT_SECRET
from core.database import db
from core.security import hash_password, verify_password

INVESTOR_ACCESS_COOKIE = "investor_portal_access_token"
INVESTOR_REFRESH_COOKIE = "investor_portal_refresh_token"
INVESTOR_ACCESS_MINUTES = 15
INVESTOR_REFRESH_DAYS = 7


def create_investor_access_token(account_id: str, email: str) -> str:
    payload = {
        "sub": account_id,
        "email": email,
        "portal": "investor",
        "type": "investor_access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=INVESTOR_ACCESS_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_investor_refresh_token(account_id: str, email: str) -> str:
    payload = {
        "sub": account_id,
        "email": email,
        "portal": "investor",
        "type": "investor_refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=INVESTOR_REFRESH_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_investor_auth_cookies(response, access_token: str, refresh_token: str):
    response.set_cookie(
        key=INVESTOR_ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=INVESTOR_ACCESS_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=INVESTOR_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=INVESTOR_REFRESH_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_investor_auth_cookies(response):
    response.delete_cookie(key=INVESTOR_ACCESS_COOKIE, path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    response.delete_cookie(key=INVESTOR_REFRESH_COOKIE, path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)


def serialize_investor_account(account: dict) -> dict:
    return {
        "account_id": account.get("account_id") or str(account.get("_id")),
        "email": account.get("email", ""),
        "first_name": account.get("first_name", ""),
        "last_name": account.get("last_name", ""),
        "full_name": f"{account.get('first_name', '')} {account.get('last_name', '')}".strip(),
        "phone": account.get("phone", ""),
        "company": account.get("company", ""),
        "investor_type": account.get("investor_type", "private"),
        "status": account.get("status", "new"),
        "locale": account.get("locale", "de"),
        "created_at": account.get("created_at", ""),
        "last_login_at": account.get("last_login_at", ""),
        "lead_id": account.get("lead_id", ""),
    }


async def get_current_investor_account(request: Request) -> dict:
    token = request.cookies.get(INVESTOR_ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Investor nicht angemeldet")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "investor_access" or payload.get("portal") != "investor":
            raise HTTPException(status_code=401, detail="Ungültiger Investor-Token")
        account_ref = payload.get("sub")
        if not account_ref:
            raise HTTPException(status_code=401, detail="Ungültiger Investor-Token")
        account = await db.investor_accounts.find_one({"account_id": account_ref})
        if not account:
            try:
                account = await db.investor_accounts.find_one({"_id": ObjectId(account_ref)})
            except Exception:
                account = None
        if not account:
            raise HTTPException(status_code=401, detail="Investor-Konto nicht gefunden")
        return account
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Investor-Sitzung abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Investor-Sitzung ungültig")


async def get_current_investor_refresh_payload(request: Request) -> dict:
    token = request.cookies.get(INVESTOR_REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Kein Investor-Refresh-Token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "investor_refresh" or payload.get("portal") != "investor":
            raise HTTPException(status_code=401, detail="Ungültiger Refresh-Token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh-Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Refresh-Token")
