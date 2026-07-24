"""
BidBlitz POS — Fiskaly Cloud TSE Client (Sign-API v2).

Falls FISKALY_API_KEY + FISKALY_API_SECRET in der Umgebung gesetzt sind,
werden echte Fiskaly Cloud-Calls verwendet. Andernfalls fällt der Code
auf einen HMAC-SHA256-Stub zurück, der die wichtigsten KassenSichV-Felder
deterministisch erzeugt (für lokales Testing & Dev-Umgebungen).

Env-Variablen (in /app/backend/.env):
    FISKALY_API_KEY=...
    FISKALY_API_SECRET=...
    FISKALY_TSS_ID=<UUID einer TSS aus Dashboard>
    FISKALY_BASE_URL=https://kassensichv-middleware.fiskaly.com  (default)
"""
import os
import hashlib
import hmac
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone

import httpx

log = logging.getLogger("bidblitz.pos.fiskaly")

FISKALY_BASE_URL = os.environ.get("FISKALY_BASE_URL", "https://kassensichv-middleware.fiskaly.com")
FISKALY_API_KEY = os.environ.get("FISKALY_API_KEY")
FISKALY_API_SECRET = os.environ.get("FISKALY_API_SECRET")
FISKALY_TSS_ID = os.environ.get("FISKALY_TSS_ID")

_token_cache: Dict[str, Any] = {"access_token": None, "expires_at": 0}


async def _get_fiskaly_token() -> Optional[str]:
    """OAuth2 client-credentials flow against Fiskaly auth endpoint."""
    if not FISKALY_API_KEY or not FISKALY_API_SECRET:
        return None
    now_ts = datetime.now(timezone.utc).timestamp()
    if _token_cache["access_token"] and now_ts < _token_cache["expires_at"] - 30:
        return _token_cache["access_token"]
    async with httpx.AsyncClient(timeout=10) as cx:
        r = await cx.post(
            f"{FISKALY_BASE_URL}/api/v2/auth",
            json={"api_key": FISKALY_API_KEY, "api_secret": FISKALY_API_SECRET},
        )
        if r.status_code != 200:
            log.warning(f"Fiskaly auth failed: {r.status_code} {r.text[:200]}")
            return None
        data = r.json()
        _token_cache["access_token"] = data.get("access_token")
        _token_cache["expires_at"] = now_ts + data.get("expires_in", 3600)
        return _token_cache["access_token"]


def is_real_mode() -> bool:
    """Returns True if real Fiskaly credentials are configured."""
    return bool(FISKALY_API_KEY and FISKALY_API_SECRET and FISKALY_TSS_ID)


async def sign_transaction(
    *,
    client_id: str,
    transaction_id: str,
    sale_total: float,
    vat_19: float = 0,
    vat_7: float = 0,
    vat_0: float = 0,
    payment_method: str = "Bar",
    fallback_secret: str = "dev-stub",
) -> Dict[str, Any]:
    """
    Signs a single Kassenbeleg-V1 transaction via Fiskaly Cloud TSS.

    On success returns:
        {
          "tse_signature": <base64 sig>,
          "tse_signature_counter": <int>,
          "tse_serial": <serial>,
          "tse_log_time": <ISO>,
          "tse_qr_data": <V0;...;sig> for the receipt QR,
          "tse_provider": "fiskaly" | "stub",
        }
    """
    log_time = datetime.now(timezone.utc).isoformat()
    process_data = (
        f"Beleg^{sale_total:.2f}_{vat_19:.2f}_{vat_7:.2f}_{vat_0:.2f}^"
        f"{payment_method}:{sale_total:.2f}"
    )

    if is_real_mode():
        token = await _get_fiskaly_token()
        if token:
            try:
                async with httpx.AsyncClient(timeout=15) as cx:
                    # 1. open transaction
                    r1 = await cx.put(
                        f"{FISKALY_BASE_URL}/api/v2/tss/{FISKALY_TSS_ID}/tx/{transaction_id}",
                        headers={"Authorization": f"Bearer {token}"},
                        json={"state": "ACTIVE", "client_id": client_id},
                    )
                    if r1.status_code not in (200, 201):
                        raise RuntimeError(f"open tx failed: {r1.status_code}")
                    # 2. finish transaction with payload
                    r2 = await cx.put(
                        f"{FISKALY_BASE_URL}/api/v2/tss/{FISKALY_TSS_ID}/tx/{transaction_id}",
                        headers={"Authorization": f"Bearer {token}"},
                        json={
                            "state": "FINISHED",
                            "client_id": client_id,
                            "schema": {
                                "standard_v1": {
                                    "receipt": {
                                        "receipt_type": "RECEIPT",
                                        "amounts_per_vat_rate": [
                                            {"vat_rate": "NORMAL", "amount": f"{vat_19:.2f}"},
                                            {"vat_rate": "REDUCED_1", "amount": f"{vat_7:.2f}"},
                                            {"vat_rate": "NULL", "amount": f"{vat_0:.2f}"},
                                        ],
                                        "amounts_per_payment_type": [
                                            {"payment_type": "CASH" if payment_method.lower() == "bar" else "NON_CASH",
                                             "amount": f"{sale_total:.2f}"},
                                        ],
                                    },
                                },
                            },
                        },
                    )
                    if r2.status_code not in (200, 201):
                        raise RuntimeError(f"finish tx failed: {r2.status_code} {r2.text[:200]}")
                    body = r2.json()
                    sig_obj = body.get("signature", {})
                    return {
                        "tse_signature": sig_obj.get("value"),
                        "tse_signature_counter": sig_obj.get("counter"),
                        "tse_serial": body.get("tss_serial_number"),
                        "tse_log_time": body.get("time_end") or log_time,
                        "tse_qr_data": (
                            f"V0;{sig_obj.get('counter')};Kassenbeleg-V1;{process_data};"
                            f"{body.get('time_end', log_time)};{(sig_obj.get('value') or '')[:32]}"
                        ),
                        "tse_provider": "fiskaly",
                    }
            except Exception as e:
                log.warning(f"Fiskaly call failed, falling back to stub: {e}")

    # ── Fallback: HMAC-SHA256 stub
    payload = json.dumps(
        {"tx": transaction_id, "data": process_data, "time": log_time, "client": client_id},
        sort_keys=True,
    ).encode()
    sig = hmac.new(fallback_secret.encode(), payload, hashlib.sha256).hexdigest()
    serial = hashlib.sha256(fallback_secret.encode()).hexdigest()[:16].upper()
    return {
        "tse_signature": sig,
        "tse_signature_counter": int(datetime.now(timezone.utc).timestamp()),
        "tse_serial": f"STUB-{serial}",
        "tse_log_time": log_time,
        "tse_qr_data": f"V0;{int(datetime.now(timezone.utc).timestamp())};Kassenbeleg-V1;{process_data};{log_time};{sig[:32]}",
        "tse_provider": "stub",
    }
