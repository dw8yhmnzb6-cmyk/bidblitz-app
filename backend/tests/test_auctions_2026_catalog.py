"""
Test suite for 2026 Premium Tech Penny Auctions Catalog
Tests the new 30-item premium tech catalog with bot bidding configuration
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuctionsCatalog2026:
    """Tests for the new 2026 premium tech auction catalog"""
    
    def test_active_auctions_count_exactly_30(self):
        """Verify exactly 30 active auctions are returned"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        data = response.json()
        assert data.get("count") == 30, f"Expected 30 auctions, got {data.get('count')}"
        assert len(data.get("auctions", [])) == 30
    
    def test_all_retail_prices_over_1000(self):
        """Verify all auctions have retail_price > 1000"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            retail_price = auction.get("retail_price", 0)
            assert retail_price > 1000, f"Auction '{auction.get('title')}' has retail_price {retail_price} <= 1000"
    
    def test_all_duration_7_days(self):
        """Verify all auctions have duration_seconds = 604800 (7 days)"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            duration = auction.get("duration_seconds")
            assert duration == 604800, f"Auction '{auction.get('title')}' has duration {duration} != 604800"
    
    def test_all_starting_price_001(self):
        """Verify all auctions have starting_price = 0.01"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            starting_price = auction.get("starting_price")
            assert starting_price == 0.01, f"Auction '{auction.get('title')}' has starting_price {starting_price} != 0.01"
    
    def test_all_have_gallery_images(self):
        """Verify all auctions have at least 2 gallery images in image_urls"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            image_urls = auction.get("image_urls", [])
            assert len(image_urls) >= 2, f"Auction '{auction.get('title')}' has only {len(image_urls)} gallery images"
    
    def test_all_have_primary_image(self):
        """Verify all auctions have a valid primary image_url"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            image_url = auction.get("image_url")
            assert image_url, f"Auction '{auction.get('title')}' has no primary image_url"
            assert image_url.startswith("http"), f"Auction '{auction.get('title')}' has invalid image_url: {image_url}"
    
    def test_bot_enabled_on_all(self):
        """Verify bot_enabled is True on all active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            bot_enabled = auction.get("bot_enabled")
            assert bot_enabled == True, f"Auction '{auction.get('title')}' has bot_enabled={bot_enabled}"
    
    def test_bot_aggression_extreme(self):
        """Verify bot_aggression is 'extreme' or bot_strategy is 'aggressive' on all auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            aggression = auction.get("bot_aggression")
            strategy = auction.get("bot_strategy")
            assert aggression in ["extreme", "aggressive"] or strategy in ["extreme", "aggressive"], \
                f"Auction '{auction.get('title')}' has bot_aggression={aggression}, bot_strategy={strategy}"
    
    def test_bot_target_price_positive(self):
        """Verify bot_target_price is positive on all auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            target_price = auction.get("bot_target_price", 0)
            assert target_price > 0, f"Auction '{auction.get('title')}' has bot_target_price={target_price}"
    
    def test_no_old_demo_titles(self):
        """Verify no old demo auction titles remain"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        old_demo_keywords = ["Demo", "Test", "Sample", "Placeholder", "Example"]
        for auction in auctions:
            title = auction.get("title", "")
            for keyword in old_demo_keywords:
                assert keyword not in title, f"Auction '{title}' contains old demo keyword '{keyword}'"
    
    def test_all_2026_models(self):
        """Verify all auctions are 2026 models"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        for auction in auctions:
            title = auction.get("title", "")
            assert "2026" in title, f"Auction '{title}' does not contain '2026'"
    
    def test_categories_present(self):
        """Verify expected categories are present"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        
        categories = set(a.get("category", "") for a in auctions)
        expected_categories = {"phones", "laptops", "tablets", "gaming", "xr", "tech", "mobility"}
        
        # At least some expected categories should be present
        found_categories = categories.intersection(expected_categories)
        assert len(found_categories) >= 5, f"Only found {len(found_categories)} expected categories: {found_categories}"


class TestAuctionDetail:
    """Tests for individual auction detail endpoint"""
    
    def test_get_auction_detail(self):
        """Verify auction detail endpoint returns full data"""
        # First get an auction ID
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        auctions = response.json().get("auctions", [])
        assert len(auctions) > 0
        
        auction_id = auctions[0].get("auction_id")
        
        # Get detail
        detail_response = requests.get(f"{BASE_URL}/api/auctions/{auction_id}")
        assert detail_response.status_code == 200
        
        data = detail_response.json()
        auction = data.get("auction", {})
        
        # Verify required fields
        assert auction.get("title")
        assert auction.get("description")
        assert auction.get("retail_price") > 1000
        assert auction.get("starting_price") == 0.01
        assert auction.get("image_url")
        assert len(auction.get("image_urls", [])) >= 2
        assert auction.get("bot_enabled") == True


class TestAuctionListEndpoints:
    """Tests for auction list endpoints"""
    
    def test_list_auctions_endpoint(self):
        """Verify /api/auctions endpoint returns auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data
    
    def test_feed_endpoint(self):
        """Verify /api/auctions/feed endpoint works"""
        response = requests.get(f"{BASE_URL}/api/auctions/feed")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data
    
    def test_list_with_status_filter(self):
        """Verify /api/auctions/list with status filter works"""
        response = requests.get(f"{BASE_URL}/api/auctions/list?status=active")
        assert response.status_code == 200
        data = response.json()
        assert "auctions" in data
        
        # All returned should be active
        for auction in data.get("auctions", []):
            assert auction.get("status") == "active"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
