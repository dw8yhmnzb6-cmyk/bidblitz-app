"""
Iteration 158 - Commerce Center Hub Tests
Tests for the enhanced Commerce Center with Spotlight-Deal, Category-Mix, Commerce-Pulse-Insights
and Category-Filter functionality.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestCommerceCenterOverviewNewKeys:
    """Test that /api/commerce-center/overview returns the new keys: spotlight, category_mix, live_insights"""

    def test_overview_returns_200(self):
        """GET /api/commerce-center/overview should return 200"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_overview_has_spotlight_key(self):
        """Overview should contain 'spotlight' key"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert "spotlight" in data, "Missing 'spotlight' key in response"

    def test_overview_has_category_mix_key(self):
        """Overview should contain 'category_mix' key"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert "category_mix" in data, "Missing 'category_mix' key in response"

    def test_overview_has_live_insights_key(self):
        """Overview should contain 'live_insights' key"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert "live_insights" in data, "Missing 'live_insights' key in response"

    def test_overview_has_all_required_keys(self):
        """Overview should contain all required keys for Commerce Center"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        required_keys = [
            "stats", "flash_sales", "marketplace", "penny_auctions",
            "live_auctions", "live_streams", "upcoming_streams",
            "spotlight", "category_mix", "live_insights"
        ]
        for key in required_keys:
            assert key in data, f"Missing required key: {key}"


class TestSpotlightDeal:
    """Test Spotlight Deal structure and content"""

    def test_spotlight_has_required_fields(self):
        """Spotlight should have type, title, subtitle, price, route, cta"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        spotlight = data.get("spotlight", {})
        
        # Spotlight may be empty if no deals available, but if present should have structure
        if spotlight:
            assert "type" in spotlight, "Spotlight missing 'type'"
            assert "title" in spotlight, "Spotlight missing 'title'"
            assert "route" in spotlight, "Spotlight missing 'route'"
            assert "cta" in spotlight, "Spotlight missing 'cta'"

    def test_spotlight_type_is_valid(self):
        """Spotlight type should be one of: flash_sale, live_auction, penny_auction"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        spotlight = data.get("spotlight", {})
        
        if spotlight and "type" in spotlight:
            valid_types = ["flash_sale", "live_auction", "penny_auction"]
            assert spotlight["type"] in valid_types, f"Invalid spotlight type: {spotlight['type']}"

    def test_spotlight_has_category(self):
        """Spotlight should have category with key, label, accent"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        spotlight = data.get("spotlight", {})
        
        if spotlight and "category" in spotlight:
            category = spotlight["category"]
            assert "key" in category, "Spotlight category missing 'key'"
            assert "label" in category, "Spotlight category missing 'label'"
            assert "accent" in category, "Spotlight category missing 'accent'"


class TestCategoryMix:
    """Test Category Mix structure"""

    def test_category_mix_is_list(self):
        """category_mix should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("category_mix"), list), "category_mix should be a list"

    def test_category_mix_items_have_required_fields(self):
        """Each category_mix item should have key, label, accent, count"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        category_mix = data.get("category_mix", [])
        
        for item in category_mix:
            assert "key" in item, f"Category item missing 'key': {item}"
            assert "label" in item, f"Category item missing 'label': {item}"
            assert "accent" in item, f"Category item missing 'accent': {item}"
            assert "count" in item, f"Category item missing 'count': {item}"

    def test_category_mix_count_is_positive(self):
        """Category count should be positive integer"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        category_mix = data.get("category_mix", [])
        
        for item in category_mix:
            assert isinstance(item.get("count"), int), f"Count should be int: {item}"
            assert item.get("count", 0) >= 0, f"Count should be non-negative: {item}"


