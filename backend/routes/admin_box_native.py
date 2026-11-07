"""Native BOX inbox proxy using the existing current-owner authentication."""
import json
import os
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from routes.admin_projects import require_owner
from core.box_admin_delegation import PATH, cursor, issue, DelegationRejected

router = APIRouter(prefix="/api/admin/box", tags=["native-box-admin"])
TARGET = "https://box.bidblitz.ae" + PATH

@router.get("/partner-applications")
async def native_box_applications(request: Request):
    try:
        user = await require_owner(request)
    except HTTPException as error:
        error.headers = {**(error.headers or {}), "Cache-Control": "no-store, private"}
        raise
    if os.getenv("BIDBLITZ_NATIVE_BOX_INBOX_ENABLED", "false") != "true":
        raise HTTPException(503, "Interne BOX-Anbindung ist noch nicht aktiviert.")
    if set(request.query_params) - {"after"} or len(request.query_params.multi_items()) > 1:
        raise HTTPException(400, "Ungültiger Cursor.")
    try:
        after = cursor(request.query_params.get("after", "0"))
    except DelegationRejected:
        raise HTTPException(400, "Ungültiger Cursor.") from None
    try:
        subject = str(user.get("_id") or user.get("id") or "")
        token = issue(os.getenv("BIDBLITZ_NATIVE_BOX_INBOX_SECRET", ""), subject, after)
    except DelegationRejected:
        raise HTTPException(503, "Interne BOX-Anbindung ist noch nicht konfiguriert.") from None
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False, trust_env=False) as client:
            async with client.stream("GET", TARGET, params={"after": after},
                    headers={"X-BidBlitz-Box-Delegation": token, "Accept": "application/json"}) as result:
                if result.status_code == 403:
                    raise HTTPException(403, "Für dieses Konto fehlt die BOX-Adminberechtigung.")
                if result.status_code != 200:
                    raise HTTPException(502, "BOX-Posteingang ist derzeit nicht erreichbar.")
                chunks, size = [], 0
                async for chunk in result.aiter_bytes():
                    size += len(chunk)
                    if size > 131072:
                        raise HTTPException(502, "Ungültige BOX-Antwort.")
                    chunks.append(chunk)
                data = json.loads(b"".join(chunks))
                if (not isinstance(data, dict)
                    or set(data) != {"applications", "has_more", "next_cursor"}
                    or not isinstance(data["applications"], list)
                    or len(data["applications"]) > 50
                    or type(data["has_more"]) is not bool
                    or (data["next_cursor"] is not None and
                        (type(data["next_cursor"]) is not int or data["next_cursor"] < 0))
                    or any(not isinstance(item, dict) for item in data["applications"])):
                    raise HTTPException(502, "Ungültige BOX-Antwort.")
    except (httpx.HTTPError, ValueError, UnicodeError):
        raise HTTPException(502, "BOX-Posteingang ist derzeit nicht erreichbar.") from None
    return JSONResponse(data, headers={"Cache-Control": "no-store, private",
                                      "X-Content-Type-Options": "nosniff"})
