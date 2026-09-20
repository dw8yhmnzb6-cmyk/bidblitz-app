"""Static OCPI 2.2.1 contract regression guards.

No network, payment provider, or charge point is contacted by these tests.
"""
from __future__ import annotations

import ast
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
OCPI = BACKEND / "routes" / "ocpi.py"
REGISTRY = BACKEND / "core" / "router_registry.py"


def _source(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def test_ocpi_router_is_registered_and_syntax_valid():
    src = _source(OCPI)
    registry = _source(REGISTRY)
    assert 'router = APIRouter(prefix="/ocpi"' in src
    assert '("routes.ocpi", "router")' in registry


def test_ocpi_221_credentials_and_modules_are_advertised():
    src = _source(OCPI)
    assert 'OCPI_VERSION = "2.2.1"' in src
    for identifier in ("credentials", "locations", "tariffs", "sessions", "cdrs", "tokens", "commands"):
        assert f'"identifier": "{identifier}"' in src


def test_ocpi_credentials_use_base64_and_endpoint_discovery():
    src = _source(OCPI)
    assert "base64.b64encode" in src
    assert "_auth_token_candidates" in src
    assert "_fetch_remote_endpoints" in src
    assert "remote_endpoints" in src


def test_ocpi_command_direct_response_enum_is_restricted():
    src = _source(OCPI)
    assert '{"NOT_SUPPORTED", "REJECTED", "ACCEPTED", "UNKNOWN_SESSION"}' in src
    assert "_post_command_result" in src
    assert "asyncio.create_task" in src


def test_ocpi_start_session_does_not_require_pre_pushed_token():
    src = _source(OCPI)
    assert "CPO SHALL NOT validate the Token" in src
    command_start = src.index("async def command_start_session")
    command_stop = src.index("async def command_stop_session", command_start)
    block = src[command_start:command_stop]
    assert "ocpi_remote_tokens.find_one" not in block
    assert "_remote_token_owned_by_partner" in block


def test_ocpi_pull_endpoints_support_required_pagination_contract():
    src = _source(OCPI)
    assert 'response.headers["X-Total-Count"]' in src
    assert 'response.headers["X-Limit"]' in src
    assert 'rel="next"' in src
    assert "date_from" in src
    assert "date_to" in src


def test_ocpi_cdr_receiver_returns_retrievable_location():
    src = _source(OCPI)
    assert 'response.headers["Location"]' in src
    assert 'async def emsp_cdr_get' in src


def test_ocpi_external_callbacks_are_https_and_ssrf_guarded():
    src = _source(OCPI)
    assert 'parsed.scheme != "https"' in src
    assert "ip.is_global" in src
    assert "follow_redirects=False" in src
    assert "trust_env=False" in src