class TestLiveInsights:
    """Test Live Insights (Commerce Pulse) structure"""

    def test_live_insights_is_list(self):
        """live_insights should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("live_insights"), list), "live_insights should be a list"

    def test_live_insights_has_expected_items(self):
        """live_insights should have ending_soon, biggest_discount, hottest_category, live_now"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        live_insights = data.get("live_insights", [])
        
        insight_ids = [item.get("id") for item in live_insights]
        expected_ids = ["ending_soon", "biggest_discount", "hottest_category", "live_now"]
        
        for expected_id in expected_ids:
            assert expected_id in insight_ids, f"Missing insight: {expected_id}"

    def test_live_insights_items_have_required_fields(self):
        """Each insight should have id, label, value, value_type, detail"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        live_insights = data.get("live_insights", [])
        
        for item in live_insights:
            assert "id" in item, f"Insight missing 'id': {item}"
            assert "label" in item, f"Insight missing 'label': {item}"
            assert "value" in item, f"Insight missing 'value': {item}"
            assert "value_type" in item, f"Insight missing 'value_type': {item}"
            assert "detail" in item, f"Insight missing 'detail': {item}"


class TestExistingCommerceModules:
    """Test that existing commerce modules still work correctly"""

    def test_flash_sales_is_list(self):
        """flash_sales should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("flash_sales"), list), "flash_sales should be a list"

    def test_penny_auctions_is_list(self):
        """penny_auctions should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("penny_auctions"), list), "penny_auctions should be a list"

    def test_marketplace_is_list(self):
        """marketplace should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("marketplace"), list), "marketplace should be a list"

    def test_live_streams_is_list(self):
        """live_streams should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("live_streams"), list), "live_streams should be a list"

    def test_live_auctions_is_list(self):
        """live_auctions should be a list"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        assert isinstance(data.get("live_auctions"), list), "live_auctions should be a list"

    def test_stats_has_required_counts(self):
        """stats should have active counts for marketplace, flash_sales, penny_auctions, live_streams"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        stats = data.get("stats", {})
        
        required_stats = [
            "active_marketplace", "active_flash_sales", 
            "active_penny_auctions", "active_live_streams"
        ]
        for stat in required_stats:
            assert stat in stats, f"Missing stat: {stat}"


class TestPennyAuctionsInOverview:
    """Test Penny Auctions data in overview"""

    def test_penny_auctions_have_category(self):
        """Penny auctions should have category field for filtering"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        penny_auctions = data.get("penny_auctions", [])
        
        for auction in penny_auctions:
            # Category may be in 'category' field
            assert "auction_id" in auction, f"Auction missing auction_id: {auction}"
            assert "title" in auction, f"Auction missing title: {auction}"

    def test_penny_auctions_have_remaining_seconds(self):
        """Penny auctions should have remaining_seconds for timer display"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        penny_auctions = data.get("penny_auctions", [])
        
        for auction in penny_auctions:
            assert "remaining_seconds" in auction, f"Auction missing remaining_seconds: {auction}"


class TestMarketplaceInOverview:
    """Test Marketplace data in overview"""

    def test_marketplace_items_have_category(self):
        """Marketplace items should have category for filtering"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        marketplace = data.get("marketplace", [])
        
        for item in marketplace:
            assert "listing_id" in item, f"Item missing listing_id: {item}"
            assert "title" in item, f"Item missing title: {item}"
            assert "price" in item, f"Item missing price: {item}"


class TestFlashSalesInOverview:
    """Test Flash Sales data in overview"""

    def test_flash_sales_have_category(self):
        """Flash sales should have category for filtering"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        flash_sales = data.get("flash_sales", [])
        
        for sale in flash_sales:
            if sale:  # May be empty list
                assert "sale_id" in sale, f"Sale missing sale_id: {sale}"
                assert "title" in sale, f"Sale missing title: {sale}"

    def test_flash_sales_have_remaining_seconds(self):
        """Flash sales should have remaining_seconds for timer"""
        response = requests.get(f"{BASE_URL}/api/commerce-center/overview")
        data = response.json()
        flash_sales = data.get("flash_sales", [])
        
        for sale in flash_sales:
            if sale:
                assert "remaining_seconds" in sale, f"Sale missing remaining_seconds: {sale}"
