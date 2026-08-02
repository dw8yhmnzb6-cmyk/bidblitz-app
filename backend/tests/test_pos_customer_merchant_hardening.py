from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from routes.pos_system import _build_receipt_html, _is_pending_payment_active


def test_pending_payment_active_respects_future_expiry():
    payment = {
        "status": "pending",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
    }
    assert _is_pending_payment_active(payment) is True


def test_pending_payment_active_rejects_expired_attempt():
    payment = {
        "status": "pending",
        "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
    }
    assert _is_pending_payment_active(payment) is False


def test_receipt_html_uses_same_total_as_transaction():
    sale = {
        "receipt_id": "RCP-123",
        "created_at": "2026-08-02T12:00:00+00:00",
        "register_id": "REG-1",
        "cashier_id": "cashier-1",
        "items": [{"quantity": 2, "name": "Latte Macchiato Extra Large", "line_total": 12.50}],
        "subtotal": 12.50,
        "discount": 0,
        "tax_total": 2.00,
        "total": 12.50,
        "method": "cash",
        "payment_id": "PAY-1",
    }
    merchant = {"business_name": "BidBlitz Café"}
    store = {"name": "Innenstadt", "address": "Musterstraße 1", "city": "Berlin", "country": "DE"}

    html = _build_receipt_html(sale, merchant, store)

    assert "Gesamt:" in html
    assert "€12.50" in html
    assert html.count("€12.50") >= 2