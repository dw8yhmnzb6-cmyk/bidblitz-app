"""
BidBlitz V2 - Sabre GDS Integration Service
OAuth2 token manager + API client for Sabre CERT/PROD environments.
"""
import os
import time
import base64
import logging
from typing import Optional, Dict, Any

import httpx

logger = logging.getLogger(__name__)

_SABRE_ENV = os.environ.get("SABRE_ENVIRONMENT", "CERT").upper()
_REQ_TIMEOUT = float(os.environ.get("SABRE_REQUEST_TIMEOUT", "15"))

_CERT_CID = os.environ.get("SABRE_CERT_CLIENT_ID", "")
_CERT_SEC = os.environ.get("SABRE_CERT_CLIENT_SECRET", "")
_CERT_URL = os.environ.get("SABRE_CERT_BASE_URL", "https://api.cert.sabre.com")

_PROD_CID = os.environ.get("SABRE_PROD_CLIENT_ID", "")
_PROD_SEC = os.environ.get("SABRE_PROD_CLIENT_SECRET", "")
_PROD_URL = os.environ.get("SABRE_PROD_BASE_URL", "https://api.sabre.com")


def _current_creds() -> Dict[str, str]:
    if _SABRE_ENV == "PROD" and _PROD_CID and _PROD_SEC:
        return {"cid": _PROD_CID, "sec": _PROD_SEC, "url": _PROD_URL}
    return {"cid": _CERT_CID, "sec": _CERT_SEC, "url": _CERT_URL}


def _encode_basic_auth(cid: str, sec: str) -> str:
    """Sabre uses DOUBLE base64: base64(base64(cid) + ':' + base64(sec))."""
    cid_b64 = base64.b64encode(cid.encode("utf-8")).decode("ascii")
    sec_b64 = base64.b64encode(sec.encode("utf-8")).decode("ascii")
    combined = f"{cid_b64}:{sec_b64}"
    return base64.b64encode(combined.encode("ascii")).decode("ascii")


class SabreClient:
    """Lazy-initialized Sabre API client with token caching."""

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(_REQ_TIMEOUT, connect=_REQ_TIMEOUT * 2),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        return self._client

    async def _fetch_token(self) -> str:
        creds = _current_creds()
        if not creds["cid"] or not creds["sec"]:
            raise RuntimeError("Sabre credentials not configured for environment " + _SABRE_ENV)

        auth_header = _encode_basic_auth(creds["cid"], creds["sec"])
        url = f"{creds['url']}/v2/auth/token"

        client = self._get_client()
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Basic {auth_header}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Sabre token request failed {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        token = data.get("access_token")
        expires_in = int(data.get("expires_in", 604800))
        if not token:
            raise RuntimeError(f"Sabre token response missing access_token: {data}")

        self._token = token
        # Refresh 60 s before actual expiration
        self._token_expires_at = time.time() + max(expires_in - 60, 60)
        logger.info("Sabre token acquired (env=%s, expires_in=%ss)", _SABRE_ENV, expires_in)
        return token

    async def get_token(self) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token
        return await self._fetch_token()

    async def post(self, path: str, payload: Dict[str, Any], *, query: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """POST a JSON payload to a Sabre REST endpoint. Auto-retries once on 401."""
        creds = _current_creds()
        url = f"{creds['url']}{path}"
        client = self._get_client()

        for attempt in (1, 2):
            token = await self.get_token()
            resp = await client.post(
                url,
                params=query or None,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
            if resp.status_code == 401 and attempt == 1:
                # Force token refresh
                self._token = None
                continue
            break

        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:2000]}

        if resp.status_code >= 400:
            raise SabreApiError(resp.status_code, body)
        return body

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()


class SabreApiError(Exception):
    def __init__(self, status: int, body: Dict[str, Any]):
        super().__init__(f"Sabre API {status}: {body}")
        self.status = status
        self.body = body


# Singleton
sabre_client = SabreClient()


def sabre_environment() -> str:
    return _SABRE_ENV
