from pathlib import Path
import ast

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
ROUTES = [
    "the_eye_devices.py",
    "the_eye_ws.py",
    "the_eye_search.py",
    "the_eye_locations.py",
    "the_eye_cameras.py",
    "the_eye_network.py",
    "the_eye_incidents.py",
    "the_eye_actions.py",
    "the_eye_maintenance.py",
    "the_eye_data_quality.py",
    "the_eye_providers.py",
    "the_eye_projects.py",
    "the_eye_security.py",
    "the_eye_executive.py",
    "the_eye_aion.py",
    "the_eye_continuity.py",
    "the_eye_readiness.py",
]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_the_eye_python_modules_parse():
    for filename in ROUTES:
        path = BACKEND / "routes" / filename
        assert path.exists(), f"missing {path}"
        ast.parse(_read(path), filename=str(path))
    ast.parse(_read(BACKEND / "core" / "the_eye_live.py"))
    ast.parse(_read(BACKEND / "core" / "the_eye_access.py"))
    ast.parse(_read(BACKEND / "core" / "the_eye_data_safety.py"))
    ast.parse(_read(BACKEND / "core" / "the_eye_root_cause.py"))


def test_all_the_eye_routers_are_registered():
    registry = _read(BACKEND / "core" / "router_registry.py")
    expected = [name.removesuffix(".py") for name in ROUTES]
    for module in expected:
        assert f'("routes.{module}", "router")' in registry, module


def test_the_eye_rbac_and_scope_isolation_contract():
    access = _read(BACKEND / "core" / "the_eye_access.py")
    devices = _read(BACKEND / "routes" / "the_eye_devices.py")
    cameras = _read(BACKEND / "routes" / "the_eye_cameras.py")

    for role in [
        "super_admin", "admin", "project_admin", "site_manager",
        "technician", "customer", "partner", "public",
    ]:
        assert f'"{role}"' in access

    assert "scope_query" in access
    assert "_deny_all_query" in access
    assert '"project_id"' in devices and '"tenant_id"' in devices and '"customer_id"' in devices
    assert "access.scope_query(query)" in devices
    assert '"project_id"' in cameras and '"tenant_id"' in cameras and '"customer_id"' in cameras
    assert "camera_query = access.scope_query" in cameras


def test_high_impact_actions_are_approval_gated():
    security = _read(BACKEND / "routes" / "the_eye_security.py")
    aion = _read(BACKEND / "routes" / "the_eye_aion.py")
    for action in ["bulk_restart", "bulk_ota", "disable_site", "config_change"]:
        assert action in security
        assert action in aion
    assert "requires_approval" in aion
    assert "will_execute_now" in aion
    assert 'approval.get("status") != "approved"' in aion


def test_camera_credentials_never_reach_browser_contract():
    cameras = _read(BACKEND / "routes" / "the_eye_cameras.py")
    frontend = _read(ROOT / "frontend" / "src" / "pages" / "TheEyePage.jsx")
    assert '"rtsp_url"' in cameras
    assert '"credentials"' in cameras
    assert "rtsp://" not in frontend.lower()
    assert "camera credentials are never exposed to the browser" in cameras


def test_connector_tokens_are_hashed_and_scoped():
    projects = _read(BACKEND / "routes" / "the_eye_projects.py")
    assert "sha256" in projects
    assert "token_hash" in projects
    assert "required_scope" in projects
    assert '"kpis.write"' in projects
    assert '"events.write"' in projects


def test_emergency_modes_and_continuity_contract():
    continuity = _read(BACKEND / "routes" / "the_eye_continuity.py")
    for mode in ["normal", "read_only", "lockdown"]:
        assert mode in continuity
    for drill in [
        "database_restore",
        "server_failover",
        "internet_failover",
        "provider_failover",
        "mqtt_failure",
        "power_failure",
        "edge_offline",
        "deployment_rollback",
        "firmware_rollback",
    ]:
        assert drill in continuity


def test_emergency_write_guard_is_wired_to_operator_actions():
    guard = _read(BACKEND / "core" / "the_eye_guard.py")
    devices = _read(BACKEND / "routes" / "the_eye_devices.py")
    aion = _read(BACKEND / "routes" / "the_eye_aion.py")
    assert "read_only" in guard
    assert "lockdown" in guard
    assert 'require_the_eye_writes_allowed("device_command")' in devices
    assert 'require_the_eye_writes_allowed("firmware_release")' in devices
    assert 'require_the_eye_writes_allowed("aion_execute")' in aion


def test_readiness_never_claims_production_ready():
    readiness = _read(BACKEND / "routes" / "the_eye_readiness.py")
    assert "production_ready = False" in readiness
    assert "successful CI/build" in readiness


