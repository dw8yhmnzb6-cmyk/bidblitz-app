"""Authenticated realtime WebSocket for The Eye admin dashboard."""

from __future__ import annotations

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.security import get_current_user_from_token
from core.the_eye_access import THE_EYE_ROLES, TheEyeAccess, resolve_the_eye_role
from core.the_eye_live import the_eye_live_hub


router = APIRouter()


@router.websocket("/api/the-eye/ws")
async def the_eye_websocket(websocket: WebSocket):
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Not authenticated"})
        await websocket.close(code=4401)
        return

    try:
        user = await get_current_user_from_token(token)
    except Exception:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Invalid session"})
        await websocket.close(code=4401)
        return

    role = resolve_the_eye_role(user)
    if role not in THE_EYE_ROLES or role == "public":
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "The Eye realtime access is not allowed for this role",
        })
        await websocket.close(code=4403)
        return

    access = TheEyeAccess(user=user, role=role)
    await the_eye_live_hub.connect(websocket, access)
    try:
        # The acknowledgement can fail if the browser disconnects immediately.
        # Keep it inside the cleanup guard so no stale subscriber remains.
        await websocket.send_json({
            "type": "connected",
            "payload": {"service": "the-eye", "role": role},
        })
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                if not isinstance(message, dict):
                    await websocket.close(code=1003)
                    return
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except ValueError:
                await websocket.close(code=1003)
                return
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "keepalive"})
    except WebSocketDisconnect:
        pass
    finally:
        await the_eye_live_hub.disconnect(websocket)
