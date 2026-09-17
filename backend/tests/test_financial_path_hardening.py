from pathlib import Path

from routes.p2p_transfer import transfer_reference


BACKEND_ROOT = Path(__file__).resolve().parents[1]
P2P_ROUTE = BACKEND_ROOT / "routes" / "p2p_transfer.py"
REFERRAL_ROUTE = BACKEND_ROOT / "routes" / "referral.py"
COINBASE_ROUTE = BACKEND_ROOT / "routes" / "coinbase_commerce.py"
EXTRAS_ROUTE = BACKEND_ROOT / "routes" / "extras.py"
PRO_FEATURES_ROUTE = BACKEND_ROOT / "routes" / "pro_features.py"
LADESAEULEN_ROUTE = BACKEND_ROOT / "routes" / "ladesaeulen.py"
LEGACY_EV_WALLET = BACKEND_ROOT / "core" / "legacy_ev_wallet.py"
ADVERTISING_ROUTE = BACKEND_ROOT / "routes" / "advertising.py"


def _function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_p2p_client_idempotency_reference_is_stable():
    first = transfer_reference("sender", "recipient", 12.34, "checkout-123")
    second = transfer_reference("sender", "recipient", 12.34, "checkout-123")
    changed_amount = transfer_reference("sender", "recipient", 12.35, "checkout-123")
    changed_recipient = transfer_reference("sender", "recipient-2", 12.34, "checkout-123")
    assert first == second
    assert first.startswith("P2P-")
    assert first != changed_amount
    assert first != changed_recipient


def test_p2p_transfer_uses_canonical_engine_not_direct_balance_writes():
    source = P2P_ROUTE.read_text(encoding="utf-8")
    block = _function_block(source, "async def instant_transfer", "# ══════════════════════════════════════════════════════════════════════════════\n# QR CODE TRANSFER")
    assert "transfer_between_wallets(" in block
    assert "TransactionType.TRANSFER" in block
    assert "Idempotency-Key" in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_many" not in block


def test_referral_reward_uses_canonical_idempotent_wallet_credits():
    source = REFERRAL_ROUTE.read_text(encoding="utf-8")
    helper = _function_block(source, "async def _grant_referral_wallet_reward", '@router.get("/check-rewards")')
    block = _function_block(source, "async def check_and_grant_rewards", '@router.get("/leaderboard")')
    assert "credit_wallet(" in helper
    assert "TransactionType.REWARD" in helper
    assert 'idempotency_key = f"referral:{reward_scope_id}:{leg}"' in helper
    assert '"reward_scope_id": reward_scope_id' in helper
    assert "_grant_referral_wallet_reward(" in block
    assert "reward_scope_id=user_id" in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block
    assert '"reward_given": False' in block
    assert "db.referrals.update_many(" in block
    assert "marked.modified_count > 0" in block


def test_referral_apply_serializes_claim_and_uses_deterministic_document_id():
    source = REFERRAL_ROUTE.read_text(encoding="utf-8")
    block = _function_block(source, "async def apply_referral_code", "async def _grant_referral_wallet_reward")
    assert '"referred_by": {"$exists": False}' in block
    assert "claim.modified_count != 1" in block
    assert '"_id": f"referral:{user_id}"' in block
    assert '"$unset": {"referred_by": "", "referral_code_used": ""}' in block


def test_referral_leaderboard_deduplicates_legacy_duplicate_documents():
    source = REFERRAL_ROUTE.read_text(encoding="utf-8")
    block = source[source.index("async def referral_leaderboard"):]
    assert '"referred_id": "$referred_id"' in block
    assert '"reward_amount": {"$max": "$reward_amount"}' in block


