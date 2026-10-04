from routes.admin_projects import PROJECTS, _is_platform_owner


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


def test_owner_alias_does_not_override_database_identity(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_OWNER_EMAILS", "owner@bidblitz.ae")
    assert not _is_platform_owner({
        "role": "admin",
        "email": "login@example.com",
        "email_aliases": ["owner@bidblitz.ae"],
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
