"""Regression guards for EV charging financial and OCPP safety.

These tests are intentionally side-effect free: they validate that the EV
charging implementation keeps using the canonical wallet engine, deterministic
idempotency references, per-user start serialization, and reservation-cap stop
guards.  No real wallet, payment provider, or charging hardware is contacted.
"""
from __future__ import annotations

import ast
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
EV_ROUTE = BACKEND / "routes" / "ev_charging.py"
OCPP16 = BACKEND / "services" / "ocpp_csms.py"
OCPP201 = BACKEND / "services" / "ocpp_v201.py"


def _source(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)  # also acts as a syntax regression check
    return text


def test_ev_router_uses_canonical_wallet_engine_only():
    src = _source(EV_ROUTE)
    assert "debit_wallet(" in src
    assert "credit_wallet(" in src
    assert "transfer_between_wallets(" in src
    assert 'db.users.update_one' not in src
    assert 'db.transactions.insert_one' not in src


def test_ev_settlement_references_are_deterministic():
    src = _source(EV_ROUTE)
    for token in (
        'EVHOLD-{session_id}',
        'EVHOLDREFUND-{session_id}',
        'EVOVER-{session_id}',
        'EVOP-{session_id}',
        'EVREF-{session_id}',
        'EVSET-{session_id}',
        'EVPAYOUT-{payout_id}',
    ):
        assert token in src


def test_ev_start_is_serialized_per_user():
    src = _source(EV_ROUTE)
    assert "ev_user_session_claims" in src
    assert "DuplicateKeyError" in src
    assert "_claim_ev_user_session" in src
    assert "_release_ev_user_session_claim" in src


def test_ev_reservation_lifecycle_is_present():
    src = _source(EV_ROUTE)
    for state in ("pending", "held", "released", "consumed", "release_failed"):
        assert f'"{state}"' in src
    assert "_refund_ev_reservation" in src
    assert "reserved_amount" in src


def test_ocpp16_enforces_reservation_cap_and_can_recover():
    src = _source(OCPP16)
    assert "cap_stop_requested_at" in src
    assert "reservation_limit" in src
    assert "_remote_stop_at_cap" in src
    assert '"stop_failed"' in src
    assert "asyncio.create_task" in src


def test_ocpp201_enforces_reservation_cap_and_can_recover():
    src = _source(OCPP201)
    assert "cap_stop_requested_at" in src
    assert "reservation_limit" in src
    assert "_remote_stop_at_cap" in src
    assert '"stop_failed"' in src
    assert "asyncio.create_task" in src
