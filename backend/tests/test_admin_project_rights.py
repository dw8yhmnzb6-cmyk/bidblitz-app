import re
from pathlib import Path

import pytest

from core import admin_project_access as access
from core.admin_access import can_manage_privileged_roles
from routes import admin_projects


def test_expanded_inventory_separates_projects_modules_and_aliases():
    projects = admin_projects._defaults()
    assert len(projects) == 35
    assert {"os", "remote", "spy", "tv", "charge", "bidtax", "match", "pay", "staff", "identity", "taxi", "scooter", "food", "auctions", "merchant", "pool", "tickets", "car-rental", "mining"} <= projects.keys()
    assert projects["charging"]["name"] == "iCharging"
    assert projects["charge"]["name"] == "BidBlitz Charge"
    assert "device" not in projects and "ak-stream-tv" not in projects and "builder" not in projects
    assert "BidBlitz Device" in access.PROJECT_ALIASES["spy"]
    assert "AK Stream TV" in access.PROJECT_ALIASES["tv"]


def test_every_native_project_has_a_real_fixed_entry_point():
    app = (Path(__file__).resolve().parents[2] / "frontend/src/App.js").read_text()
    app += (Path(__file__).resolve().parents[2] / "frontend/src/app/renderSpecialRoutes.jsx").read_text()
    for key, path in access.NATIVE_PROJECT_PATHS.items():
        assert f'"{path}"' in app, (key, path)
        project = admin_projects._defaults()[key]
        project["admin_url"] = "https://evil.example"
        row = admin_projects.project_view(project, {"role": "admin"})
        assert row["native_path"] == path
        assert row["access_profile"]["effective_permissions"] == ["admin:navigate"]
        assert row["open_mode"] == "internal"
        assert row["kind"] == ("project" if key == "bidblitz" else "module")


def test_hidden_native_module_cannot_be_opened():
    project = {**admin_projects._defaults()["pay"], "status": "hidden"}
    row = admin_projects.project_view(project, {"role": "admin"})
    assert row["open_mode"] == "unavailable" and not row["sso_ready"]


def test_external_roles_are_requirements_not_effective_grants():
    for key, role in access.REMOTE_REQUIRED_ROLES.items():
        profile = access.project_access(key, {"role": "super_admin"})["access_profile"]
        assert profile["required_role"] == role
        assert profile["role"] is None
        assert profile["effective_permissions"] == []
        assert profile["verification"] == "target_check_required"
    assert access.project_access("unknown-project")["access_profile"]["required_role"] is None


@pytest.mark.parametrize("role", ["admin", "super_admin"])
def test_module_operations_mirror_live_safety_rules(monkeypatch, role):
    monkeypatch.setattr(access, "TEST_MODE", False)
    modules = {m["id"]: m for m in access.service_module_rights({"role": role})}
    assert len(modules) == 15
    assert modules["dating"]["operations"] == ["read", "moderate"]
    assert modules["ladesaeulen"]["operations"] == ["read"]
    assert modules["scooter-abos"]["operations"] == ["read", "create", "update", "disable"]
    assert modules["immobilien"]["operations"] == ["read", "create", "update", "delete"]
    assert all(m["path"] == "/admin/modules" for m in modules.values())


def test_service_rights_do_not_grant_customer_admin_access():
    assert all(m["operations"] == [] for m in access.service_module_rights({"role": "customer"}))
    assert access.project_access("pay", {"role": "customer"})["access_profile"]["effective_permissions"] == []


def test_privileged_roles_and_cleanup_keep_existing_gates(monkeypatch):
    assert can_manage_privileged_roles({"role": "admin", "email": "admin@bidblitz.ae"})
    assert can_manage_privileged_roles({"role": "super_admin", "email": "other@example.test"})
    assert not can_manage_privileged_roles({"role": "admin", "email": "other@example.test", "login_email": "admin@bidblitz.ae"})
    monkeypatch.setattr(access, "TEST_MODE", False)
    assert not access.owner_access({"role": "super_admin"})["can_cleanup_demo_data"]
    monkeypatch.setattr(access, "TEST_MODE", True)
    assert not access.owner_access({"role": "admin"})["can_cleanup_demo_data"]
    assert access.owner_access({"role": "super_admin"})["can_cleanup_demo_data"]


def test_module_registry_matches_actual_backend_collections():
    source = (Path(__file__).resolve().parents[1] / "routes/admin_management.py").read_text()
    section = source[source.index("MODULE_COLLECTIONS = {"):source.index("MODULE_ID_FIELDS = {")]
    assert set(re.findall(r'^\s+"([a-z-]+)":', section, re.M)) == set(access.SERVICE_MODULES)


def test_only_known_native_paths_pass_relative_url_validation():
    for path in access.NATIVE_PROJECT_PATHS.values():
        assert admin_projects.ProjectFields(name="Test", url=path).url == path
    for path in ["/admin/not-real", "//evil.example", "/admin/payments?token=secret", "/admin/../wallet"]:
        with pytest.raises(ValueError):
            admin_projects.ProjectFields(name="Test", url=path)


def test_games_uses_existing_bidblitz_admin_session():
    games = next(project for project in admin_projects._defaults().values() if project["id"] == "games")
    row = admin_projects.project_view(games, {"role": "admin"})
    assert row["open_mode"] == "internal"
    assert row["native_path"] == "/admin/game-settings"
    assert row["integration"]["state"] == "native_ready"
    assert row["access_profile"]["scope"] == "bidblitz"
    assert row["access_profile"]["effective_permissions"] == ["admin:navigate"]


def test_match_uses_games_admin_module_and_not_external_sso():
    match = admin_projects._defaults()["match"]
    row = admin_projects.project_view(match, {"role": "super_admin"})
    assert row["open_mode"] == "internal"
    assert row["native_path"] == "/admin/game-settings"
    assert row["sso_state"] == "native"
    assert row["access_profile"]["scope"] == "bidblitz"
