"""In-process realtime fanout for The Eye.

The first implementation is intentionally dependency-light. It can later be
backed by Redis pub/sub without changing the public broadcast interface.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from fastapi import WebSocket

from core.the_eye_access import TheEyeAccess
from core.the_eye_data_safety import sanitize_the_eye_payload


class TheEyeLiveHub:
    def __init__(self) -> None:
        self._clients: Dict[WebSocket, TheEyeAccess] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        access: TheEyeAccess,
    ) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients[websocket] = access

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.pop(websocket, None)

    async def broadcast(self, event_type: str, payload: Dict[str, Any]) -> None:
        message = {
            "type": event_type,
            "payload": sanitize_the_eye_payload(payload),
        }
        async with self._lock:
            clients = list(self._clients.items())

        stale = []
        safe_payload = message["payload"]
        for client, access in clients:
            if not access.can_receive_realtime(event_type, safe_payload):
                continue
            try:
                await client.send_json(message)
            except Exception:
                stale.append(client)

        if stale:
            async with self._lock:
                for client in stale:
                    self._clients.pop(client, None)


the_eye_live_hub = TheEyeLiveHub()


async def broadcast_the_eye_event(event_type: str, payload: Dict[str, Any]) -> None:
    await the_eye_live_hub.broadcast(event_type, payload)
