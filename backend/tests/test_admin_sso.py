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


def test_conformexa_target_allows_only_explicit_trusted_https_origins(monkeypatch):
    from routes import admin_sso
    for base in ("https://conformexa.com", "https://admin.conformexa.com", "https://conformexa.de", "https://admin.conformexa.de", "https://conformexa.bidblitz.ae"):
        monkeypatch.setenv("BIDBLITZ_CONFORMEXA_BASE_URL", base)
        target = admin_sso.sso_targets().get("conformexa")
        assert target and target["handoff_url"] == base + "/v1/platform/admin/bidblitz-sso"
        assert target["browser_url"] == base + "/auth/bidblitz-sso"
    for base in ("http://conformexa.com", "https://evil.example", "https://conformexa.com/path", "https://user:secret@conformexa.com", "https://conformexa.com:444"):
        monkeypatch.setenv("BIDBLITZ_CONFORMEXA_BASE_URL", base)
        assert "conformexa" not in admin_sso.sso_targets()


def test_spy_target_uses_only_validated_bidblitz_https_origin(monkeypatch):
    from routes import admin_sso
    monkeypatch.setenv("BIDBLITZ_SPY_BASE_URL", "https://spy.bidblitz.ae")
    target = admin_sso.sso_targets()["spy"]
    assert target["handoff_url"] == "https://spy.bidblitz.ae/api/v1/dev/admin/bidblitz-sso"
    assert target["browser_url"] == "https://spy.bidblitz.ae/auth/bidblitz-sso"
    for base in ("http://spy.bidblitz.ae", "https://evil.example", "https://spy.bidblitz.ae/path", "https://u:p@spy.bidblitz.ae", "https://spy.bidblitz.ae:444"):
        monkeypatch.setenv("BIDBLITZ_SPY_BASE_URL", base)
        assert "spy" not in admin_sso.sso_targets()


def test_remote_target_uses_only_validated_bidblitz_https_origin(monkeypatch):
    from routes import admin_sso
    monkeypatch.setenv("BIDBLITZ_REMOTE_BASE_URL", "https://remote.bidblitz.ae")
    target = admin_sso.sso_targets()["remote"]
    assert target["handoff_url"] == "https://remote.bidblitz.ae/v1/auth/bidblitz-sso"
    assert target["browser_url"] == "https://remote.bidblitz.ae/auth/bidblitz-sso"
    for base in ("http://remote.bidblitz.ae", "https://evil.example", "https://remote.bidblitz.ae/path", "https://u:p@remote.bidblitz.ae", "https://remote.bidblitz.ae:444"):
        monkeypatch.setenv("BIDBLITZ_REMOTE_BASE_URL", base)
        assert "remote" not in admin_sso.sso_targets()


def test_veysca_target_uses_static_admin_landing_and_trusted_https(monkeypatch):
    from routes import admin_sso
    monkeypatch.setenv("BIDBLITZ_VEYSCA_BASE_URL", "https://veysca.bidblitz.ae")
    target = admin_sso.sso_targets()["veysca"]
    assert target["handoff_url"] == "https://veysca.bidblitz.ae/api/v1/admin/bidblitz-sso"
    assert target["browser_url"] == "https://veysca.bidblitz.ae/admin.html"
    for base in ("http://veysca.bidblitz.ae", "https://evil.example", "https://veysca.bidblitz.ae/path", "https://u:p@veysca.bidblitz.ae", "https://veysca.bidblitz.ae:444"):
        monkeypatch.setenv("BIDBLITZ_VEYSCA_BASE_URL", base)
        assert "veysca" not in admin_sso.sso_targets()
