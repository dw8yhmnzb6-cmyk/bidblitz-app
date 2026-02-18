"""
Test Voucher Bot System and Cashback Promotions
- POST /api/admin/bots/configure-voucher-bots
- GET /api/admin/bots/voucher-bot-status
- POST /api/cashback/admin/create-promotion/{partner_id}
- GET /api/cashback/admin/promotions
- DELETE /api/cashback/admin/remove-promotion/{partner_id}
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVoucherBotSystem:
    """Tests for Voucher Bot Configuration System"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@bidblitz.ae",
            "password": "Admin123!"
        })
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_configure_voucher_bots(self):
        """Test POST /api/admin/bots/configure-voucher-bots"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/bots/configure-voucher-bots",
            params={"min_percent": 10, "max_percent": 30}
        )
        
        assert response.status_code == 200, f"Configure bots failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "configured" in data
        assert "min_percent" in data
        assert "max_percent" in data
        assert data["min_percent"] == 10
        assert data["max_percent"] == 30
        
        print(f"✓ Configured bots for {data['configured']} voucher auctions")
    
    def test_configure_voucher_bots_custom_percent(self):
        """Test configure bots with custom percentage range"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/bots/configure-voucher-bots",
            params={"min_percent": 15, "max_percent": 25}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["min_percent"] == 15
        assert data["max_percent"] == 25
        
        print(f"✓ Custom percent range (15-25%) configured")
    
    def test_configure_voucher_bots_invalid_percent(self):
        """Test configure bots with invalid percentage (should fail)"""
        # min > max should fail
        response = self.session.post(
            f"{BASE_URL}/api/admin/bots/configure-voucher-bots",
            params={"min_percent": 40, "max_percent": 20}
        )
        
        assert response.status_code == 400
        print("✓ Invalid percent range correctly rejected")
    
    def test_get_voucher_bot_status(self):
        """Test GET /api/admin/bots/voucher-bot-status"""
        response = self.session.get(f"{BASE_URL}/api/admin/bots/voucher-bot-status")
        
        assert response.status_code == 200, f"Get bot status failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_voucher_auctions" in data
        assert "active_bots" in data
        assert "auctions" in data
        assert isinstance(data["auctions"], list)
        
        # Verify auction info structure if auctions exist
        if data["auctions"]:
            auction = data["auctions"][0]
            assert "auction_id" in auction
            assert "title" in auction
            assert "current_price" in auction
            assert "bot_target_price" in auction
            assert "bot_active" in auction
            assert "status" in auction
        
        print(f"✓ Bot status: {data['total_voucher_auctions']} auctions, {data['active_bots']} active bots")


class TestCashbackPromotions:
    """Tests for Cashback Promotion Admin System"""
    
    TEST_PARTNER_ID = "c3a39d45-e356-44d0-8c10-742c6d60bdaa"
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - no auth required for these endpoints"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_promotions(self):
        """Test GET /api/cashback/admin/promotions"""
        response = self.session.get(f"{BASE_URL}/api/cashback/admin/promotions")
        
        assert response.status_code == 200, f"Get promotions failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "promotions" in data
        assert "total" in data
        assert isinstance(data["promotions"], list)
        
        print(f"✓ Found {data['total']} active promotions")
    
    def test_create_promotion(self):
        """Test POST /api/cashback/admin/create-promotion/{partner_id}"""
        response = self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{self.TEST_PARTNER_ID}",
            json={"special_rate": 7.5, "duration_days": 10}
        )
        
        assert response.status_code == 200, f"Create promotion failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert data.get("special_rate") == 7.5
        assert data.get("duration_days") == 10
        assert "partner_name" in data
        assert "ends_at" in data
        
        print(f"✓ Created promotion: {data['special_rate']}% for {data['partner_name']}")
    
    def test_create_promotion_invalid_rate(self):
        """Test create promotion with invalid rate (>10%)"""
        response = self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{self.TEST_PARTNER_ID}",
            json={"special_rate": 15, "duration_days": 7}
        )
        
        assert response.status_code == 400
        print("✓ Invalid rate (>10%) correctly rejected")
    
    def test_create_promotion_invalid_duration(self):
        """Test create promotion with invalid duration (>30 days)"""
        response = self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{self.TEST_PARTNER_ID}",
            json={"special_rate": 8, "duration_days": 45}
        )
        
        assert response.status_code == 400
        print("✓ Invalid duration (>30 days) correctly rejected")
    
    def test_create_promotion_invalid_partner(self):
        """Test create promotion for non-existent partner"""
        fake_partner_id = str(uuid.uuid4())
        response = self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{fake_partner_id}",
            json={"special_rate": 8, "duration_days": 7}
        )
        
        assert response.status_code == 404
        print("✓ Non-existent partner correctly rejected")
    
    def test_remove_promotion(self):
        """Test DELETE /api/cashback/admin/remove-promotion/{partner_id}"""
        # First create a promotion
        self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{self.TEST_PARTNER_ID}",
            json={"special_rate": 6, "duration_days": 5}
        )
        
        # Then remove it
        response = self.session.delete(
            f"{BASE_URL}/api/cashback/admin/remove-promotion/{self.TEST_PARTNER_ID}"
        )
        
        assert response.status_code == 200, f"Remove promotion failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "partner_name" in data
        
        print(f"✓ Removed promotion for {data['partner_name']}")
    
    def test_promotion_lifecycle(self):
        """Test full promotion lifecycle: create -> verify -> delete -> verify"""
        # 1. Create promotion
        create_response = self.session.post(
            f"{BASE_URL}/api/cashback/admin/create-promotion/{self.TEST_PARTNER_ID}",
            json={"special_rate": 9, "duration_days": 7}
        )
        assert create_response.status_code == 200
        
        # 2. Verify it appears in list
        list_response = self.session.get(f"{BASE_URL}/api/cashback/admin/promotions")
        assert list_response.status_code == 200
        promotions = list_response.json()["promotions"]
        partner_ids = [p["partner_id"] for p in promotions]
        assert self.TEST_PARTNER_ID in partner_ids
        
        # 3. Delete promotion
        delete_response = self.session.delete(
            f"{BASE_URL}/api/cashback/admin/remove-promotion/{self.TEST_PARTNER_ID}"
        )
        assert delete_response.status_code == 200
        
        # 4. Verify it's removed
        list_response2 = self.session.get(f"{BASE_URL}/api/cashback/admin/promotions")
        assert list_response2.status_code == 200
        promotions2 = list_response2.json()["promotions"]
        partner_ids2 = [p["partner_id"] for p in promotions2]
        assert self.TEST_PARTNER_ID not in partner_ids2
        
        print("✓ Full promotion lifecycle test passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
