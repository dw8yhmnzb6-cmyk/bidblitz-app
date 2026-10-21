import base64
import hashlib
import hmac
import json

from routes.admin_sso import _sign


def _decode(segment: str) -> dict:
    raw = base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))
    return json.loads(raw)


def test_sso_signature_round_trip():
    secret = "k" * 48
    payload = {
        "iss": "https://bidblitz.ae",
        "aud": "eyes",
        "sub": "owner-1",
        "email": "owner@example.com",
        "role": "owner",
        "permissions": ["*"],
        "iat": 1,
        "exp": 61,
        "nonce": "nonce",
    }
    code = _sign(payload, secret)
    body, signature = code.split(".", 1)
    expected = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")
    assert hmac.compare_digest(signature, expected)
    assert _decode(body) == payload
