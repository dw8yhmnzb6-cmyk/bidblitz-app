"""
Backend-Tests für BIDBLITZ POS Settlement, Payouts und Daily Closing - Iteration 315
Testet die neuen Merchant-Finanz-Endpunkte:
- /api/merchant/balance
- /api/merchant/command-center
- /api/merchant/payouts
- /api/merchant/pos/daily-closing
- /api/admin/merchant-settlements
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test-Credentials
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def merchant_session():
    """Merchant-Login und Session-Cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Merchant-Login fehlgeschlagen: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def admin_session():
    """Admin-Login und Session-Cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin-Login fehlgeschlagen: {response.status_code} - {response.text}")
    return session


class TestMerchantBalance:
    """Tests für /api/merchant/balance"""

    def test_merchant_balance_returns_200(self, merchant_session):
        """Merchant kann Balance abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/balance")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        # Prüfe Struktur
        assert "currency" in data, "currency fehlt"
        assert "pending_minor" in data, "pending_minor fehlt"
        assert "available_minor" in data, "available_minor fehlt"
        assert "reserved_minor" in data, "reserved_minor fehlt"
        assert "payout_in_progress_minor" in data, "payout_in_progress_minor fehlt"
        assert "paid_out_total_minor" in data, "paid_out_total_minor fehlt"
        # Prüfe Typen
        assert isinstance(data["pending_minor"], int), "pending_minor muss int sein"
        assert isinstance(data["available_minor"], int), "available_minor muss int sein"

    def test_merchant_balance_requires_auth(self):
        """Balance ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/balance")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestMerchantCommandCenter:
    """Tests für /api/merchant/command-center"""

    def test_command_center_returns_200(self, merchant_session):
        """Merchant kann Command Center abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/command-center")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        # Prüfe Hauptstruktur
        assert "merchant" in data, "merchant fehlt"
        assert "balances" in data, "balances fehlt"
        assert "top_cards" in data, "top_cards fehlt"
        assert "live_status" in data, "live_status fehlt"
        assert "tasks" in data, "tasks fehlt"
        assert "settlements" in data, "settlements fehlt"
        assert "payouts" in data, "payouts fehlt"
        assert "viewer_role" in data, "viewer_role fehlt"

    def test_command_center_top_cards_structure(self, merchant_session):
        """Top Cards haben korrekte Struktur"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/command-center")
        assert response.status_code == 200
        data = response.json()
        top_cards = data.get("top_cards", {})
        expected_keys = ["today_revenue_minor", "today_profit_minor", "transactions", "customers", "open_payout_minor", "low_stock", "offline_devices", "open_tasks"]
        for key in expected_keys:
            assert key in top_cards, f"{key} fehlt in top_cards"

    def test_command_center_live_status_structure(self, merchant_session):
        """Live Status hat korrekte Struktur"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/command-center")
        assert response.status_code == 200
        data = response.json()
        live_status = data.get("live_status", {})
        expected_keys = ["all_systems_operational", "offline_pos", "offline_printer", "offline_scanner", "payout_delay", "inventory_warning"]
        for key in expected_keys:
            assert key in live_status, f"{key} fehlt in live_status"

    def test_command_center_requires_auth(self):
        """Command Center ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/command-center")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestMerchantPayouts:
    """Tests für /api/merchant/payouts"""

    def test_payouts_list_returns_200(self, merchant_session):
        """Merchant kann Payouts abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/payouts")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        assert "rows" in data, "rows fehlt"
        assert isinstance(data["rows"], list), "rows muss Liste sein"

    def test_payouts_instant_availability(self, merchant_session):
        """Sofortauszahlung ist nicht verfügbar"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/payouts/instant-availability")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}"
        data = response.json()
        assert "available" in data, "available fehlt"
        assert data["available"] is False, "Sofortauszahlung sollte nicht verfügbar sein"

    def test_payouts_requires_auth(self):
        """Payouts ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/payouts")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestMerchantDailyClosing:
    """Tests für /api/merchant/pos/daily-closing"""

    def test_daily_closing_preview_returns_200(self, merchant_session):
        """Merchant kann Daily Closing Preview abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/pos/daily-closing")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        # Prüfe Struktur
        expected_keys = ["date", "gross_sales_minor", "net_sales_minor", "expected_cash_minor", "cash_sales_minor", "card_sales_minor", "refunds_minor", "report_number"]
        for key in expected_keys:
            assert key in data, f"{key} fehlt in daily closing"

    def test_daily_closing_with_date_param(self, merchant_session):
        """Daily Closing mit Datum-Parameter"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant/pos/daily-closing?date=2026-08-01")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}"
        data = response.json()
        assert data.get("date") == "2026-08-01", f"Datum sollte 2026-08-01 sein, ist {data.get('date')}"

    def test_daily_closing_requires_auth(self):
        """Daily Closing ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/merchant/pos/daily-closing")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestMerchantSettlements:
    """Tests für /api/merchant-settlements"""

    def test_settlements_list_returns_200(self, merchant_session):
        """Merchant kann Settlements abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-settlements")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        assert "rows" in data, "rows fehlt"
        assert isinstance(data["rows"], list), "rows muss Liste sein"

    def test_settlements_overview_returns_200(self, merchant_session):
        """Merchant kann Settlement Overview abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-settlements/overview")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}"
        data = response.json()
        assert "balances" in data, "balances fehlt"
        assert "settlements" in data, "settlements fehlt"
        assert "payouts" in data, "payouts fehlt"

    def test_settlements_requires_auth(self):
        """Settlements ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/merchant-settlements")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestAdminMerchantSettlements:
    """Tests für /api/admin/merchant-settlements"""

    def test_admin_settlements_returns_200(self, admin_session):
        """Admin kann alle Settlements abrufen"""
        response = admin_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        assert "settlements" in data, "settlements fehlt"
        assert "payouts" in data, "payouts fehlt"
        assert "balances" in data, "balances fehlt"
        assert isinstance(data["settlements"], list), "settlements muss Liste sein"
        assert isinstance(data["payouts"], list), "payouts muss Liste sein"
        assert isinstance(data["balances"], list), "balances muss Liste sein"

    def test_admin_settlements_requires_admin(self, merchant_session):
        """Merchant kann Admin-Settlements nicht abrufen"""
        response = merchant_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
        assert response.status_code == 403, f"Erwartet 403, erhalten {response.status_code}"

    def test_admin_settlements_requires_auth(self):
        """Admin-Settlements ohne Auth gibt 401"""
        response = requests.get(f"{BASE_URL}/api/admin/merchant-settlements")
        assert response.status_code == 401, f"Erwartet 401, erhalten {response.status_code}"


