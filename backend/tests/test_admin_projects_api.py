"""API-level owner, catalogue persistence and SSO boundary regression tests."""
import asyncio
import base64
import json

import pytest
import httpx
from bson import ObjectId
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient

from core import security
from routes import admin_projects, admin_sso

HEADERS = {"Origin": "https://bidblitz.ae", "X-BidBlitz-Admin": "1"}


class ApiClient:
    """Use ASGITransport with the project's httpx, including 0.28+."""
    def __init__(self, app):
        self.app = app
        self.cookies = httpx.Cookies()

    def request(self, method, path, **kwargs):
        async def run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app),
                                        base_url="http://testserver", cookies=self.cookies) as client:
                return await client.request(method, path, **kwargs)
        return asyncio.run(run())

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def put(self, path, **kwargs):
        return self.request("PUT", path, **kwargs)


@pytest.fixture
def context(monkeypatch):
    database = AsyncMongoMockClient()["admin_hub_test"]
    monkeypatch.setattr(admin_projects, "db", database)
    monkeypatch.setattr(security, "db", database)
    monkeypatch.setenv("BIDBLITZ_OWNER_EMAILS", "admin@bidblitz.ae")
    monkeypatch.setenv("BIDBLITZ_OWNER_ID", "test-owner")
    for name in ("EYES", "TRADE", "NEX", "STACK", "AION", "VERIFY"):
        monkeypatch.delenv(f"BIDBLITZ_SSO_{name}_ENABLED", raising=False)
    monkeypatch.delenv("BIDBLITZ_SSO_SHARED_SECRET", raising=False)
    monkeypatch.delenv("BIDBLITZ_SSO_EYES_SECRET", raising=False)
    monkeypatch.delenv("BIDBLITZ_SSO_TRADE_SECRET", raising=False)
    user_id = ObjectId()
    asyncio.run(database.users.insert_one({"_id": user_id, "email": "admin@bidblitz.ae", "role": "admin"}))
    app = FastAPI()
    app.include_router(admin_projects.router)
    app.include_router(admin_sso.router)
    client = ApiClient(app)
    client.cookies.set("access_token", security.create_access_token(str(user_id), "admin@bidblitz.ae"))
    yield client, database, user_id


def draft(**updates):
    return {"id": "new-project", "name": "Neues Projekt", "status": "active",
            "url": "https://example.com", "admin_url": "https://example.com/admin", **updates}


def update_body(project, **updates):
    allowed = admin_projects.ProjectUpdate.model_fields
    return {**{k: v for k, v in project.items() if k in allowed}, **updates}


def test_unauthenticated_requests_denied(context):
    client, _, _ = context
    client.cookies.clear()
    assert client.get("/api/admin/projects").status_code == 401
    assert client.post("/api/admin/projects", json=draft(), headers=HEADERS).status_code == 401
    assert client.post("/api/admin/sso/eyes", headers=HEADERS).status_code == 401


@pytest.mark.parametrize("change, expected", [({"role": "customer"}, 403), ({"email": "other@example.com"}, 403), ({"is_disabled": True}, 401), ({"login_disabled": True}, 401), ({"auth_version": 1}, 401)])
def test_current_database_permissions_apply_to_every_endpoint(context, change, expected):
    client, database, user_id = context
    asyncio.run(database.users.update_one({"_id": user_id}, {"$set": change}))
    assert client.get("/api/admin/projects").status_code == expected
    assert client.post("/api/admin/projects", json=draft(), headers=HEADERS).status_code == expected
    assert client.put("/api/admin/projects/eyes", json={**update_body(admin_projects._defaults()["eyes"])}, headers=HEADERS).status_code == expected
    assert client.post("/api/admin/sso/eyes", headers=HEADERS).status_code == expected


def test_login_alias_cannot_impersonate_owner(context):
    client, database, user_id = context
    asyncio.run(database.users.update_one({"_id": user_id}, {"$set": {"email": "other@example.com", "email_aliases": ["admin@bidblitz.ae"]}}))
    client.cookies.set("access_token", security.create_access_token(str(user_id), "other@example.com", "admin@bidblitz.ae"))
    assert client.get("/api/admin/projects").status_code == 403


