"""
Restaurant Features API Tests
Tests for Restaurant Discovery, Reviews, Loyalty Program, and Restaurant Portal APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://auction-platform-25.preview.emergentagent.com')

class TestRestaurantDiscovery:
    """Restaurant Discovery API tests"""
    
    def test_discover_restaurants(self):
        """GET /api/restaurants/discover - Returns list of restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurants/discover")
        assert response.status_code == 200
        
        data = response.json()
        assert "restaurants" in data
        assert isinstance(data["restaurants"], list)
        
        if len(data["restaurants"]) > 0:
            restaurant = data["restaurants"][0]
            assert "id" in restaurant
            assert "restaurant_name" in restaurant
            assert "avg_rating" in restaurant
            print(f"✅ Found {len(data['restaurants'])} restaurants")
    
    def test_get_categories(self):
        """GET /api/restaurants/categories - Returns restaurant categories"""
        response = requests.get(f"{BASE_URL}/api/restaurants/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            category = data[0]
            assert "id" in category
            assert "name" in category
            assert "icon" in category
            print(f"✅ Found {len(data)} categories")
    
    def test_get_featured_restaurants(self):
        """GET /api/restaurants/featured - Returns featured/premium restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurants/featured")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Found {len(data)} featured restaurants")
    
    def test_get_restaurant_details(self):
        """GET /api/restaurants/{id} - Returns restaurant details"""
        # First get a restaurant ID
        discover_response = requests.get(f"{BASE_URL}/api/restaurants/discover")
        restaurants = discover_response.json().get("restaurants", [])
        
        if len(restaurants) > 0:
            restaurant_id = restaurants[0]["id"]
            response = requests.get(f"{BASE_URL}/api/restaurants/{restaurant_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert "restaurant" in data
            assert "categories" in data
            assert "available_vouchers" in data
            assert "stats" in data
            
            # Verify restaurant data
            restaurant = data["restaurant"]
            assert restaurant["id"] == restaurant_id
            print(f"✅ Restaurant details retrieved: {restaurant.get('restaurant_name')}")
        else:
            pytest.skip("No restaurants available for testing")
    
    def test_filter_by_category(self):
        """GET /api/restaurants/discover?category=italian - Filter by category"""
        response = requests.get(f"{BASE_URL}/api/restaurants/discover?category=italian")
        assert response.status_code == 200
        
        data = response.json()
        assert "restaurants" in data
        print(f"✅ Category filter works, found {len(data['restaurants'])} Italian restaurants")
    
    def test_search_restaurants(self):
        """GET /api/restaurants/discover?search=pizza - Search restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurants/discover?search=pizza")
        assert response.status_code == 200
        
        data = response.json()
        assert "restaurants" in data
        print(f"✅ Search works, found {len(data['restaurants'])} results for 'pizza'")


class TestLoyaltyProgram:
    """Loyalty Program API tests"""
    
    def test_get_loyalty_levels(self):
        """GET /api/loyalty/levels - Returns all loyalty levels"""
        response = requests.get(f"{BASE_URL}/api/loyalty/levels")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 5  # Should have at least 5 levels
        
        # Verify level structure
        level = data[0]
        assert "level" in level
        assert "name" in level
        assert "required_stamps" in level
        assert "bonus_percent" in level
        assert "icon" in level
        
        # Verify levels are in order
        for i in range(1, len(data)):
            assert data[i]["required_stamps"] >= data[i-1]["required_stamps"]
        
        print(f"✅ Found {len(data)} loyalty levels")
    
    def test_get_leaderboard(self):
        """GET /api/loyalty/leaderboard - Returns top loyalty members"""
        response = requests.get(f"{BASE_URL}/api/loyalty/leaderboard?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Leaderboard returned {len(data)} entries")
    
    def test_loyalty_status_requires_auth(self):
        """GET /api/loyalty/status - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/loyalty/status")
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Loyalty status correctly requires authentication")
    
    def test_loyalty_challenges_requires_auth(self):
        """GET /api/loyalty/challenges - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/loyalty/challenges")
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Loyalty challenges correctly requires authentication")


class TestRestaurantReviews:
    """Restaurant Reviews API tests"""
    
    def test_get_restaurant_reviews(self):
        """GET /api/restaurant-reviews/restaurant/{id} - Get reviews for a restaurant"""
        # First get a restaurant ID
        discover_response = requests.get(f"{BASE_URL}/api/restaurants/discover")
        restaurants = discover_response.json().get("restaurants", [])
        
        if len(restaurants) > 0:
            restaurant_id = restaurants[0]["id"]
            response = requests.get(f"{BASE_URL}/api/restaurant-reviews/restaurant/{restaurant_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert "restaurant_id" in data
            assert "stats" in data
            assert "reviews" in data
            
            # Verify stats structure
            stats = data["stats"]
            assert "avg_rating" in stats
            assert "total_reviews" in stats
            print(f"✅ Reviews retrieved for restaurant, {len(data['reviews'])} reviews found")
        else:
            pytest.skip("No restaurants available for testing")
    
    def test_get_top_rated_restaurants(self):
        """GET /api/restaurant-reviews/top-rated - Get top rated restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurant-reviews/top-rated?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Top rated restaurants: {len(data)} returned")
    
    def test_submit_review_requires_auth(self):
        """POST /api/restaurant-reviews/submit - Requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/restaurant-reviews/submit",
            json={
                "restaurant_id": "test",
                "voucher_code": "TEST",
                "rating": 5
            }
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422]
        print("✅ Submit review correctly requires authentication")


class TestRestaurantPortal:
    """Restaurant Portal API tests"""
    
    def test_validate_invalid_voucher(self):
        """GET /api/restaurant-portal/validate/{code} - Validate non-existent voucher"""
        response = requests.get(f"{BASE_URL}/api/restaurant-portal/validate/INVALID123")
        assert response.status_code == 200
        
        data = response.json()
        assert data["valid"] == False
        assert "error" in data
        print("✅ Invalid voucher correctly returns valid=false")
    
    def test_restaurant_login_invalid_credentials(self):
        """POST /api/restaurant-portal/login - Invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/restaurant-portal/login",
            json={
                "email": "invalid@test.de",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401
        print("✅ Invalid login correctly returns 401")
    
    def test_admin_list_restaurants(self):
        """GET /api/restaurant-portal/admin/restaurants - List all restaurants"""
        response = requests.get(f"{BASE_URL}/api/restaurant-portal/admin/restaurants")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Admin endpoint returned {len(data)} restaurants")


class TestAuthenticatedLoyalty:
    """Authenticated Loyalty API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "spinner@bidblitz.ae",
                "password": "Spinner123!"
            }
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_loyalty_status_authenticated(self, auth_token):
        """GET /api/loyalty/status - Get loyalty status when authenticated"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "total_stamps" in data
        assert "current_level" in data
        print(f"✅ Loyalty status: Level {data['current_level']['name']}, {data['total_stamps']} stamps")
    
    def test_loyalty_challenges_authenticated(self, auth_token):
        """GET /api/loyalty/challenges - Get challenges when authenticated"""
        response = requests.get(
            f"{BASE_URL}/api/loyalty/challenges",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "challenges" in data
        assert "completed_count" in data
        assert "total_count" in data
        print(f"✅ Challenges: {data['completed_count']}/{data['total_count']} completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