class TestSettlementCalculation:
    """Tests für Settlement-Berechnung"""

    def test_calculate_settlement_returns_200(self, merchant_session):
        """Merchant kann Settlement berechnen"""
        response = merchant_session.post(f"{BASE_URL}/api/merchant-settlements/calculate", json={
            "period_type": "daily",
            "idempotency_key": f"test-calc-iter315-{os.urandom(4).hex()}"
        })
        assert response.status_code == 200, f"Erwartet 200, erhalten {response.status_code}: {response.text}"
        data = response.json()
        assert "preview" in data, "preview fehlt"
        assert "settlement" in data, "settlement fehlt"
        preview = data["preview"]
        assert "gross_sales_minor" in preview, "gross_sales_minor fehlt in preview"
        assert "net_amount_minor" in preview, "net_amount_minor fehlt in preview"

    def test_calculate_settlement_idempotency(self, merchant_session):
        """Settlement-Berechnung ist idempotent"""
        idempotency_key = f"test-idem-iter315-{os.urandom(4).hex()}"
        response1 = merchant_session.post(f"{BASE_URL}/api/merchant-settlements/calculate", json={
            "period_type": "daily",
            "idempotency_key": idempotency_key
        })
        assert response1.status_code == 200
        settlement_id_1 = response1.json().get("settlement", {}).get("settlement_id")
        
        response2 = merchant_session.post(f"{BASE_URL}/api/merchant-settlements/calculate", json={
            "period_type": "daily",
            "idempotency_key": idempotency_key
        })
        assert response2.status_code == 200
        settlement_id_2 = response2.json().get("settlement", {}).get("settlement_id")
        
        assert settlement_id_1 == settlement_id_2, "Idempotenz verletzt: unterschiedliche Settlement-IDs"


class TestSettlementDetail:
    """Tests für Settlement-Detail"""

    def test_settlement_detail_not_found(self, merchant_session):
        """Nicht existierendes Settlement gibt 404"""
        response = merchant_session.get(f"{BASE_URL}/api/merchant-settlements/NONEXISTENT-123")
        assert response.status_code == 404, f"Erwartet 404, erhalten {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