@pytest.mark.parametrize("headers", [{}, {"X-BidBlitz-Admin": "1"}, {"Origin": "https://bidblitz.ae"}, {**HEADERS, "Origin": "https://evil.example"}, {**HEADERS, "Origin": "null"}])
def test_browser_write_requires_trusted_origin_and_header(context, headers):
    client, _, _ = context
    assert client.post("/api/admin/projects", json=draft(), headers=headers).status_code == 403
    assert client.post("/api/admin/sso/eyes", headers=headers).status_code == 403


def test_create_edit_reload_conflict_and_audit(context):
    client, database, _ = context
    created = client.post("/api/admin/projects", json=draft(), headers=HEADERS)
    assert created.status_code == 201
    project = created.json()["project"]
    body = update_body(project, name="Geändert", position=1, status="hidden")
    updated = client.put("/api/admin/projects/new-project", json=body, headers=HEADERS)
    assert updated.status_code == 200
    assert updated.json()["project"]["open_mode"] == "unavailable"
    assert client.put("/api/admin/projects/new-project", json=body, headers=HEADERS).status_code == 409
    assert client.post("/api/admin/projects", json=draft(), headers=HEADERS).status_code == 409
    response = client.get("/api/admin/projects")
    assert response.headers["cache-control"] == "no-store"
    row = next(p for p in response.json()["projects"] if p["id"] == "new-project")
    assert row["name"] == "Geändert" and row["revision"] == 2
    assert "audit" not in row and "_id" not in row
    record = asyncio.run(database.admin_projects.find_one({"_id": "new-project"}))
    assert [e["action"] for e in record["audit"]] == ["create", "update"]


def test_seed_edit_and_main_admin_protection(context):
    client, _, _ = context
    project = admin_projects._defaults()["eyes"]
    body = update_body(project, name="Eyes neu")
    assert client.put("/api/admin/projects/eyes", json=body, headers=HEADERS).status_code == 200
    assert client.put("/api/admin/projects/eyes", json=body, headers=HEADERS).status_code == 409
    root = update_body(admin_projects._defaults()["bidblitz"], status="hidden")
    assert client.put("/api/admin/projects/bidblitz", json=root, headers=HEADERS).status_code == 422
    assert client.post("/api/admin/projects", json=draft(id="eyes"), headers=HEADERS).status_code == 409


@pytest.mark.parametrize("url", ["javascript:alert(1)", "//evil.example", "http://example.com", "https://u:p@example.com", "https://example.com#code=secret", "https://example.com?token=x", "https://example.com\\@evil.example", "https://example.com:bad", "https://example.com\n.evil.example"])
def test_unsafe_project_links_rejected(context, url):
    client, _, _ = context
    assert client.post("/api/admin/projects", json=draft(admin_url=url), headers=HEADERS).status_code == 422


def test_unknown_fields_cannot_enable_sso(context):
    client, _, _ = context
    assert client.post("/api/admin/projects", json=draft(sso_ready=True), headers=HEADERS).status_code == 422


def test_sso_secret_does_not_imply_remote_access(context, monkeypatch):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "s" * 48)
    rows = {p["id"]: p for p in client.get("/api/admin/projects").json()["projects"]}
    assert rows["eyes"]["sso_state"] == "not_configured"
    assert rows["eyes"]["open_mode"] == "unavailable"
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    rows = {p["id"]: p for p in client.get("/api/admin/projects").json()["projects"]}
    assert rows["eyes"]["sso_state"] == "configured"
    assert rows["eyes"]["permissions"] != ["*"]
    assert rows["nex"]["sso_state"] == "not_configured"
    assert rows["verify"]["open_mode"] == "unavailable"
    assert "s" * 48 not in json.dumps(rows)
    monkeypatch.setenv("BIDBLITZ_OWNER_ID", "")
    rows = {p["id"]: p for p in client.get("/api/admin/projects").json()["projects"]}
    assert not rows["eyes"]["sso_ready"]


