from routes.admin_projects import PROJECTS, _is_platform_owner, _project_sso_ready


def test_platform_owner_default_identity(monkeypatch):
    monkeypatch.delenv("BIDBLITZ_OWNER_EMAILS", raising=False)
    assert _is_platform_owner({
        "role": "admin",
        "email": "admin@bidblitz.ae",
    })


def test_non_owner_admin_is_not_platform_owner(monkeypatch):
    monkeypatch.delenv("BIDBLITZ_OWNER_EMAILS", raising=False)
    assert not _is_platform_owner({
        "role": "admin",
        "email": "staff-admin@bidblitz.ae",
    })


def test_owner_alias_is_accepted(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_CANONICAL_OWNER_EMAIL", "admin@bidblitz.ae")
    monkeypatch.setenv("BIDBLITZ_OWNER_EMAILS", "admin@bidblitz.ae,owner@example.com")
    assert _is_platform_owner({
        "role": "admin",
        "email": "admin@bidblitz.ae",
        "canonical_email": "admin@bidblitz.ae",
        "login_email": "owner@example.com",
        "email_aliases": ["owner@example.com"],
    })

def test_project_registry_never_invents_urls_for_pending_projects():
    pending = [p for p in PROJECTS if p["status"] == "pending"]
    assert pending
    assert all(p["url"] is None and p["admin_url"] is None for p in pending)


def test_confirmed_projects_have_unique_ids():
    ids = [p["id"] for p in PROJECTS]
    assert len(ids) == len(set(ids))


def test_customer_identity_cannot_become_platform_owner_by_email_only(monkeypatch):
    monkeypatch.delenv("BIDBLITZ_OWNER_EMAILS", raising=False)
    assert not _is_platform_owner({
        "role": "customer",
        "email": "admin@bidblitz.ae",
    })


def test_unconfigured_admin_cannot_enter_cross_project_hub(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_OWNER_EMAILS", "admin@bidblitz.ae")
    assert not _is_platform_owner({
        "role": "admin",
        "email": "another-admin@bidblitz.ae",
    })


def test_project_sso_requires_explicit_activation(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "s" * 48)
    monkeypatch.delenv("BIDBLITZ_SSO_EYES_ENABLED", raising=False)
    assert not _project_sso_ready("eyes")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    assert _project_sso_ready("eyes")


def test_aion_sso_requires_configured_base_url(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "s" * 48)
    monkeypatch.setenv("BIDBLITZ_SSO_AION_ENABLED", "true")
    monkeypatch.delenv("BIDBLITZ_AION_BASE_URL", raising=False)
    assert not _project_sso_ready("aion")
    monkeypatch.setenv("BIDBLITZ_AION_BASE_URL", "https://aion.example")
    assert _project_sso_ready("aion")
