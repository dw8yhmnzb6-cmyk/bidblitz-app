"""In-process realtime fanout for The Eye.

The first implementation is intentionally dependency-light. It can later be
backed by Redis pub/sub without changing the public broadcast interface.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Set

from fastapi import WebSocket


class TheEyeLiveHub:
    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._clients.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    async def broadcast(self, event_type: str, payload: Dict[str, Any]) -> None:
        message = {"type": event_type, "payload": payload}
        async with self._lock:
            clients = list(self._clients)

        stale = []
        for client in clients:
            try:
                await client.send_json(message)
            except Exception:
                stale.append(client)

        if stale:
            async with self._lock:
                for client in stale:
                    self._clients.discard(client)


the_eye_live_hub = TheEyeLiveHub()


async def broadcast_the_eye_event(event_type: str, payload: Dict[str, Any]) -> None:
    await the_eye_live_hub.broadcast(event_type, payload)
