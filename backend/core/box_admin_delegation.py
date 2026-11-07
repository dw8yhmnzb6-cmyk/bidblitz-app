"""Bounded, request-bound delegation for the native BOX inbox (not a browser SSO code)."""
import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from pathlib import Path

PATH = "/v1/internal/bidblitz-admin/box/partner-applications"
SCOPE = "box:partner-applications:read"
KEYS = {"iss", "aud", "sub", "scope", "method", "path", "after", "iat", "exp", "nonce"}

class DelegationRejected(ValueError):
    pass

def cursor(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{1,12}", value):
        raise DelegationRejected("invalid cursor")
    return str(int(value))

def _secret(value):
    if not isinstance(value, str) or len(value.encode()) < 32:
        raise DelegationRejected("delegation not configured")
    return value.encode()

def _b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")

def issue(secret, subject, after="0", now=None):
    now = int(time.time() if now is None else now)
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 256:
        raise DelegationRejected("invalid subject")
    claims = dict(iss="https://bidblitz.ae", aud="box-admin-inbox",
                  sub=subject, scope=SCOPE, method="GET", path=PATH,
                  after=cursor(after), iat=now, exp=now + 30,
                  nonce=secrets.token_hex(24))
    body = _b64(json.dumps(claims, sort_keys=True, separators=(",", ":")).encode())
    return body + "." + _b64(hmac.new(_secret(secret), body.encode(), hashlib.sha256).digest())

def _unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DelegationRejected("duplicate claim")
        result[key] = value
    return result

def verify(secret, token, after="0", now=None):
    try:
        if not isinstance(token, str) or len(token) > 4096 or token.count(".") != 1:
            raise DelegationRejected("invalid credential")
        body, signature = token.split(".")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", body):
            raise DelegationRejected("invalid credential")
        expected = _b64(hmac.new(_secret(secret), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise DelegationRejected("invalid credential")
        claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)),
                            object_pairs_hook=_unique)
        now = int(time.time() if now is None else now)
        if not isinstance(claims, dict) or set(claims) != KEYS:
            raise DelegationRejected("invalid claims")
        for key, value in dict(iss="https://bidblitz.ae", aud="box-admin-inbox",
                               scope=SCOPE, method="GET", path=PATH,
                               after=cursor(after)).items():
            if claims[key] != value:
                raise DelegationRejected("request mismatch")
        if (type(claims["iat"]) is not int or type(claims["exp"]) is not int
                or claims["exp"] - claims["iat"] != 30
                or not claims["iat"] <= now < claims["exp"]):
            raise DelegationRejected("expired credential")
        if (not isinstance(claims["sub"], str) or not claims["sub"].strip()
                or len(claims["sub"]) > 256
                or not isinstance(claims["nonce"], str)
                or not re.fullmatch(r"[0-9a-f]{48}", claims["nonce"])):
            raise DelegationRejected("invalid identity")
        return claims
    except (TypeError, KeyError, UnicodeError, json.JSONDecodeError) as exc:
        raise DelegationRejected("invalid credential") from None

def initialize_replay_store(path):
    """Explicit install step; must use a dedicated private database."""
    target = Path(path)
    if target.exists():
        raise FileExistsError("Replay database already exists")
    target.touch(mode=0o600, exist_ok=False)
    with sqlite3.connect(target) as db:
        db.execute("CREATE TABLE used_delegations (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL)")

class ReplayStore:
    def __init__(self, path):
        self.path = Path(path).resolve()
        if not self.path.is_file():
            raise FileNotFoundError("Explicitly initialized replay database required")

    def consume(self, nonce, expires, now):
        with sqlite3.connect(self.path.as_uri() + "?mode=rw", uri=True, timeout=5) as db:
            try:
                db.execute("BEGIN IMMEDIATE")
                db.execute("DELETE FROM used_delegations WHERE expires<=?", (now,))
                db.execute("INSERT INTO used_delegations VALUES (?,?)", (nonce, expires))
                db.commit()
            except sqlite3.IntegrityError:
                raise DelegationRejected("credential already used") from None