def test_operational_routes_use_scoped_rbac():
    incidents = _read(BACKEND / "routes" / "the_eye_incidents.py")
    actions = _read(BACKEND / "routes" / "the_eye_actions.py")
    maintenance = _read(BACKEND / "routes" / "the_eye_maintenance.py")

    for source in [incidents, actions, maintenance]:
        assert "require_the_eye_access" in source
        assert "scope_query" in source

    for field in ["project_id", "tenant_id", "customer_id", "site_id"]:
        assert f'"{field}"' in incidents
        assert f'"{field}"' in actions

    assert "_scope_owned" in actions
    assert '"technician"' in actions
    assert "_scope_owned" in maintenance
    assert "_inventory_scope" in maintenance
    assert "assigned_site_id" in maintenance
    assert "access.assert_document" in incidents
    assert "access.assert_document" in actions
    assert "access.assert_document" in maintenance


def test_location_search_and_project_scope_contracts():
    locations = _read(BACKEND / "routes" / "the_eye_locations.py")
    search = _read(BACKEND / "routes" / "the_eye_search.py")
    projects = _read(BACKEND / "routes" / "the_eye_projects.py")

    assert '"world"' in locations
    assert '"country": {"world"}' in locations
    assert "access.scope_query" in locations
    assert "access.assert_document" in locations
    assert "device_query = access.scope_query" in search
    assert "camera_query = access.scope_query" in search
    assert "location_query = access.scope_query" in search
    assert "_project_scope" in projects
    assert '"schema_version"' in projects
    assert '"project_admin"' in projects


def test_security_and_provider_scope_hardening_contracts():
    access = _read(BACKEND / "core" / "the_eye_access.py")
    security = _read(BACKEND / "routes" / "the_eye_security.py")
    providers = _read(BACKEND / "routes" / "the_eye_providers.py")

    assert "current_values = _clean_ids(current)" in access
    assert 'effective_mode: ApprovalMode = "four_eyes" if high_impact else req.mode' in security
    assert "access.scope_query" in security
    assert '"project_id"' in security
    assert '"tenant_id"' in security
    assert '"customer_id"' in security
    assert '"site_id"' in security

    assert "_provider_scope" in providers
    assert '"project_ids"' in providers
    assert "PROVIDER_SCOPE_MAP" in providers
    assert "access.assert_document(doc, field_map=PROVIDER_SCOPE_MAP)" in providers


def test_central_emergency_write_policy_contract():
    guard = _read(BACKEND / "core" / "the_eye_guard.py")
    middleware = _read(BACKEND / "core" / "middleware.py")
    continuity = _read(BACKEND / "routes" / "the_eye_continuity.py")

    assert "classify_the_eye_write" in guard
    assert '"observation"' in guard
    assert '"recovery"' in guard
    assert '"control"' in guard
    assert "commands/ack" in guard
    assert "stream-session" in guard
    assert "admin/aion/query" in guard
    assert "connectors/[^/]+/(snapshot|events)" in guard

    assert "the_eye_emergency_write_guard" in middleware
    assert 'mode in {"read_only", "lockdown"}' in middleware
    assert "status_code=423" in middleware
    assert '"write_class": write_class' in middleware

    assert "_require_super_admin" in continuity
    assert 'require_the_eye_access(request, {"super_admin"})' in continuity


def test_recursive_data_safety_contract():
    safety = _read(BACKEND / "core" / "the_eye_data_safety.py")
    live = _read(BACKEND / "core" / "the_eye_live.py")
    security = _read(BACKEND / "routes" / "the_eye_security.py")

    for classification in [
        "public", "internal", "confidential", "sensitive", "restricted",
    ]:
        assert f'"{classification}"' in safety

    for restricted_key in [
        "password", "access_token", "refresh_token", "api_key",
        "client_secret", "private_key", "credentials", "rtsp_url",
    ]:
        assert f'"{restricted_key}"' in safety

    assert "sanitize_the_eye_payload(payload)" in live
    assert "sanitize_the_eye_payload(before)" in security
    assert "sanitize_the_eye_payload(after)" in security
    assert "safe_the_eye_document(doc)" in security


def test_the_eye_database_integrity_and_connector_idempotency_contract():
    database = _read(BACKEND / "core" / "database.py")
    projects = _read(BACKEND / "routes" / "the_eye_projects.py")

    for collection_field in [
        'the_eye_devices, "device_id"',
        'the_eye_device_commands, "command_id"',
        'the_eye_cameras, "camera_id"',
        'the_eye_locations, "location_id"',
        'the_eye_incidents, "incident_id"',
        'the_eye_tickets, "ticket_id"',
        'the_eye_work_orders, "work_order_id"',
        'the_eye_projects, "project_key"',
        'the_eye_project_connectors, "connector_id"',
        'the_eye_approvals, "approval_id"',
    ]:
        assert collection_field in database

    assert '[("project_key", 1), ("event_id", 1)]' in database
    assert '[("project_key", 1), ("snapshot_id", 1)]' in database
    assert "unique=True, critical=True" in database

    assert "DuplicateKeyError" in projects
    assert "except DuplicateKeyError" in projects
    assert "snapshot_id: Optional[str]" in projects
    assert "schema_version: str" in projects
    assert '"duplicate": True' in projects


