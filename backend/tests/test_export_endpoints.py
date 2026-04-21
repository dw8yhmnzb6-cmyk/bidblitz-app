"""
BidBlitz V2 - Export Endpoints Tests
Tests CSV export functionality for Users, Merchants, and Admins
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobility-auctions.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
TEST_USER_EMAIL = "audit_test@test.com"
TEST_USER_PASSWORD = "Test1234!"


class TestUserExports:
    """User export endpoint tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return session
    
    def test_export_user_transactions(self, admin_session):
        """Test GET /api/export/user/transactions returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/transactions")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        # Verify CSV content type
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type, f"Expected CSV, got: {content_type}"
        
        # Verify Content-Disposition header
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disp, f"Expected attachment, got: {content_disp}"
        assert '.csv' in content_disp, f"Expected .csv filename, got: {content_disp}"
        
        # Verify CSV has headers
        content = response.text
        assert 'Date' in content or 'Reference' in content, f"CSV missing expected headers: {content[:200]}"
        
        print(f"✓ User transactions export: {len(content)} bytes, headers present")
    
    def test_export_user_topups(self, admin_session):
        """Test GET /api/export/user/topups returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/topups")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        content = response.text
        assert 'Date' in content or 'Reference' in content
        
        print(f"✓ User topups export: {len(content)} bytes")
    
    def test_export_user_payments(self, admin_session):
        """Test GET /api/export/user/payments returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/payments")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ User payments export: {len(response.text)} bytes")
    
    def test_export_user_payments_sent(self, admin_session):
        """Test GET /api/export/user/payments?direction=sent returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/payments?direction=sent")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ User payments (sent) export: {len(response.text)} bytes")
    
    def test_export_user_payments_received(self, admin_session):
        """Test GET /api/export/user/payments?direction=received returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/payments?direction=received")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ User payments (received) export: {len(response.text)} bytes")
    
    def test_export_user_transactions_with_date_filter(self, admin_session):
        """Test export with date filters"""
        response = admin_session.get(f"{BASE_URL}/api/export/user/transactions?date_from=2024-01-01&date_to=2026-12-31")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ User transactions export with date filter: {len(response.text)} bytes")
    
    def test_export_unauthenticated(self):
        """Test export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/user/transactions")
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("✓ Export correctly requires authentication")


class TestMerchantExports:
    """Merchant export endpoint tests"""
    
    @pytest.fixture
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return session
    
    def test_export_merchant_payments(self, admin_session):
        """Test GET /api/export/merchant/payments returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/merchant/payments")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Merchant payments export: {len(response.text)} bytes")
    
    def test_export_merchant_fees(self, admin_session):
        """Test GET /api/export/merchant/fees returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/merchant/fees")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Merchant fees export: {len(response.text)} bytes")
    
    def test_export_merchant_payouts(self, admin_session):
        """Test GET /api/export/merchant/payouts returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/merchant/payouts")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Merchant payouts export: {len(response.text)} bytes")
    
    def test_export_merchant_settlements(self, admin_session):
        """Test GET /api/export/merchant/settlements returns CSV"""
        response = admin_session.get(f"{BASE_URL}/api/export/merchant/settlements")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Merchant settlements export: {len(response.text)} bytes")


class TestAdminExports:
    """Admin export endpoint tests - requires admin role"""
    
    @pytest.fixture
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return session
    
    @pytest.fixture
    def regular_user_session(self):
        """Create authenticated regular user session"""
        session = requests.Session()
        # First try to register, if fails (already exists), login
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Audit Test User",
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if resp.status_code != 200:
            resp = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
        if resp.status_code != 200:
            pytest.skip("Could not create/login regular user for testing")
        return session
    
    def test_export_admin_transactions(self, admin_session):
        """Test GET /api/export/admin/transactions returns CSV (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/admin/transactions")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        # Verify admin-specific columns
        content = response.text
        assert 'User ID' in content or 'user_id' in content.lower(), f"Missing User ID column: {content[:300]}"
        
        print(f"✓ Admin transactions export: {len(content)} bytes")
    
    def test_export_admin_payouts(self, admin_session):
        """Test GET /api/export/admin/payouts returns CSV (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/admin/payouts")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Admin payouts export: {len(response.text)} bytes")
    
    def test_export_admin_merchants(self, admin_session):
        """Test GET /api/export/admin/merchants returns CSV (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/admin/merchants")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Admin merchants export: {len(response.text)} bytes")
    
    def test_export_admin_revenue(self, admin_session):
        """Test GET /api/export/admin/revenue returns CSV (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/admin/revenue")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Admin revenue export: {len(response.text)} bytes")
    
    def test_export_admin_users(self, admin_session):
        """Test GET /api/export/admin/users returns CSV (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/admin/users")
        assert response.status_code == 200, f"Export failed: {response.text}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type
        
        print(f"✓ Admin users export: {len(response.text)} bytes")
    
    def test_admin_export_forbidden_for_regular_user(self, regular_user_session):
        """Test admin exports return 403 for non-admin users"""
        response = regular_user_session.get(f"{BASE_URL}/api/export/admin/transactions")
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print("✓ Admin export correctly forbidden for regular user")
    
    def test_admin_revenue_export_forbidden_for_regular_user(self, regular_user_session):
        """Test admin revenue export returns 403 for non-admin users"""
        response = regular_user_session.get(f"{BASE_URL}/api/export/admin/revenue")
        assert response.status_code == 403, f"Expected 403, got: {response.status_code}"
        print("✓ Admin revenue export correctly forbidden for regular user")


class TestReportSummaries:
    """Report summary endpoint tests (JSON responses)"""
    
    @pytest.fixture
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return session
    
    def test_user_report_summary(self, admin_session):
        """Test GET /api/export/report/user/summary returns JSON"""
        response = admin_session.get(f"{BASE_URL}/api/export/report/user/summary")
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert "period" in data
        assert "total_transactions" in data
        assert "total_income" in data
        assert "total_spent" in data
        
        print(f"✓ User report summary: {data['total_transactions']} transactions")
    
    def test_merchant_report_summary(self, admin_session):
        """Test GET /api/export/report/merchant/summary returns JSON"""
        response = admin_session.get(f"{BASE_URL}/api/export/report/merchant/summary")
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert "period" in data
        assert "total_payments" in data
        assert "total_gross" in data
        assert "total_fees" in data
        
        print(f"✓ Merchant report summary: {data['total_payments']} payments")
    
    def test_admin_report_summary(self, admin_session):
        """Test GET /api/export/report/admin/summary returns JSON (admin only)"""
        response = admin_session.get(f"{BASE_URL}/api/export/report/admin/summary")
        assert response.status_code == 200, f"Report failed: {response.text}"
        
        data = response.json()
        assert "period" in data
        assert "total_transactions" in data
        assert "total_volume" in data
        assert "total_platform_fees" in data
        assert "total_users" in data
        assert "total_merchants" in data
        
        print(f"✓ Admin report summary: {data['total_transactions']} transactions, {data['total_users']} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
