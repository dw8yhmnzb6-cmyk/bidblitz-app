"""In-process realtime fanout for The Eye.

The first implementation is intentionally dependency-light. It can later be
backed by Redis pub/sub without changing the public broadcast interface.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder

from core.the_eye_access import TheEyeAccess
from core.the_eye_data_safety import sanitize_the_eye_payload


class TheEyeLiveHub:
    def __init__(self, *, send_timeout_seconds: float = 1.0) -> None:
        self._clients: Dict[WebSocket, TheEyeAccess] = {}
        self._lock = asyncio.Lock()
        self._send_timeout_seconds = send_timeout_seconds

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

    async def _deliver(self, client: WebSocket, message: Dict[str, Any]) -> None:
        try:
            await asyncio.wait_for(
                client.send_json(message),
                timeout=self._send_timeout_seconds,
            )
        except Exception:
            # One stalled/disconnected browser must not hold up other clients
            # or the API request that emitted the event.
            await self.disconnect(client)
            try:
                await asyncio.wait_for(
                    client.close(code=1013),
                    timeout=self._send_timeout_seconds,
                )
            except Exception:
                pass

    async def broadcast(self, event_type: str, payload: Dict[str, Any]) -> None:
        # Starlette's send_json does not encode datetime values. Device,
        # camera and incident events contain them, including nested fields.
        message = {
            "type": event_type,
            "payload": jsonable_encoder(sanitize_the_eye_payload(payload)),
        }
        async with self._lock:
            clients = list(self._clients.items())

        safe_payload = message["payload"]
        await asyncio.gather(*(
            self._deliver(client, message)
            for client, access in clients
            if access.can_receive_realtime(event_type, safe_payload)
        ))


the_eye_live_hub = TheEyeLiveHub()


async def broadcast_the_eye_event(event_type: str, payload: Dict[str, Any]) -> None:
    await the_eye_live_hub.broadcast(event_type, payload)
