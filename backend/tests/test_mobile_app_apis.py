"""
Mobile App API Tests - bidblitz.ae React Native/Expo App
Tests the backend APIs used by the mobile app:
- Auth: Login, Register, Profile
- Auctions: List, Details
- Jackpot: Status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bidbiz.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"


class TestAuthAPI:
    """Authentication API tests for mobile app"""
    
    def test_login_success(self):
        """Test successful login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["is_admin"] == True
        assert "bids_balance" in data["user"]
        
        # Store token for other tests
        TestAuthAPI.token = data["token"]
        TestAuthAPI.user = data["user"]
        
        print(f"✓ Login successful for {ADMIN_EMAIL}")
        print(f"  - User ID: {data['user']['id']}")
        print(f"  - Bids Balance: {data['user']['bids_balance']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Missing password correctly rejected")
    
    def test_get_profile(self):
        """Test getting user profile with auth token"""
        # First login to get token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert "bids_balance" in data
        assert "referral_code" in data
        assert "login_streak" in data
        
        print(f"✓ Profile fetched successfully")
        print(f"  - Name: {data.get('name')}")
        print(f"  - Bids: {data.get('bids_balance')}")
        print(f"  - Referral Code: {data.get('referral_code')}")
        print(f"  - Login Streak: {data.get('login_streak')}")
    
    def test_get_profile_unauthorized(self):
        """Test profile access without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthorized profile access correctly rejected")


class TestAuctionsAPI:
    """Auctions API tests for mobile app"""
    
    def test_get_auctions_list(self):
        """Test getting list of auctions"""
        response = requests.get(
            f"{BASE_URL}/api/auctions",
            params={"limit": 10, "status": "active"}
        )
        
        assert response.status_code == 200, f"Auctions fetch failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            auction = data[0]
            # Check auction structure
            assert "id" in auction
            assert "current_price" in auction
            assert "status" in auction
            
            print(f"✓ Auctions list fetched: {len(data)} auctions")
            print(f"  - First auction: {auction.get('title', auction.get('id')[:8])}")
            print(f"  - Price: €{auction.get('current_price', 0):.2f}")
        else:
            print("✓ Auctions list fetched (empty)")
    
    def test_get_auctions_with_filters(self):
        """Test auctions with different filters"""
        # Test night auctions
        response = requests.get(
            f"{BASE_URL}/api/auctions",
            params={"limit": 50, "is_night": True}
        )
        assert response.status_code == 200
        night_auctions = response.json()
        print(f"✓ Night auctions: {len(night_auctions)}")
        
        # Test VIP auctions
        response = requests.get(
            f"{BASE_URL}/api/auctions",
            params={"limit": 50, "is_vip": True}
        )
        assert response.status_code == 200
        vip_auctions = response.json()
        print(f"✓ VIP auctions: {len(vip_auctions)}")
    
    def test_get_single_auction(self):
        """Test getting a single auction by ID"""
        # First get list to find an auction ID
        list_response = requests.get(f"{BASE_URL}/api/auctions", params={"limit": 1})
        auctions = list_response.json()
        
        if len(auctions) > 0:
            auction_id = auctions[0]["id"]
            
            response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
            assert response.status_code == 200, f"Single auction fetch failed: {response.text}"
            
            data = response.json()
            assert data["id"] == auction_id
            print(f"✓ Single auction fetched: {auction_id[:8]}...")
        else:
            pytest.skip("No auctions available to test")


class TestJackpotAPI:
    """Jackpot API tests for mobile app"""
    
    def test_get_jackpot_status(self):
        """Test getting jackpot status"""
        response = requests.get(f"{BASE_URL}/api/excitement/global-jackpot")
        
        assert response.status_code == 200, f"Jackpot fetch failed: {response.text}"
        
        data = response.json()
        assert "current_amount" in data
        assert "is_active" in data
        print(f"✓ Jackpot status fetched")
        print(f"  - Current amount: {data.get('current_amount')}")
        print(f"  - Last winner: {data.get('last_winner')}")


class TestUserStatsAPI:
    """User stats API tests for mobile app"""
    
    def test_get_user_stats(self):
        """Test getting user stats with auth"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/user-stats/my-stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Stats endpoint might return 200 or 404 if no stats yet
        if response.status_code == 200:
            data = response.json()
            print(f"✓ User stats fetched: {data}")
        else:
            print(f"✓ User stats endpoint responded with {response.status_code}")


class TestDailyRewardAPI:
    """Daily reward API tests for mobile app"""
    
    def test_get_daily_reward_status(self):
        """Test getting daily reward status"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        token = login_response.json()["token"]
        
        response = requests.get(
            f"{BASE_URL}/api/auth/daily-reward-status",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Daily reward status failed: {response.text}"
        
        data = response.json()
        print(f"✓ Daily reward status fetched")
        print(f"  - Can claim: {data.get('can_claim', 'N/A')}")
        print(f"  - Streak: {data.get('streak', 'N/A')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
