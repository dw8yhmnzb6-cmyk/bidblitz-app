from pathlib import Path

from core.middleware import _is_unbacked_legacy_payout_process


PAYOUT_ROUTE = Path(__file__).resolve().parents[1] / "routes" / "payout.py"


def test_production_blocks_unbacked_legacy_process_action():
    assert _is_unbacked_legacy_payout_process(
        "/api/admin/payouts/PO-ABC123/action",
        "POST",
        b'{"action":"process"}',
        is_production=True,
    ) is True


def test_production_allows_non_terminal_legacy_payout_actions():
    for action in ("approve", "fail", "cancel"):
        assert _is_unbacked_legacy_payout_process(
            "/api/admin/payouts/PO-ABC123/action",
            "POST",
            (f'{{"action":"{action}"}}').encode(),
            is_production=True,
        ) is False


def test_non_production_keeps_existing_process_flow_available():
    assert _is_unbacked_legacy_payout_process(
        "/api/admin/payouts/PO-ABC123/action",
        "POST",
        b'{"action":"process"}',
        is_production=False,
    ) is False


def test_guard_ignores_other_paths_methods_and_malformed_json():
    assert _is_unbacked_legacy_payout_process(
        "/api/admin/users/action",
        "POST",
        b'{"action":"process"}',
        is_production=True,
    ) is False
    assert _is_unbacked_legacy_payout_process(
        "/api/admin/payouts/PO-ABC123/action",
        "GET",
        b'{"action":"process"}',
        is_production=True,
    ) is False
    assert _is_unbacked_legacy_payout_process(
        "/api/admin/payouts/PO-ABC123/action",
        "POST",
        b"not-json",
        is_production=True,
    ) is False


def test_payout_request_serializes_reservation_and_releases_lock():
    source = PAYOUT_ROUTE.read_text(encoding="utf-8")

    assert "payout_request_lock_token" in source
    assert "payout_request_lock_until" in source
    assert "A payout request is already being created" in source
    assert "finally:" in source
    assert '"$unset": {"payout_request_lock_token": "", "payout_request_lock_until": ""}' in source

    # Financial state must be re-read after the lock is acquired rather than relying
    # on a pre-lock availability snapshot that two concurrent requests can share.
    lock_pos = source.index("lock_result = await lock_collection.update_one")
    reread_pos = source.index("merchant, merchant_profile = await _get_merchant_sources(user_id)", lock_pos)
    summary_pos = source.index("payout_summary = await _build_payout_summary", lock_pos)
    insert_pos = source.index("await db.payouts.insert_one(payout_doc)", lock_pos)
    assert lock_pos < reread_pos < summary_pos < insert_pos
