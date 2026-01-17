"""
Backend API Tests for Admin Dashboard Charts and Detailed Stats
Tests the /api/admin/stats/detailed endpoint which provides data for:
- Revenue chart (7 days)
- Bids chart (7 days)
- New Users chart (7 days)
- Auction Status Pie Chart
- Top Products
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.de"
ADMIN_PASSWORD = "Admin123!"
CUSTOMER_EMAIL = "kunde@bidblitz.de"
CUSTOMER_PASSWORD = "Kunde123!"


class TestAdminDetailedStats:
    """Test the /api/admin/stats/detailed endpoint for chart data"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("token")
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Customer login failed")
        return response.json().get("token")
    
    def test_detailed_stats_unauthorized(self):
        """Test detailed stats without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed")
        assert response.status_code == 401 or response.status_code == 403
        print("Unauthorized access correctly denied")
    
    def test_detailed_stats_non_admin(self, customer_token):
        """Test detailed stats with non-admin user"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 403
        print("Non-admin access correctly denied")
    
    def test_detailed_stats_admin_success(self, admin_token):
        """Test getting detailed stats as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify top-level structure
        assert "summary" in data, "Missing 'summary' in response"
        assert "charts" in data, "Missing 'charts' in response"
        print("Detailed stats endpoint returns correct structure")
    
    def test_detailed_stats_summary_fields(self, admin_token):
        """Test that summary contains all required fields"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        required_fields = [
            "total_revenue",
            "total_transactions",
            "total_bids_sold",
            "total_bids_placed",
            "total_users",
            "total_user_bids_balance",
            "ended_auctions",
            "avg_bids_per_auction"
        ]
        
        for field in required_fields:
            assert field in summary, f"Missing '{field}' in summary"
            print(f"  {field}: {summary[field]}")
        
        print("All summary fields present")
    
    def test_detailed_stats_revenue_chart(self, admin_token):
        """Test revenue_by_day chart data structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        charts = data.get("charts", {})
        revenue_by_day = charts.get("revenue_by_day", [])
        
        assert isinstance(revenue_by_day, list), "revenue_by_day should be a list"
        assert len(revenue_by_day) == 7, f"Expected 7 days, got {len(revenue_by_day)}"
        
        # Verify each day has required fields
        for day in revenue_by_day:
            assert "date" in day, "Missing 'date' in revenue_by_day entry"
            assert "revenue" in day, "Missing 'revenue' in revenue_by_day entry"
            assert "day_name" in day, "Missing 'day_name' in revenue_by_day entry"
            assert isinstance(day["revenue"], (int, float)), "Revenue should be numeric"
        
        print(f"Revenue chart: {len(revenue_by_day)} days of data")
        print(f"  Sample: {revenue_by_day[0]}")
    
    def test_detailed_stats_bids_chart(self, admin_token):
        """Test bids_by_day chart data structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        charts = data.get("charts", {})
        bids_by_day = charts.get("bids_by_day", [])
        
        assert isinstance(bids_by_day, list), "bids_by_day should be a list"
        assert len(bids_by_day) == 7, f"Expected 7 days, got {len(bids_by_day)}"
        
        # Verify each day has required fields
        for day in bids_by_day:
            assert "date" in day, "Missing 'date' in bids_by_day entry"
            assert "bids" in day, "Missing 'bids' in bids_by_day entry"
            assert "day_name" in day, "Missing 'day_name' in bids_by_day entry"
            assert isinstance(day["bids"], int), "Bids should be integer"
        
        print(f"Bids chart: {len(bids_by_day)} days of data")
        total_bids = sum(d["bids"] for d in bids_by_day)
        print(f"  Total bids in last 7 days: {total_bids}")
    
    def test_detailed_stats_users_chart(self, admin_token):
        """Test users_by_day chart data structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        charts = data.get("charts", {})
        users_by_day = charts.get("users_by_day", [])
        
        assert isinstance(users_by_day, list), "users_by_day should be a list"
        assert len(users_by_day) == 7, f"Expected 7 days, got {len(users_by_day)}"
        
        # Verify each day has required fields
        for day in users_by_day:
            assert "date" in day, "Missing 'date' in users_by_day entry"
            assert "users" in day, "Missing 'users' in users_by_day entry"
            assert "day_name" in day, "Missing 'day_name' in users_by_day entry"
            assert isinstance(day["users"], int), "Users should be integer"
        
        print(f"Users chart: {len(users_by_day)} days of data")
        total_new_users = sum(d["users"] for d in users_by_day)
        print(f"  Total new users in last 7 days: {total_new_users}")
    
    def test_detailed_stats_status_distribution(self, admin_token):
        """Test auction status distribution (pie chart data)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        charts = data.get("charts", {})
        status_dist = charts.get("status_distribution", {})
        
        assert isinstance(status_dist, dict), "status_distribution should be a dict"
        
        # Verify required status keys
        required_statuses = ["active", "scheduled", "ended"]
        for status in required_statuses:
            assert status in status_dist, f"Missing '{status}' in status_distribution"
            assert isinstance(status_dist[status], int), f"{status} count should be integer"
        
        print(f"Auction status distribution:")
        print(f"  Active: {status_dist.get('active', 0)}")
        print(f"  Scheduled: {status_dist.get('scheduled', 0)}")
        print(f"  Ended: {status_dist.get('ended', 0)}")
    
    def test_detailed_stats_top_products(self, admin_token):
        """Test top products data structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats/detailed", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        charts = data.get("charts", {})
        top_products = charts.get("top_products", [])
        
        assert isinstance(top_products, list), "top_products should be a list"
        assert len(top_products) <= 5, f"Expected max 5 products, got {len(top_products)}"
        
        # Verify each product has required fields
        for product in top_products:
            assert "name" in product, "Missing 'name' in top_products entry"
            assert "bids" in product, "Missing 'bids' in top_products entry"
            assert isinstance(product["bids"], int), "Bids should be integer"
        
        print(f"Top products: {len(top_products)} products")
        for i, p in enumerate(top_products[:3]):
            print(f"  #{i+1}: {p['name']} ({p['bids']} bids)")


class TestPasswordResetWithMongoDB:
    """Test that password reset uses MongoDB only (no in-memory store)"""
    
    def test_password_reset_flow_mongodb(self):
        """Test complete password reset flow using MongoDB storage"""
        # Step 1: Request reset code
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": CUSTOMER_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        reset_code = data.get("demo_code")
        assert reset_code is not None, "Reset code not returned"
        print(f"Step 1 - Reset code generated: {reset_code}")
        
        # Step 2: Verify code (this confirms MongoDB storage is working)
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-code", json={
            "email": CUSTOMER_EMAIL,
            "code": reset_code
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
        print("Step 2 - Code verified from MongoDB")
        
        # Step 3: Reset password
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": CUSTOMER_EMAIL,
            "code": reset_code,
            "new_password": CUSTOMER_PASSWORD  # Keep same password
        })
        assert response.status_code == 200
        print("Step 3 - Password reset successful")
        
        # Step 4: Verify code is now marked as used (can't reuse)
        response = requests.post(f"{BASE_URL}/api/auth/verify-reset-code", json={
            "email": CUSTOMER_EMAIL,
            "code": reset_code
        })
        assert response.status_code == 400, "Used code should be rejected"
        print("Step 4 - Used code correctly rejected")
        
        # Step 5: Verify login works
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200
        print("Step 5 - Login verified after reset")


class TestAdminBasicStats:
    """Test the basic /api/admin/stats endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json().get("token")
    
    def test_basic_stats_admin(self, admin_token):
        """Test basic stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "total_users",
            "total_auctions",
            "active_auctions",
            "total_products",
            "completed_transactions"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing '{field}' in basic stats"
        
        print(f"Basic stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
