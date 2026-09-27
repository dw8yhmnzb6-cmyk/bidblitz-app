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
]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_the_eye_python_modules_parse():
    for filename in ROUTES:
        path = BACKEND / "routes" / filename
        assert path.exists(), f"missing {path}"
        ast.parse(_read(path), filename=str(path))
    ast.parse(_read(BACKEND / "core" / "the_eye_live.py"))


def test_all_the_eye_routers_are_registered():
    registry = _read(BACKEND / "core" / "router_registry.py")
    expected = [name.removesuffix(".py") for name in ROUTES]
    for module in expected:
        assert f'("routes.{module}", "router")' in registry, module


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
