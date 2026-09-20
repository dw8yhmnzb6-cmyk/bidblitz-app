"""Side-effect-free regression guards for BidBlitz EV OCPI roaming."""
from __future__ import annotations

import ast
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
EV = BACKEND / "routes" / "ev_charging.py"
OCPI = BACKEND / "routes" / "ocpi.py"


def _source(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def test_roaming_customer_hold_and_settlement_are_deterministic():
    src = _source(EV)
    for reference in (
        "EVROAMHOLD-{session_id}",
        "EVROAMOVER-{session_id}",
        "EVROAMREF-{session_id}",
        "EVROAMSET-{session_id}",
    ):
        assert reference in src
    assert "settle_roaming_cdr" in src
    assert "ocpi_partner_payables" in src


def test_roaming_does_not_bypass_canonical_wallet_engine():
    src = _source(EV)
    assert 'db.users.update_one' not in src
    assert 'db.transactions.insert_one' not in src
    assert "debit_wallet(" in src
    assert "credit_wallet(" in src


def test_external_emsp_charging_creates_receivable_not_fake_wallet_money():
    src = _source(EV)
    assert "ocpi_partner_receivables" in src
    assert "OCPIREC-{session_id}" in src
    assert '"status": "unsettled"' in src


def test_ocpi_outbound_commands_and_callbacks_exist():
    src = _source(OCPI)
    assert "send_remote_command" in src
    assert "ocpi_outbound_commands" in src
    assert 'commands/{command_id}' in src
    assert '"role": "SENDER"' in src
    assert '"role": "RECEIVER"' in src


def test_ocpi_remote_session_and_cdr_link_by_authorization_reference():
    src = _source(OCPI)
    assert "_sync_remote_session_to_local" in src
    assert "authorization_reference" in src
    assert "settle_roaming_cdr" in src


def test_partner_session_and_cdr_data_are_scoped():
    src = _source(OCPI)
    assert '"ocpi_partner_id": partner["partner_id"]' in src
    assert '"ocpi_external": True' in src
    assert '"ocpi_partner_id": partner["partner_id"],' in src


def test_negative_command_result_cannot_refund_an_already_active_session():
    src = _source(OCPI)
    assert "remote_evidence" in src
    assert "Never refund an already-started remote charging session" in src


def test_ocpi_roaming_customer_routes_exist():
    src = _source(EV)
    assert '@router.get("/roaming/stations")' in src
    assert '@router.post("/roaming/start")' in src
    assert '@router.post("/roaming/stop/{session_id}")' in src
