from pathlib import Path
import ast


REPO_ROOT = Path(__file__).resolve().parents[2]
STRIPE_ROUTE = REPO_ROOT / "backend" / "routes" / "stripe.py"
TOPUP_MODAL = REPO_ROOT / "frontend" / "src" / "components" / "TopUpModal.jsx"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_quick_topup_backend_is_retry_safe_by_construction():
    source = _read(STRIPE_ROUTE)
    ast.parse(source)

    assert "idempotency_key: str = Field" in source
    assert "idempotency_key=stripe_idempotency_key" in source
    assert 'db.quick_topup_attempts.find_one({"_id": attempt_id})' in source
    assert 'idempotency_key=f"stripe-quick-topup:{intent.id}"' in source
    assert 'wallet_credit = await credit_wallet(' in source
    assert 'credited_now = not bool(wallet_credit.idempotent_replay)' in source
    assert '"status": "credited"' in source
    assert "if amount not in TOPUP_PACKAGES.values():" in source


def test_quick_topup_frontend_reuses_client_attempt_key():
    source = _read(TOPUP_MODAL)

    assert "QUICK_TOPUP_ATTEMPT_STORAGE_KEY" in source
    assert "quickTopupAttemptRef = useRef(readQuickTopupAttempt())" in source
    assert "idempotency_key: attempt.idempotencyKey" in source
    assert "rememberQuickTopupAttempt(attempt)" in source
    assert "clearQuickTopupAttempt();" in source
    assert "A previous 1-click top-up is still being verified" in source
