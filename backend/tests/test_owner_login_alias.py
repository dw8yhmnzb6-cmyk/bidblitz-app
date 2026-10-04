from routes.auth import _auth_email_candidates


def test_owner_login_alias_resolves_only_to_canonical_admin(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_OWNER_LOGIN_ALIASES", "afrimk@me.com")
    assert _auth_email_candidates("AfrimK@me.com") == [
        "admin@bidblitz.ae",
        "admin@bitblitz.ae",
    ]


def test_unconfigured_personal_email_remains_normal_identity(monkeypatch):
    monkeypatch.delenv("BIDBLITZ_OWNER_LOGIN_ALIASES", raising=False)
    assert _auth_email_candidates("afrimk@me.com") == ["afrimk@me.com"]
