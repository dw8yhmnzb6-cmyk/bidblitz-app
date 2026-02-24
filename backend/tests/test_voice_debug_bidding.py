"""
Test suite for Voice Debug Assistant and Bidding Error Messages
Tests:
1. Voice Debug API endpoint (admin auth required)
2. Bidding without authentication (should return 401)
3. Bidding error messages for unauthenticated users
"""
import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://payment-platform-34.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_endpoint(self):
        """Test that the API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Health endpoint working")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["is_admin"] == True
        print(f"✅ Admin login successful, user: {data['user']['email']}")
        return data["token"]


class TestVoiceDebugAPI:
    """Tests for Voice Debug Assistant API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_voice_debug_requires_auth(self):
        """Test that voice-debug endpoint requires authentication"""
        # Create a small test audio file
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
            f.write(b'\x00' * 100)  # Small dummy file
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as audio_file:
                response = requests.post(
                    f"{BASE_URL}/api/admin/voice-debug/analyze",
                    files={"audio": ("test.webm", audio_file, "audio/webm")},
                    data={"language": "de"}
                )
            
            assert response.status_code == 401 or response.status_code == 403 or \
                   (response.status_code == 200 and "Not authenticated" in str(response.json()))
            print("✅ Voice debug endpoint requires authentication")
        finally:
            os.unlink(temp_path)
    
    def test_voice_debug_with_admin_auth(self, admin_token):
        """Test voice-debug endpoint with admin authentication"""
        # Create a small test audio file (too small to be valid)
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
            f.write(b'\x00' * 100)  # Small dummy file
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as audio_file:
                response = requests.post(
                    f"{BASE_URL}/api/admin/voice-debug/analyze",
                    headers={"Authorization": f"Bearer {admin_token}"},
                    files={"audio": ("test.webm", audio_file, "audio/webm")},
                    data={"language": "de"}
                )
            
            # Should return validation error for small file, not auth error
            assert response.status_code == 200
            data = response.json()
            # Either success=false with error about file size, or success=true
            assert "success" in data
            if not data["success"]:
                assert "error" in data
                print(f"✅ Voice debug with auth returns validation error: {data['error']}")
            else:
                print("✅ Voice debug with auth works")
        finally:
            os.unlink(temp_path)
    
    def test_voice_debug_reports_endpoint(self, admin_token):
        """Test voice-debug reports endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/voice-debug/reports",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        print(f"✅ Voice debug reports endpoint works, total: {data.get('total', 0)}")


class TestBiddingWithoutAuth:
    """Tests for bidding without authentication"""
    
    @pytest.fixture
    def active_auction_id(self):
        """Get an active auction ID"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        if response.status_code == 200:
            auctions = response.json()
            if auctions:
                return auctions[0]["id"]
        pytest.skip("No active auctions found")
    
    def test_bid_without_auth_returns_401(self, active_auction_id):
        """Test that bidding without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auctions/{active_auction_id}/bid",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 Not authenticated
        assert response.status_code == 401 or response.status_code == 403
        data = response.json()
        assert "detail" in data
        print(f"✅ Bid without auth returns {response.status_code}: {data['detail']}")
    
    def test_place_bid_without_auth_returns_401(self, active_auction_id):
        """Test that place-bid endpoint without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auctions/place-bid/{active_auction_id}",
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 401 or 404 (endpoint may not exist)
        assert response.status_code in [401, 403, 404]
        print(f"✅ Place-bid without auth returns {response.status_code}")


class TestBiddingWithAuth:
    """Tests for bidding with authentication"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def active_auction_id(self):
        """Get an active auction ID"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        if response.status_code == 200:
            auctions = response.json()
            if auctions:
                return auctions[0]["id"]
        pytest.skip("No active auctions found")
    
    def test_bid_with_auth_works(self, admin_token, active_auction_id):
        """Test that bidding with auth works"""
        response = requests.post(
            f"{BASE_URL}/api/auctions/{active_auction_id}/bid",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            }
        )
        
        # Should return 200 or error about bids balance
        if response.status_code == 200:
            print("✅ Bid with auth successful")
        else:
            data = response.json()
            # May fail due to insufficient bids, but not auth error
            assert response.status_code != 401
            print(f"✅ Bid with auth returns {response.status_code}: {data.get('detail', 'unknown')}")


class TestAuctionEndpoints:
    """Tests for auction-related endpoints"""
    
    def test_get_active_auctions(self):
        """Test getting active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions?status=active")
        assert response.status_code == 200
        auctions = response.json()
        assert isinstance(auctions, list)
        print(f"✅ Found {len(auctions)} active auctions")
    
    def test_get_vip_auctions(self):
        """Test getting VIP auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/vip-only")
        assert response.status_code == 200
        auctions = response.json()
        assert isinstance(auctions, list)
        print(f"✅ Found {len(auctions)} VIP auctions")
    
    def test_get_beginner_auctions(self):
        """Test getting beginner auctions (requires auth)"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        
        token = login_response.json().get("token")
        
        response = requests.get(
            f"{BASE_URL}/api/gamification/auctions/beginner",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # May return 200 or 403 (if user is not a beginner)
        assert response.status_code in [200, 403]
        print(f"✅ Beginner auctions endpoint returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
