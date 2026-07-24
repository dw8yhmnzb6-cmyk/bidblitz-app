"""
Iteration 157 - Auction Reset 2026 Tests
Tests that all auctions are 2026-only, exactly 30 active, end at 18:00, and 3-5 days duration.
"""

import pytest
import requests
import os
from datetime import datetime, timezone
from collections import Counter

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuctions2026Reset:
    """Tests for the 2026 auction reset requirements"""
    
    def test_active_auctions_count_is_30(self):
        """GET /api/auctions/active returns exactly 30 active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "auctions" in data, "Response should contain 'auctions' key"
        assert "count" in data, "Response should contain 'count' key"
        
        auctions = data["auctions"]
        count = data["count"]
        
        assert count == 30, f"Expected count=30, got {count}"
        assert len(auctions) == 30, f"Expected 30 auctions in list, got {len(auctions)}"
        print(f"✓ Active auctions count: {count}")
    
    def test_all_titles_contain_2026(self):
        """All active auction titles must contain '2026'"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        non_2026_titles = [a["title"] for a in auctions if "2026" not in a.get("title", "")]
        
        assert len(non_2026_titles) == 0, f"Found non-2026 titles: {non_2026_titles}"
        print(f"✓ All {len(auctions)} auction titles contain '2026'")
    
    def test_all_auctions_end_at_1800(self):
        """All active auctions must end at 18:00 UTC"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        invalid_end_times = []
        
        for a in auctions:
            ends_at = a.get("ends_at", "")
            if ends_at:
                try:
                    dt = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
                    if dt.hour != 18 or dt.minute != 0:
                        invalid_end_times.append({
                            "title": a["title"],
                            "ends_at": ends_at,
                            "hour": dt.hour,
                            "minute": dt.minute
                        })
                except Exception as e:
                    invalid_end_times.append({
                        "title": a["title"],
                        "ends_at": ends_at,
                        "error": str(e)
                    })
        
        assert len(invalid_end_times) == 0, f"Auctions not ending at 18:00: {invalid_end_times}"
        print(f"✓ All {len(auctions)} auctions end at 18:00 UTC")
    
    def test_auctions_end_in_3_to_5_days(self):
        """All active auctions must end in 3, 4, or 5 days"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        now = datetime.now(timezone.utc)
        
        days_counter = Counter()
        invalid_durations = []
        
        for a in auctions:
            ends_at = a.get("ends_at", "")
            if ends_at:
                try:
                    dt = datetime.fromisoformat(ends_at.replace("Z", "+00:00"))
                    days = (dt - now).days
                    days_counter[days] += 1
                    
                    if days not in [3, 4, 5]:
                        invalid_durations.append({
                            "title": a["title"],
                            "ends_at": ends_at,
                            "days": days
                        })
                except Exception as e:
                    invalid_durations.append({
                        "title": a["title"],
                        "ends_at": ends_at,
                        "error": str(e)
                    })
        
        assert len(invalid_durations) == 0, f"Auctions with invalid duration: {invalid_durations}"
        
        # Verify distribution (should be 10 each for 3, 4, 5 days)
        print(f"✓ Days distribution: {dict(days_counter)}")
        assert 3 in days_counter, "Should have auctions ending in 3 days"
        assert 4 in days_counter, "Should have auctions ending in 4 days"
        assert 5 in days_counter, "Should have auctions ending in 5 days"
    
    def test_no_old_non_2026_auctions_in_active(self):
        """Verify no old non-2026 auctions exist in active list"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        
        # Check for common old product names that should NOT be present
        old_product_keywords = [
            "iPhone 16", "iPhone 15", "Galaxy S25", "Galaxy S24",
            "MacBook M4", "MacBook M3", "PlayStation 5 Slim",
            "Quest 3", "Switch OLED"
        ]
        
        found_old = []
        for a in auctions:
            title = a.get("title", "")
            for keyword in old_product_keywords:
                if keyword.lower() in title.lower():
                    found_old.append(title)
                    break
        
        assert len(found_old) == 0, f"Found old non-2026 products: {found_old}"
        print("✓ No old non-2026 products found in active auctions")
    
    def test_all_auctions_have_required_fields(self):
        """All auctions should have required fields"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        required_fields = ["auction_id", "title", "description", "retail_price", 
                          "current_price", "ends_at", "status"]
        
        missing_fields = []
        for a in auctions:
            for field in required_fields:
                if field not in a:
                    missing_fields.append({"title": a.get("title", "unknown"), "field": field})
        
        assert len(missing_fields) == 0, f"Auctions missing required fields: {missing_fields}"
        print(f"✓ All {len(auctions)} auctions have required fields")
    
    def test_all_auctions_status_is_active(self):
        """All auctions from /active endpoint should have status='active'"""
        response = requests.get(f"{BASE_URL}/api/auctions/active")
        assert response.status_code == 200
        
        auctions = response.json()["auctions"]
        non_active = [a["title"] for a in auctions if a.get("status") != "active"]
        
        assert len(non_active) == 0, f"Non-active auctions in active list: {non_active}"
        print(f"✓ All {len(auctions)} auctions have status='active'")


class TestAuctionListEndpoint:
    """Tests for the general auction list endpoint"""
    
    def test_list_endpoint_returns_200(self):
        """GET /api/auctions/list returns 200"""
        response = requests.get(f"{BASE_URL}/api/auctions/list")
        assert response.status_code == 200
        print("✓ /api/auctions/list returns 200")
    
    def test_list_with_status_filter(self):
        """GET /api/auctions/list?status=active returns only active auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/list?status=active")
        assert response.status_code == 200
        
        data = response.json()
        auctions = data.get("auctions", [])
        
        non_active = [a["title"] for a in auctions if a.get("status") != "active"]
        assert len(non_active) == 0, f"Non-active auctions with status filter: {non_active}"
        print(f"✓ Status filter works, got {len(auctions)} active auctions")


class TestAuctionFeedEndpoint:
    """Tests for the auction feed endpoint"""
    
    def test_feed_endpoint_returns_200(self):
        """GET /api/auctions/feed returns 200"""
        response = requests.get(f"{BASE_URL}/api/auctions/feed")
        assert response.status_code == 200
        print("✓ /api/auctions/feed returns 200")
    
    def test_feed_contains_2026_auctions(self):
        """Feed should contain 2026 auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions/feed?status=active")
        assert response.status_code == 200
        
        auctions = response.json().get("auctions", [])
        has_2026 = any("2026" in a.get("title", "") for a in auctions)
        
        assert has_2026, "Feed should contain 2026 auctions"
        print(f"✓ Feed contains 2026 auctions ({len(auctions)} total)")


class TestMainAuctionEndpoint:
    """Tests for the main /api/auctions endpoint"""
    
    def test_main_endpoint_returns_200(self):
        """GET /api/auctions returns 200"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        print("✓ /api/auctions returns 200")
    
    def test_main_endpoint_contains_2026_auctions(self):
        """Main endpoint should contain 2026 auctions"""
        response = requests.get(f"{BASE_URL}/api/auctions")
        assert response.status_code == 200
        
        auctions = response.json().get("auctions", [])
        active_2026 = [a for a in auctions if a.get("status") == "active" and "2026" in a.get("title", "")]
        
        assert len(active_2026) == 30, f"Expected 30 active 2026 auctions, got {len(active_2026)}"
        print(f"✓ Main endpoint has {len(active_2026)} active 2026 auctions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