def test_handoff_target_fixed_nonce_fresh_and_not_cached(context, monkeypatch):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", "e" * 48)
    body = update_body(admin_projects._defaults()["eyes"], admin_url="https://evil.example")
    assert client.put("/api/admin/projects/eyes", json=body, headers=HEADERS).status_code == 200
    first = client.post("/api/admin/sso/eyes", headers=HEADERS)
    second = client.post("/api/admin/sso/eyes", headers=HEADERS)
    assert first.status_code == 200
    assert first.headers["cache-control"] == "no-store"
    data = first.json()
    assert data["browser_url"] == "https://eyes.bidblitz.ae/auth/bidblitz-sso"
    assert data["code"] != second.json()["code"]
    segment = data["code"].split(".")[0]
    payload = json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))
    assert payload["aud"] == "eyes" and payload["sub"] == "test-owner"
    assert payload["exp"] - payload["iat"] == 60
    assert admin_sso._sign(payload, "e" * 48) == data["code"]
    assert client.post("/api/admin/sso/trade", headers=HEADERS).status_code == 503


def test_hidden_projects_cannot_issue_handoffs(context, monkeypatch):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "x" * 48)
    body = update_body(admin_projects._defaults()["trade"], status="hidden")
    assert client.put("/api/admin/projects/trade", json=body, headers=HEADERS).status_code == 200
    assert client.post("/api/admin/sso/trade", headers=HEADERS).status_code == 403
    assert client.post("/api/admin/sso/nex", headers=HEADERS).status_code == 503


def test_explicit_empty_project_secret_disables_legacy_fallback(context, monkeypatch):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "x" * 48)
    monkeypatch.setenv("BIDBLITZ_SSO_TRADE_ENABLED", "true")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", "")
    assert client.post("/api/admin/sso/eyes", headers=HEADERS).status_code == 503
    assert client.post("/api/admin/sso/trade", headers=HEADERS).status_code == 200


def test_configured_super_admin_can_manage_projects(context):
    client, database, user_id = context
    asyncio.run(database.users.update_one({"_id": user_id}, {"$set": {"role": "super_admin"}}))
    assert client.get("/api/admin/projects").status_code == 200
    assert client.post("/api/admin/projects", json=draft(), headers=HEADERS).status_code == 201
    asyncio.run(database.users.update_one({"_id": user_id}, {"$set": {"email": "other@example.com"}}))
    assert client.get("/api/admin/projects").status_code == 403


@pytest.mark.parametrize("name", ["eyes", "trade", "nex", "stack"])
def test_each_receiver_requires_explicit_release_flag(context, monkeypatch, name):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "x" * 48)
    assert client.post(f"/api/admin/sso/{name}", headers=HEADERS).status_code == 503
    monkeypatch.setenv(f"BIDBLITZ_SSO_{name.upper()}_ENABLED", "true")
    assert client.post(f"/api/admin/sso/{name}", headers=HEADERS).status_code == 200

@pytest.mark.parametrize("name", ["aion", "verify"])
def test_optional_base_only_accepts_trusted_https_origin(context, monkeypatch, name):
    client, _, _ = context
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "x" * 48)
    monkeypatch.setenv(f"BIDBLITZ_SSO_{name.upper()}_ENABLED", "true")
    body = update_body(admin_projects._defaults()[name], status="dev")
    assert client.put(f"/api/admin/projects/{name}", json=body, headers=HEADERS).status_code == 200
    for base in ["http://aion.bidblitz.ae", "https://evil.example", "https://aion.bidblitz.ae@evil.example", "https://aion.bidblitz.ae/path", "https://aion.bidblitz.ae?code=x", "https://aion.bidblitz.ae:8443"]:
        monkeypatch.setenv(f"BIDBLITZ_{name.upper()}_BASE_URL", base)
        assert client.post(f"/api/admin/sso/{name}", headers=HEADERS).status_code == 404
    monkeypatch.setenv(f"BIDBLITZ_{name.upper()}_BASE_URL", f"https://{name}.bidblitz.ae")
    result = client.post(f"/api/admin/sso/{name}", headers=HEADERS)
    assert result.status_code == 200
    assert result.json()["browser_url"] == f"https://{name}.bidblitz.ae/auth/bidblitz-sso"


