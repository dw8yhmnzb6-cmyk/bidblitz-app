"""Central BidBlitz admin project registry.

This endpoint exposes only non-secret navigation metadata. Project authentication
remains isolated until each project has been connected to BidBlitz ID/SSO.
"""
from fastapi import APIRouter, HTTPException, Request
from core.security import get_current_user

router = APIRouter(prefix="/api/admin/projects", tags=["admin-projects"])

PROJECTS = [
    {"id":"bidblitz","name":"BidBlitz","description":"Super App & Haupt-Admin","url":"/admin","admin_url":"/admin","status":"connected","sso":True},
    {"id":"eyes","name":"Eyes.BidBlitz","description":"Face Search","url":"https://eyes.bidblitz.ae","admin_url":"https://eyes.bidblitz.ae","status":"online","sso":False},
    {"id":"trade","name":"Trade BidBlitz","description":"Trading Dashboard","url":"https://trade.bidblitz.ae","admin_url":"https://trade.bidblitz.ae","status":"online","sso":False},
    {"id":"nex","name":"BidBlitz NEX","description":"AI Workflow Plattform","url":"https://nex.bidblitz.ae","admin_url":"https://nex.bidblitz.ae","status":"online","sso":False},
    {"id":"stack","name":"BidBlitz Stack","description":"Infrastruktur & Developer Stack","url":"https://stack.bidblitz.ae","admin_url":"https://stack.bidblitz.ae","status":"dev","sso":False},
    {"id":"aion","name":"AION","description":"KI-Assistent & Brain","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"power","name":"Power BidBlitz","description":"Powerbank Sharing","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"charging","name":"Charging.BidBlitz","description":"Charging Zubehör","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"verify","name":"BidBlitz Verify","description":"Identitätsprüfung","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"passport","name":"BidBlitz Passport","description":"Digital Product Passport","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"games","name":"Game.BidBlitz","description":"Games Plattform","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"iptv","name":"BidBlitz IPTV","description":"TV & Streaming Plattform","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"the-eye","name":"The Eye","description":"Global Intelligence Dashboard","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"veysca","name":"VEYSCA","description":"Security & Web Risk","url":None,"admin_url":None,"status":"pending","sso":False},
    {"id":"conformexa","name":"Conformexa","description":"EU Compliance","url":None,"admin_url":None,"status":"pending","sso":False},
]


@router.get("")
async def list_admin_projects(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return {
        "owner": {
            "email": user.get("canonical_email") or user.get("email"),
            "role": user.get("role"),
        },
        "projects": PROJECTS,
        "sso_rollout": {
            "enabled": False,
            "message": "BidBlitz ID SSO wird projektweise aktiviert.",
        },
    }
