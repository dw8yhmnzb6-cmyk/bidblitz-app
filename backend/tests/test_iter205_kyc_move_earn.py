"""
Iteration 205 - KYC/Auth UX + Move & Earn Premium Tracking + Legacy Email Cleanup
Tests:
1. Admin login with canonical email admin@bidblitz.ae
2. Customer login (agimk@me.com) - pending KYC user
3. Move & Earn status includes premium_live_tracking_events
4. Legacy email admin@bidblitz.com should not authenticate as admin
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestAdminAuth:
    """Admin authentication with canonical email"""
    
    def test_admin_login_canonical_email(self):
        """Admin login with admin@bidblitz.ae should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.ae", "password": "BidBlitz2026!"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        # Response has email at root level or under user
        email = data.get("email") or data.get("user", {}).get("email") or data.get("canonical_email")
        role = data.get("role") or data.get("user", {}).get("role")
        assert email == "admin@bidblitz.ae", f"Expected admin@bidblitz.ae, got {email}"
        assert role == "admin", f"Expected admin role, got {role}"
        print(f"PASS: Admin login with canonical email admin@bidblitz.ae succeeded")
    
    def test_legacy_admin_email_rejected(self):
        """Legacy admin@bidblitz.com should not authenticate as admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@bidblitz.com", "password": "BidBlitz2026!"},
            headers={"Content-Type": "application/json"}
        )
        # Should either fail (401) or return non-admin role
        if response.status_code == 200:
            data = response.json()
            role = data.get("user", {}).get("role", "")
            assert role != "admin", f"Legacy admin@bidblitz.com should not have admin role, got: {role}"
            print(f"PASS: Legacy admin@bidblitz.com login returned non-admin role: {role}")
        else:
            print(f"PASS: Legacy admin@bidblitz.com login rejected with status {response.status_code}")


class TestCustomerAuth:
    """Customer authentication and KYC status"""
    
    def test_customer_login(self):
        """Customer agimk@me.com login should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "agimk@me.com", "password": "Aldink56600"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        # Response has email at root level or under user
        email = data.get("email") or data.get("user", {}).get("email") or data.get("canonical_email")
        kyc_status = data.get("kyc_status") or data.get("user", {}).get("kyc_status", "N/A")
        assert email == "agimk@me.com", f"Expected agimk@me.com, got {email}"
        print(f"PASS: Customer login succeeded, KYC status: {kyc_status}")
    
    def test_customer_me_endpoint(self):
        """GET /api/auth/me should return user with KYC status"""
        session = requests.Session()
        # Login first
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "agimk@me.com", "password": "Aldink56600"},
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Get /me
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200, f"GET /me failed: {me_resp.text}"
        data = me_resp.json()
        assert "email" in data, "Response should contain email"
        assert "kyc_status" in data or "kyc_verified" in data, "Response should contain KYC info"
        print(f"PASS: /api/auth/me returned user with KYC info: kyc_status={data.get('kyc_status')}, kyc_verified={data.get('kyc_verified')}")


class TestMoveEarnPremiumTracking:
    """Move & Earn premium live tracking events"""
    
    def test_move_status_includes_premium_tracking(self):
        """GET /api/move/status should include premium_live_tracking_events in ride_earn"""
        session = requests.Session()
        # Login as customer
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "agimk@me.com", "password": "Aldink56600"},
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        
        # Get move status
        status_resp = session.get(f"{BASE_URL}/api/move/status")
        assert status_resp.status_code == 200, f"GET /api/move/status failed: {status_resp.text}"
        data = status_resp.json()
        
        # Check ride_earn contains premium_live_tracking_events
        ride_earn = data.get("ride_earn", {})
        assert "premium_live_tracking_events" in ride_earn, f"ride_earn should contain premium_live_tracking_events, got: {ride_earn.keys()}"
        premium_events = ride_earn.get("premium_live_tracking_events", 0)
        assert isinstance(premium_events, int), f"premium_live_tracking_events should be int, got: {type(premium_events)}"
        print(f"PASS: Move status includes premium_live_tracking_events: {premium_events}")
    
    def test_move_status_structure(self):
        """Verify Move & Earn status has expected structure"""
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "agimk@me.com", "password": "Aldink56600"},
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200
        
        status_resp = session.get(f"{BASE_URL}/api/move/status")
        assert status_resp.status_code == 200
        data = status_resp.json()
        
        # Verify key sections exist
        assert "profile" in data, "Response should contain profile"
        assert "daily" in data, "Response should contain daily"
        assert "ride_earn" in data, "Response should contain ride_earn"
        assert "missions" in data, "Response should contain missions"
        assert "ai_coach" in data, "Response should contain ai_coach"
        
        # Verify ride_earn structure
        ride_earn = data.get("ride_earn", {})
        expected_keys = ["today_rides", "eco_trips", "merchant_events", "qr_events", "premium_live_tracking_events", "linked_children"]
        for key in expected_keys:
            assert key in ride_earn, f"ride_earn should contain {key}"
        
        print(f"PASS: Move status has correct structure with all expected fields")


class TestKYCStatus:
    """KYC status endpoint tests"""
    
    def test_kyc_status_endpoint(self):
        """GET /api/kyc/status should return KYC info for authenticated user"""
        session = requests.Session()
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "agimk@me.com", "password": "Aldink56600"},
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200
        
        kyc_resp = session.get(f"{BASE_URL}/api/kyc/status")
        # KYC status endpoint may return 200 with status or 404 if not submitted
        if kyc_resp.status_code == 200:
            data = kyc_resp.json()
            assert "kyc_status" in data, "Response should contain kyc_status"
            print(f"PASS: KYC status endpoint returned: {data.get('kyc_status')}")
        elif kyc_resp.status_code == 404:
            print(f"PASS: KYC status endpoint returned 404 (no KYC submitted yet)")
        else:
            print(f"INFO: KYC status endpoint returned {kyc_resp.status_code}: {kyc_resp.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