def test_device_command_lifecycle_is_fail_closed_and_idempotent():
    devices = _read(BACKEND / "routes" / "the_eye_devices.py")
    database = _read(BACKEND / "core" / "database.py")

    assert "idempotency_key: Optional[str]" in devices
    assert "find_one_and_update" in devices
    assert "ReturnDocument.AFTER" in devices
    assert '"delivery_attempts": 0' in devices
    assert '"status": "expired"' in devices
    assert '"status": "unknown"' in devices
    assert "ack_timeout_no_blind_resend" in devices
    assert "accepted_without_final_result" in devices
    assert '"delivery_policy": "no_blind_resend"' in devices
    assert 'current_status not in {"delivered", "accepted", "unknown"}' in devices
    assert '@router.get("/admin/devices/{device_id}/commands")' in devices
    assert "DuplicateKeyError" in devices

    assert '[("device_id", 1), ("idempotency_key", 1)]' in database
    assert "sparse=True" in database


def test_incident_state_machine_is_enforced():
    incidents = _read(BACKEND / "routes" / "the_eye_incidents.py")

    assert "INCIDENT_TRANSITIONS" in incidents
    assert '"new": {"acknowledged"}' in incidents
    assert '"acknowledged": {"investigating"}' in incidents
    assert '"investigating": {"mitigating", "resolved"}' in incidents
    assert '"mitigating": {"resolved"}' in incidents
    assert '"resolved": {"closed"}' in incidents
    assert '"closed": set()' in incidents
    assert "_validate_incident_transition(current_status, req.status)" in incidents
    assert "Invalid incident transition" in incidents
    assert '"unchanged": True' in incidents


def test_readiness_is_evidence_based_and_fail_closed():
    readiness = _read(BACKEND / "routes" / "the_eye_readiness.py")
    database = _read(BACKEND / "core" / "database.py")

    assert "CODE_EVIDENCE_KEYS" in readiness
    assert "STAGING_EVIDENCE_KEYS" in readiness
    assert "_evidence_state" in readiness
    assert "_evidence_checks" in readiness
    assert 'all(item["passed"] for item in code_checks.values())' in readiness
    assert 'all(item["passed"] for item in staging_checks.values())' in readiness
    assert "production_ready = False" in readiness
    assert '"device_hub": True' not in readiness
    assert '@router.post("/admin/readiness/evidence")' in readiness
    assert "_require_super_admin" in readiness
    assert 'the_eye_readiness_evidence, "key"' in database


def test_aion_data_trust_is_fail_closed():
    aion = _read(BACKEND / "routes" / "the_eye_aion.py")
    quality = _read(BACKEND / "routes" / "the_eye_data_quality.py")

    assert "overall_trust = round(sum(scores) / len(scores), 1) if scores else None" in quality
    assert '"unknown"' in quality
    assert "trust = max(0, 100 - penalty) if source_count else None" in quality

    assert "_confidence_for_quality" in aion
    assert "ACTION_MIN_DATA_TRUST" in aion
    assert '"restart_device": 70.0' in aion
    assert '"bulk_restart": 90.0' in aion
    assert '"bulk_ota": 90.0' in aion
    assert '"disable_site": 90.0' in aion
    assert '"config_change": 90.0' in aion
    assert '"create_ticket": 0.0' in aion
    assert "data trust is UNKNOWN" in aion
    assert "below required" in aion
    assert "_assert_action_data_trust(req.action_type, quality)" in aion
    assert '_assert_action_data_trust(str(action_type or ""), quality)' in aion
    assert '"data_trust_score": quality.get("trust")' in aion
    assert '"minimum_data_trust": minimum_data_trust' in aion

    assert 'idempotency_key = f"aion:{approval_id}"' in aion
    assert '"delivery_attempts": 0' in aion
    assert "DuplicateKeyError" in aion


def test_root_cause_output_is_explicitly_probabilistic():
    helper = _read(BACKEND / "core" / "the_eye_root_cause.py")
    network = _read(BACKEND / "routes" / "the_eye_network.py")
    incidents = _read(BACKEND / "routes" / "the_eye_incidents.py")
    aion = _read(BACKEND / "routes" / "the_eye_aion.py")

    for key in ["fact", "likely_cause", "confidence", "recommended_check"]:
        assert f'"{key}"' in helper

    assert "build_root_cause_assessment" in network
    assert "health_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None" in network
    assert '"health_state": health_state' in network
    assert '"root_cause_assessment"' in incidents
    assert '"recommended_checks"' in incidents
    assert "Likely Cause:" in aion


def test_frontend_never_presents_preview_data_as_live_truth():
    frontend = _read(ROOT / "frontend" / "src" / "pages" / "TheEyePage.jsx")

    assert "MOCK_DEVICES" not in frontend
    for fake_value in ["177.721", "12.438", "39.217", "Feuer-Warnung",
                       "Flugzeug über Gebiet", "Schiff erkannt",
                       "Alle Kerndienste online"]:
        assert fake_value not in frontend

    assert 'setDeviceDataState("unavailable")' in frontend
    assert 'overall_trust: null' in frontend
    assert 'continuity_score: null' in frontend
    assert 'status: "unknown"' in frontend
    assert 'data_trust_score: null' in frontend
    assert "systemStatus.label" in frontend
    assert 'value="—"' in frontend
