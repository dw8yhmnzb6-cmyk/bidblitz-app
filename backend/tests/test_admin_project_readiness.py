"""Local configuration diagnostics cannot assert target access or reveal secrets."""
import json

import pytest

from core.admin_project_access import NATIVE_PROJECT_PATHS
from core.admin_project_readiness import RECEIVER_SETUP
from routes import admin_projects, admin_sso


@pytest.fixture(autouse=True)
def clean_sso_environment(monkeypatch):
    for name in admin_sso.SSO_ADAPTERS:
        monkeypatch.delenv(f"BIDBLITZ_SSO_{name.upper()}_SECRET", raising=False)
        monkeypatch.delenv(f"BIDBLITZ_SSO_{name.upper()}_ENABLED", raising=False)
    for key in ("BIDBLITZ_SSO_SHARED_SECRET", "BIDBLITZ_AION_BASE_URL", "BIDBLITZ_VERIFY_BASE_URL", "BIDBLITZ_BIDTAX_BASE_URL", "BIDBLITZ_CONFORMEXA_BASE_URL", "BIDBLITZ_SPY_BASE_URL", "BIDBLITZ_REMOTE_BASE_URL", "BIDBLITZ_VEYSCA_BASE_URL"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("BIDBLITZ_OWNER_ID", "private-owner-subject-not-for-browser")


def view(project_id, **updates):
    return admin_projects.project_view({**admin_projects._defaults()[project_id], **updates}, {"role": "admin"})


def checks(row):
    return {check["id"]: check for check in row["integration"]["checks"]}


@pytest.mark.parametrize("name", sorted(admin_sso.SSO_ADAPTERS))
def test_adapter_reports_actual_missing_issuer_configuration(name):
    row = view(name, status="active")
    state = checks(row)
    assert state["receiver"]["state"] == "passed"
    assert state["key"]["state"] == state["release"]["state"] == "blocked"
    assert state["destination"]["state"] == ("blocked" if name in {"aion", "verify", "bidtax", "conformexa", "spy", "remote", "veysca"} else "passed")
    assert row["integration"]["state"] == "issuer_incomplete"
    assert not row["integration"]["can_attempt"]
    assert row["integration"]["receiver_setup"] == RECEIVER_SETUP[name]


@pytest.mark.parametrize("name", sorted(admin_sso.SSO_ADAPTERS))
def test_configured_issuer_never_confirms_remote_privileges(monkeypatch, name):
    secret = "private-project-key-not-for-browser-" + name
    monkeypatch.setenv(f"BIDBLITZ_SSO_{name.upper()}_SECRET", secret)
    monkeypatch.setenv(f"BIDBLITZ_SSO_{name.upper()}_ENABLED", "true")
    monkeypatch.setenv(f"BIDBLITZ_{name.upper()}_BASE_URL", f"https://{name}.bidblitz.ae")
    row = view(name, status="active")
    assert row["open_mode"] == "sso" and row["integration"]["can_attempt"]
    assert row["integration"]["state"] == "issuer_ready"
    assert not row["integration"]["remote_access_verified"]
    assert row["access_profile"]["effective_permissions"] == []
    state = checks(row)
    assert {state[key]["state"] for key in ("local_account", "receiver_deployment", "receiver_login")} == {"pending"}
    assert secret not in json.dumps(row)
    assert "private-owner-subject-not-for-browser" not in json.dumps(row)


def test_empty_specific_secret_blocks_legacy_fallback(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", "legacy-key-never-send-to-the-browser-000000")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", "")
    row = view("eyes")
    assert checks(row)["key"]["state"] == "blocked"
    assert not row["integration"]["can_attempt"]
    assert "project_key" not in checks(row)


@pytest.mark.parametrize("secret, ready", [("", False), ("x" * 31, False), ("x" * 32, True), (" " * 48, False)])
def test_key_length_boundary_and_whitespace_match_handoff_gate(monkeypatch, secret, ready):
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", secret)
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    row = view("eyes")
    assert row["integration"]["can_attempt"] == ready
    assert row["sso_ready"] == ready
    assert checks(row)["key"]["state"] == ("passed" if ready else "blocked")


def test_legacy_fallback_is_reported_without_its_value(monkeypatch):
    secret = "legacy-key-never-send-to-the-browser-000000"
    monkeypatch.setenv("BIDBLITZ_SSO_SHARED_SECRET", secret)
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    row = view("eyes")
    assert row["integration"]["can_attempt"]
    assert checks(row)["project_key"]["state"] == "pending"
    assert secret not in json.dumps(row)


@pytest.mark.parametrize("status", ["hidden", "coming_soon"])
def test_catalogue_gate_still_blocks_configured_issuer(monkeypatch, status):
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", "x" * 48)
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    row = view("eyes", status=status)
    assert row["integration"]["state"] == "catalogue_disabled"
    assert checks(row)["catalogue"]["state"] == "blocked"
    assert not row["integration"]["can_attempt"] and row["open_mode"] == "unavailable"


@pytest.mark.parametrize("base", ["", "https://evil.example", "https://verify.bidblitz.ae/path", "https://u:private@verify.bidblitz.ae"])
def test_invalid_target_is_blocked_without_echoing_untrusted_value(monkeypatch, base):
    monkeypatch.setenv("BIDBLITZ_SSO_VERIFY_SECRET", "x" * 48)
    monkeypatch.setenv("BIDBLITZ_SSO_VERIFY_ENABLED", "true")
    monkeypatch.setenv("BIDBLITZ_VERIFY_BASE_URL", base)
    row = view("verify", status="dev")
    assert checks(row)["destination"]["state"] == "blocked"
    assert row["open_mode"] == "unavailable"
    assert row["integration"]["receiver_setup"]["sandbox_only"]
    if base:
        assert base not in json.dumps(row)


def test_empty_owner_subject_blocks_issuer(monkeypatch):
    monkeypatch.setenv("BIDBLITZ_OWNER_ID", "")
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_SECRET", "x" * 48)
    monkeypatch.setenv("BIDBLITZ_SSO_EYES_ENABLED", "true")
    row = view("eyes")
    assert checks(row)["owner_subject"]["state"] == "blocked"
    assert not row["integration"]["can_attempt"]


def test_every_native_entry_is_local_not_an_external_sso_assertion():
    for name in NATIVE_PROJECT_PATHS:
        row = view(name)
        assert row["integration"]["state"] == "native_ready"
        assert row["integration"]["can_attempt"]
        assert row["integration"]["issuer_settings"] == []
        assert row["integration"]["receiver_setup"] is None
        hidden = view(name, status="hidden")
        assert not hidden["integration"]["can_attempt"]
        assert hidden["integration"]["state"] == "catalogue_disabled"


def test_unknown_project_cannot_claim_an_adapter_or_target_verification():
    row = admin_projects.project_view({**admin_projects._defaults()["bidtax"], "id": "custom-project", "status": "active",
                                       "integration": {"state": "issuer_ready", "remote_access_verified": True}})
    assert row["integration"]["state"] == "not_integrated"
    assert not row["integration"]["remote_access_verified"]
    assert row["integration"]["issuer_settings"] == []
    assert row["open_mode"] == "unavailable"


def test_receiver_setup_registry_matches_audited_adapters():
    assert set(RECEIVER_SETUP) == set(admin_sso.SSO_ADAPTERS)