def test_canonical_owner_config_uses_current_database_identity(context, monkeypatch):
    client, database, user_id = context
    monkeypatch.delenv("BIDBLITZ_OWNER_EMAILS")
    monkeypatch.setenv("BIDBLITZ_CANONICAL_OWNER_EMAIL", "admin@bidblitz.ae")
    assert client.get("/api/admin/projects").status_code == 200
    asyncio.run(database.users.update_one({"_id": user_id}, {"$set": {"email": "other@example.com"}}))
    assert client.get("/api/admin/projects").status_code == 403


def test_inventory_rights_do_not_modify_accounts_or_imply_remote_grants(context):
    client, database, user_id = context
    response = client.get("/api/admin/projects")
    data = response.json()
    assert len(data["projects"]) == 35
    assert data["owner"]["database_role"] == "admin"
    assert len(data["owner"]["service_modules"]) == 15
    assert data["owner"]["can_manage_privileged_roles"]
    assert not data["owner"]["can_cleanup_demo_data"]
    row = next(p for p in data["projects"] if p["id"] == "trade")
    assert row["access_profile"]["required_role"] == "SUPER_ADMIN"
    assert row["access_profile"]["effective_permissions"] == []
    assert asyncio.run(database.users.find_one({"_id": user_id}))["role"] == "admin"


def test_saved_owner_edits_survive_additional_default_projects(context):
    client, _, _ = context
    edited = update_body(admin_projects._defaults()["charging"], name="Mein vorhandenes Charging", position=4)
    assert client.put("/api/admin/projects/charging", json=edited, headers=HEADERS).status_code == 200
    rows = {p["id"]: p for p in client.get("/api/admin/projects").json()["projects"]}
    assert rows["charging"]["name"] == "Mein vorhandenes Charging"
    assert rows["charge"]["name"] == "BidBlitz Charge"
    assert rows["spy"]["open_mode"] == "unavailable"


def test_writable_catalogue_cannot_forge_access_profiles(context):
    client, _, _ = context
    for field, value in {"native_path": "/admin", "access_profile": {"effective_permissions": ["*"]}, "permissions": ["*"], "kind": "module", "integration": {"remote_access_verified": True}}.items():
        assert client.post("/api/admin/projects", json=draft(**{field: value}), headers=HEADERS).status_code == 422
        forged_update = {**update_body(admin_projects._defaults()["eyes"]), field: value}
        assert client.put("/api/admin/projects/eyes", json=forged_update, headers=HEADERS).status_code == 422


def test_diagnostics_are_owner_only_read_only_and_secret_free(context, monkeypatch):
    client, database, user_id = context
    secret = "api-private-project-key-never-for-browser-000000"
    subject = "api-private-owner-subject-never-for-browser"
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", secret)
    monkeypatch.setenv("BIDBLITZ_OWNER_ID", subject)
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    before = asyncio.run(database.users.find_one({"_id": user_id}))
    for _ in range(2):
        response = client.get("/api/admin/projects")
        assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
        assert secret not in response.text and subject not in response.text
        rows = {p["id"]: p for p in response.json()["projects"]}
        assert rows["eyes"]["integration"]["state"] == "issuer_ready"
        assert not rows["eyes"]["integration"]["remote_access_verified"]
    # Existing JWT authentication updates last_seen; diagnostics must not alter
    # identity, roles, auth versions, disabled flags, or any other account data.
    after = asyncio.run(database.users.find_one({"_id": user_id}))
    assert {k: v for k, v in after.items() if k != "last_seen"} == before
    assert asyncio.run(database.admin_projects.count_documents({})) == 0
    client.cookies.clear()
    assert client.get("/api/admin/projects").status_code == 401
