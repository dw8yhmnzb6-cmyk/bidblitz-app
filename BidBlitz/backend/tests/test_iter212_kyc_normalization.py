"""
Iteration 212 - KYC Status Normalization Tests
Tests that legacy KYC statuses (verified, failed, error) are normalized to (approved, rejected)
in both /api/kyc/status and /api/admin/customers endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestKYCStatusNormalization:
    """Test KYC status normalization in admin customer endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}
        )
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        yield
        self.session.close()
    
    def test_admin_customers_no_legacy_verified_status(self):
        """Verify /api/admin/customers does not return raw 'verified' status"""
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=100")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        for customer in customers:
            kyc_status = customer.get("kyc_status", "")
            assert kyc_status != "verified", f"Found legacy 'verified' status for {customer.get('email')}"
    
    def test_admin_customers_no_legacy_failed_status(self):
        """Verify /api/admin/customers does not return raw 'failed' status"""
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=100")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        for customer in customers:
            kyc_status = customer.get("kyc_status", "")
            assert kyc_status != "failed", f"Found legacy 'failed' status for {customer.get('email')}"
    
    def test_admin_customers_no_legacy_error_status(self):
        """Verify /api/admin/customers does not return raw 'error' status"""
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=100")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        for customer in customers:
            kyc_status = customer.get("kyc_status", "")
            assert kyc_status != "error", f"Found legacy 'error' status for {customer.get('email')}"
    
    def test_admin_customers_valid_kyc_statuses_only(self):
        """Verify all KYC statuses are in the valid normalized set"""
        valid_statuses = {"not_started", "pending", "submitted", "approved", "rejected"}
        
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=100")
        assert resp.status_code == 200
        data = resp.json()
        customers = data.get("customers", [])
        
        for customer in customers:
            kyc_status = customer.get("kyc_status", "not_started")
            assert kyc_status in valid_statuses, f"Invalid KYC status '{kyc_status}' for {customer.get('email')}"
    
    def test_admin_customer_detail_no_legacy_status(self):
        """Verify individual customer detail endpoint normalizes status"""
        # First get a customer ID
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=1")
        assert resp.status_code == 200
        customers = resp.json().get("customers", [])
        
        if customers:
            user_id = customers[0].get("user_id")
            detail_resp = self.session.get(f"{BASE_URL}/api/admin/customers/{user_id}")
            assert detail_resp.status_code == 200
            
            customer = detail_resp.json().get("customer", {})
            kyc_status = customer.get("kyc_status", "")
            assert kyc_status not in ["verified", "failed", "error"], f"Legacy status found in detail: {kyc_status}"
    
    def test_rejected_customer_has_rejection_reason(self):
        """Verify rejected customers have kyc_rejection_reason populated"""
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?q=iter191&limit=10")
        assert resp.status_code == 200
        customers = resp.json().get("customers", [])
        
        rejected_customers = [c for c in customers if c.get("kyc_status") == "rejected"]
        
        for customer in rejected_customers:
            reason = customer.get("kyc_rejection_reason")
            assert reason is not None and len(reason) > 0, f"Rejected customer {customer.get('email')} missing rejection reason"


class TestKYCStatusEndpoint:
    """Test /api/kyc/status endpoint normalization"""
    
    def test_kyc_status_returns_normalized_status(self):
        """Verify /api/kyc/status returns normalized status for admin"""
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}
        )
        assert login_resp.status_code == 200
        
        status_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert status_resp.status_code == 200
        
        data = status_resp.json()
        kyc_status = data.get("kyc_status")
        
        # Admin should have approved status
        assert kyc_status == "approved", f"Expected 'approved' for admin, got '{kyc_status}'"
        assert data.get("kyc_verified") == True
        
        session.close()
    
    def test_kyc_status_valid_statuses_only(self):
        """Verify /api/kyc/status only returns valid normalized statuses"""
        valid_statuses = {"not_started", "pending", "submitted", "approved", "rejected"}
        
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}
        )
        assert login_resp.status_code == 200
        
        status_resp = session.get(f"{BASE_URL}/api/kyc/status")
        assert status_resp.status_code == 200
        
        kyc_status = status_resp.json().get("kyc_status")
        assert kyc_status in valid_statuses, f"Invalid KYC status: {kyc_status}"
        
        session.close()


class TestKYCStatusDistribution:
    """Test KYC status distribution in customer list"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"}
        )
        assert login_resp.status_code == 200
        yield
        self.session.close()
    
    def test_kyc_status_distribution(self):
        """Report KYC status distribution (informational test)"""
        resp = self.session.get(f"{BASE_URL}/api/admin/customers?limit=200")
        assert resp.status_code == 200
        customers = resp.json().get("customers", [])
        
        status_counts = {}
        for customer in customers:
            status = customer.get("kyc_status", "not_started")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print(f"\nKYC Status Distribution (total: {len(customers)}):")
        for status, count in sorted(status_counts.items()):
            print(f"  {status}: {count}")
        
        # Verify no legacy statuses
        legacy_statuses = {"verified", "failed", "error"}
        found_legacy = set(status_counts.keys()) & legacy_statuses
        assert len(found_legacy) == 0, f"Found legacy statuses: {found_legacy}"
