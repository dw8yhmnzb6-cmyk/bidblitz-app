"""
Partner Portal API Tests - BidBlitz Partner Management System
Tests: Login, Dashboard, Statistics, Stripe Connect, Document Verification, Profile
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARTNER_EMAIL = "pizza@test.de"
PARTNER_PASSWORD = "Test123!"

class TestPartnerPortalAuth:
    """Partner Portal Authentication Tests"""
    
    def test_login_success(self):
        """Test successful partner login"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "token" in data
        assert "partner" in data
        assert "success" in data
        assert data["success"] == True
        
        # Verify partner data
        partner = data["partner"]
        assert partner["email"] == PARTNER_EMAIL
        assert "id" in partner
        assert "name" in partner
        assert "business_type" in partner
        assert "commission_rate" in partner
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": "invalid@test.de",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL
        })
        assert response.status_code == 422  # Validation error


class TestPartnerDashboard:
    """Partner Dashboard API Tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_dashboard_returns_stats(self, auth_token):
        """Test dashboard returns partner stats"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/dashboard?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "partner" in data
        assert "stats" in data
        assert "vouchers" in data
        assert "recent_redemptions" in data
        
        # Verify stats structure
        stats = data["stats"]
        assert "total_sales" in stats
        assert "total_commission" in stats
        assert "pending_payout" in stats
        assert "total_payout" in stats
        assert "total_redeemed" in stats
        
        # Verify vouchers structure
        vouchers = data["vouchers"]
        assert "total" in vouchers
        assert "available" in vouchers
        assert "sold" in vouchers
        assert "redeemed" in vouchers
        
    def test_dashboard_recent_redemptions_format(self, auth_token):
        """Test recent redemptions have proper date format"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/dashboard?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        redemptions = data.get("recent_redemptions", [])
        for r in redemptions:
            assert "voucher_code" in r
            assert "value" in r
            assert "date" in r  # Should have date field
            # Date should be ISO format
            if r["date"]:
                assert "T" in r["date"]  # ISO format contains T
                
    def test_dashboard_unauthorized(self):
        """Test dashboard requires valid token"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/dashboard?token=invalid_token")
        assert response.status_code == 401


class TestPartnerStatistics:
    """Partner Statistics API Tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_statistics_returns_overview(self, auth_token):
        """Test statistics returns overview data"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/statistics?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify overview structure
        assert "overview" in data
        overview = data["overview"]
        assert "total_created" in overview
        assert "total_sold" in overview
        assert "total_redeemed" in overview
        assert "conversion_rate" in overview
        assert "redemption_rate" in overview
        
    def test_statistics_returns_financials(self, auth_token):
        """Test statistics returns financial data"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/statistics?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify financials structure
        assert "financials" in data
        financials = data["financials"]
        assert "total_sales" in financials
        assert "total_commission" in financials
        assert "pending_payout" in financials
        assert "total_paid_out" in financials
        assert "commission_rate" in financials
        
    def test_statistics_returns_chart_data(self, auth_token):
        """Test statistics returns chart data"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/statistics?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify chart_data exists
        assert "chart_data" in data
        assert isinstance(data["chart_data"], list)
        
        # Verify top_vouchers exists
        assert "top_vouchers" in data
        assert isinstance(data["top_vouchers"], list)


class TestStripeConnect:
    """Stripe Connect API Tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_account_status_returns_connection_info(self, auth_token):
        """Test Stripe account status returns connection info"""
        response = requests.get(f"{BASE_URL}/api/partner-stripe/account-status?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "connected" in data
        assert "onboarding_complete" in data
        assert "payouts_enabled" in data
        assert "charges_enabled" in data
        
        # Values should be boolean
        assert isinstance(data["connected"], bool)
        assert isinstance(data["onboarding_complete"], bool)
        assert isinstance(data["payouts_enabled"], bool)
        
    def test_payout_history_returns_list(self, auth_token):
        """Test payout history returns list"""
        response = requests.get(f"{BASE_URL}/api/partner-stripe/payout-history?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "payouts" in data
        assert "total" in data
        assert "pending_balance" in data
        assert "total_paid" in data
        
        assert isinstance(data["payouts"], list)
        assert isinstance(data["total"], int)


class TestDocumentVerification:
    """Document Verification API Tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_document_types_returns_list(self):
        """Test document types endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/partner-verification/document-types")
        assert response.status_code == 200
        data = response.json()
        
        # Should return list of document types
        assert isinstance(data, list)
        assert len(data) >= 6  # At least 6 document types
        
        # Verify document type structure
        for doc_type in data:
            assert "id" in doc_type
            assert "name" in doc_type
            assert "required" in doc_type
            
    def test_document_types_has_required_documents(self):
        """Test document types includes required documents"""
        response = requests.get(f"{BASE_URL}/api/partner-verification/document-types")
        assert response.status_code == 200
        data = response.json()
        
        # Find required documents
        required_docs = [d for d in data if d.get("required")]
        assert len(required_docs) >= 2  # At least 2 required
        
        # Check for specific required types
        doc_ids = [d["id"] for d in data]
        assert "business_registration" in doc_ids
        assert "id_document" in doc_ids
        
    def test_verification_status_returns_info(self, auth_token):
        """Test verification status returns info"""
        response = requests.get(f"{BASE_URL}/api/partner-verification/verification-status?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "overall_status" in data
        assert "is_verified" in data
        assert "document_counts" in data
        assert "required_documents" in data
        assert "approved_required" in data
        
    def test_my_documents_returns_list(self, auth_token):
        """Test my documents returns list"""
        response = requests.get(f"{BASE_URL}/api/partner-verification/my-documents?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "documents" in data
        assert "total" in data
        assert "missing_required" in data
        assert "verification_status" in data
        
        assert isinstance(data["documents"], list)
        assert isinstance(data["missing_required"], list)


class TestPartnerProfile:
    """Partner Profile API Tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/partner-portal/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
        
    def test_dashboard_returns_partner_info(self, auth_token):
        """Test dashboard returns partner profile info"""
        response = requests.get(f"{BASE_URL}/api/partner-portal/dashboard?token={auth_token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify partner info
        partner = data["partner"]
        assert "id" in partner
        assert "name" in partner
        assert "email" in partner
        assert "business_type" in partner
        assert "commission_rate" in partner
        
        # Verify business type info
        assert "business_type_info" in partner
        type_info = partner["business_type_info"]
        assert "id" in type_info
        assert "name" in type_info
        assert "icon" in type_info


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
