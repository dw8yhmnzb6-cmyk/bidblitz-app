"""Side-effect-free guards for OCPI/OCPP reservation support."""
from __future__ import annotations

import ast
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
OCPI = BACKEND / "routes" / "ocpi.py"
OCPP16 = BACKEND / "services" / "ocpp_csms.py"
OCPP201 = BACKEND / "services" / "ocpp_v201.py"


def _source(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def test_ocpi_receiver_supports_all_five_command_types():
    src = _source(OCPI)
    for command in (
        "START_SESSION",
        "STOP_SESSION",
        "UNLOCK_CONNECTOR",
        "RESERVE_NOW",
        "CANCEL_RESERVATION",
    ):
        assert f'commands/{command}' in src


def test_ocpp_16_supports_reserve_and_cancel():
    src = _source(OCPP16)
    assert "async def reserve_now" in src
    assert '"ReserveNow"' in src
    assert "async def cancel_reservation" in src
    assert '"CancelReservation"' in src


def test_ocpp_201_supports_reserve_and_cancel():
    src = _source(OCPP201)
    assert "async def reserve_now" in src
    assert '"ReserveNow"' in src
    assert "async def cancel_reservation" in src
    assert '"CancelReservation"' in src


def test_external_reservation_ids_are_partner_scoped():
    src = _source(OCPI)
    assert '"partner_id": partner["partner_id"]' in src
    assert '"external_reservation_id": reservation_id' in src
    assert "_next_ocpp_reservation_id" in src


def test_ocpi_reservation_creates_session_and_authorization():
    src = _source(OCPI)
    assert '"status": "reserving"' in src
    assert '"ocpi_reservation_id": reservation_id' in src
    assert "db.ev_authorizations.update_one" in src
    assert "db.ev_charging_sessions.update_one" in src


def test_reserved_session_can_bind_to_real_connector():
    src16 = _source(OCPP16)
    src201 = _source(OCPP201)
    assert '"connector_id": 0' in src16
    assert '"status": {"$in": ["reserved", "reserving"]}' in src16
    assert '"status": {"$in": ["reserved", "reserving"]}' in src201


def test_cancel_only_operates_on_calling_partners_reservation():
    src = _source(OCPI)
    start = src.index("async def command_cancel_reservation")
    end = src.index('commands/START_SESSION', start)
    block = src[start:end]
    assert '"partner_id": partner["partner_id"]' in block
    assert '"external_reservation_id": reservation_id' in block