def test_coinbase_confirmation_uses_canonical_idempotent_wallet_credit():
    source = COINBASE_ROUTE.read_text(encoding="utf-8")
    block = _function_block(source, "async def _process_event", "def _oid")
    assert "credit_wallet(" in block
    assert "TransactionType.TOPUP" in block
    assert 'idempotency_key=f"coinbase_charge:{charge_id}"' in block
    assert 'source="coinbase_commerce"' in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block
    assert '"status": "confirmed"' in block
    assert '"wallet_transaction_id": result.transaction_id' in block
    assert "if not result.success:" in block


def test_promo_redemption_claims_once_and_uses_canonical_credit():
    source = EXTRAS_ROUTE.read_text(encoding="utf-8")
    block = _function_block(source, 'async def redeem_promo', '@router.post("/promo/create")')
    assert "find_one_and_update(" in block
    assert '"redemption_markers": {"$ne": marker}' in block
    assert '"$addToSet": {"used_by": email, "redemption_markers": marker}' in block
    assert "credit_wallet(" in block
    assert "TransactionType.REWARD" in block
    assert "idempotency_key=marker" in block
    assert '"$inc": {"balance"' not in block


def test_pro_features_block_legacy_money_paths_and_demo_kyc_in_production():
    source = PRO_FEATURES_ROUTE.read_text(encoding="utf-8")
    assert "from core.config import TEST_MODE, IS_PRODUCTION" in source
    assert "def _block_legacy_wallet_charge" in source
    assert "if IS_PRODUCTION:" in source
    assert '_block_legacy_wallet_charge("Express-KYC")' in source
    assert '_block_legacy_wallet_charge("Banner-Kauf")' in source
    assert '_block_legacy_wallet_charge("Kostenpflichtiger Steuerbericht")' in source
    kyc_block = _function_block(source, "async def submit_kyc", '@router.get("/kyc/status")')
    assert "if TEST_MODE:" in kyc_block
    assert '"status": "pending"' in kyc_block


def test_legacy_ev_start_uses_canonical_retry_safe_reservation():
    source = LEGACY_EV_WALLET.read_text(encoding="utf-8")
    block = _function_block(source, 'async def start_legacy_ev_session', 'async def stop_legacy_ev_session')
    assert "debit_wallet(" in block
    assert "TransactionType.EV_CHARGING" in block
    assert "idempotency_key=reserve_key" in block
    assert '"active_legacy_ev_session_id": candidate' in block
    assert '"active_session_markers": {"$ne": session_id}' in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block


def test_legacy_ev_stop_persists_terms_and_settles_canonically_once():
    source = LEGACY_EV_WALLET.read_text(encoding="utf-8")
    block = source[source.index('async def stop_legacy_ev_session'):]
    assert '"status": "stopping"' in block
    assert '"settlement_kwh": kwh' in block
    assert '"settlement_cost": cost' in block
    assert "debit_wallet(" in block
    assert "credit_wallet(" in block
    assert 'idempotency_key=f"{stop_key}:charge"' in block
    assert 'idempotency_key=f"{stop_key}:cashback"' in block
    assert '"completed_session_markers": {"$ne": req.session_id}' in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block


def test_legacy_ev_route_delegates_money_mutations_to_hardened_service():
    source = LADESAEULEN_ROUTE.read_text(encoding="utf-8")
    assert "start_legacy_ev_session(req, request)" in source
    assert "stop_legacy_ev_session(req, request)" in source
    assert '"$inc": {"balance"' not in source


def test_ad_campaign_budget_uses_canonical_idempotent_wallet_debit():
    source = ADVERTISING_ROUTE.read_text(encoding="utf-8")
    block = _function_block(source, 'async def create_ad_campaign', '@router.get("/campaigns")')
    assert "debit_wallet(" in block
    assert "TransactionType.PURCHASE" in block
    assert 'idempotency_key=f"ads:campaign:{campaign_id}"' in block
    assert '"wallet_transaction_id": charge.transaction_id' in block
    assert '"$setOnInsert": campaign' in block
    assert '"$inc": {"balance"' not in block
    assert "db.transactions.insert_one" not in block
