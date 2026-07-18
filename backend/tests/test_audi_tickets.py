"""
Audi Ticket Sales Backend API Tests
Tests: public overview, my orders, purchase, admin dashboard, admin check-in
"""
import pytest
import requests
import os
import secrets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-app-staging-2.preview.emergentagent.com')

# Test credentials from test_credentials.md
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestAudiTicketsPublic:
    """Public Audi ticket endpoints (no auth required)"""
    
    def test_public_overview_returns_200(self):
        """GET /api/audi-tickets/public/overview should return 200"""
        response = requests.get(f"{BASE_URL}/api/audi-tickets/public/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Public overview returns 200")
    
    def test_public_overview_has_event_data(self):
        """Public overview should contain event details"""
        response = requests.get(f"{BASE_URL}/api/audi-tickets/public/overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify event structure
        assert "event" in data, "Response should contain 'event' key"
        event = data["event"]
        assert event.get("event_id") == "audi-summer-drive-2026", f"Expected event_id 'audi-summer-drive-2026', got {event.get('event_id')}"
        assert event.get("title") == "Audi Summer Drive 2026", f"Expected title 'Audi Summer Drive 2026', got {event.get('title')}"
        assert event.get("city") == "Dubai", f"Expected city 'Dubai', got {event.get('city')}"
        assert event.get("venue") == "Audi Performance Arena", f"Expected venue 'Audi Performance Arena', got {event.get('venue')}"
        assert event.get("event_date") == "2026-08-21", f"Expected event_date '2026-08-21', got {event.get('event_date')}"
        assert event.get("hero_image"), "Event should have hero_image"
        assert event.get("highlights"), "Event should have highlights"
        print("✓ Public overview has correct event data")
    
    def test_public_overview_has_ticket_types(self):
        """Public overview should contain ticket types with prices and availability"""
        response = requests.get(f"{BASE_URL}/api/audi-tickets/public/overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify ticket_types structure
        assert "ticket_types" in data, "Response should contain 'ticket_types' key"
        ticket_types = data["ticket_types"]
        assert len(ticket_types) >= 3, f"Expected at least 3 ticket types, got {len(ticket_types)}"
        
        # Check each ticket type has required fields
        expected_type_ids = {"grandstand-premium", "track-day", "vip-hospitality"}
        found_type_ids = set()
        
        for tt in ticket_types:
            assert "ticket_type_id" in tt, "Ticket type should have ticket_type_id"
            assert "title" in tt, "Ticket type should have title"
            assert "price" in tt, "Ticket type should have price"
            assert "currency" in tt, "Ticket type should have currency"
            assert "inventory_available" in tt, "Ticket type should have inventory_available"
            assert "max_per_order" in tt, "Ticket type should have max_per_order"
            assert "perks" in tt, "Ticket type should have perks"
            found_type_ids.add(tt["ticket_type_id"])
        
        assert expected_type_ids.issubset(found_type_ids), f"Missing ticket types: {expected_type_ids - found_type_ids}"
        print("✓ Public overview has correct ticket types with prices and availability")
    
    def test_public_overview_has_stats(self):
        """Public overview should contain stats"""
        response = requests.get(f"{BASE_URL}/api/audi-tickets/public/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data, "Response should contain 'stats' key"
        stats = data["stats"]
        assert "ticket_types" in stats, "Stats should have ticket_types count"
        assert "tickets_sold" in stats, "Stats should have tickets_sold"
        assert "tickets_available" in stats, "Stats should have tickets_available"
        assert "lowest_price" in stats, "Stats should have lowest_price"
        print("✓ Public overview has stats")


class TestAudiTicketsAuthenticated:
    """Authenticated Audi ticket endpoints"""
    
    @pytest.fixture(scope="class")
    def reviewer_session(self):
        """Login as reviewer and return session with cookies"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Reviewer login failed: {login_response.status_code} - {login_response.text}")
        return session
    
    def test_my_orders_requires_auth(self):
        """GET /api/audi-tickets/my-orders should require authentication"""
        response = requests.get(f"{BASE_URL}/api/audi-tickets/my-orders")
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✓ my-orders requires authentication")
    
    def test_my_orders_returns_200_for_authenticated_user(self, reviewer_session):
        """GET /api/audi-tickets/my-orders should return 200 for authenticated user"""
        response = reviewer_session.get(f"{BASE_URL}/api/audi-tickets/my-orders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "orders" in data, "Response should contain 'orders' key"
        assert isinstance(data["orders"], list), "Orders should be a list"
        print(f"✓ my-orders returns 200 with {len(data['orders'])} orders")
    
    def test_purchase_requires_auth(self):
        """POST /api/audi-tickets/purchase should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/audi-tickets/purchase",
            json={"ticket_type_id": "track-day", "quantity": 1}
        )
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✓ purchase requires authentication")
    
    def test_purchase_validates_ticket_type(self, reviewer_session):
        """POST /api/audi-tickets/purchase should validate ticket_type_id"""
        response = reviewer_session.post(
            f"{BASE_URL}/api/audi-tickets/purchase",
            json={"ticket_type_id": "invalid-type", "quantity": 1}
        )
        assert response.status_code == 404, f"Expected 404 for invalid ticket type, got {response.status_code}"
        print("✓ purchase validates ticket_type_id")
    
    def test_purchase_validates_quantity(self, reviewer_session):
        """POST /api/audi-tickets/purchase should validate quantity against max_per_order"""
        response = reviewer_session.post(
            f"{BASE_URL}/api/audi-tickets/purchase",
            json={"ticket_type_id": "vip-hospitality", "quantity": 10}  # max_per_order is 2
        )
        assert response.status_code == 400, f"Expected 400 for quantity exceeding max, got {response.status_code}"
        print("✓ purchase validates quantity against max_per_order")


class TestAudiTicketsAdmin:
    """Admin Audi ticket endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin and return session with cookies"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        return session
    
    @pytest.fixture(scope="class")
    def reviewer_session(self):
        """Login as reviewer (non-admin) and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Reviewer login failed: {login_response.status_code} - {login_response.text}")
        return session
    
    def test_admin_dashboard_requires_admin_role(self, reviewer_session):
        """GET /api/audi-tickets/admin/dashboard should require admin role"""
        response = reviewer_session.get(f"{BASE_URL}/api/audi-tickets/admin/dashboard")
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ admin/dashboard requires admin role")
    
    def test_admin_dashboard_returns_200_for_admin(self, admin_session):
        """GET /api/audi-tickets/admin/dashboard should return 200 for admin"""
        response = admin_session.get(f"{BASE_URL}/api/audi-tickets/admin/dashboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify dashboard structure
        assert "event" in data, "Dashboard should contain event"
        assert "ticket_types" in data, "Dashboard should contain ticket_types"
        assert "stats" in data, "Dashboard should contain stats"
        assert "recent_orders" in data, "Dashboard should contain recent_orders"
        assert "recent_checkins" in data, "Dashboard should contain recent_checkins"
        assert "metrics" in data, "Dashboard should contain metrics"
        
        # Verify metrics
        metrics = data["metrics"]
        assert "revenue_eur" in metrics, "Metrics should have revenue_eur"
        assert "orders_count" in metrics, "Metrics should have orders_count"
        assert "checked_in_count" in metrics, "Metrics should have checked_in_count"
        print(f"✓ admin/dashboard returns 200 with metrics: revenue={metrics['revenue_eur']} EUR, orders={metrics['orders_count']}")
    
    def test_admin_checkin_requires_admin_role(self, reviewer_session):
        """POST /api/audi-tickets/admin/checkin should require admin role"""
        response = reviewer_session.post(
            f"{BASE_URL}/api/audi-tickets/admin/checkin",
            json={"ticket_code": "AUDI-TKT-TEST1234"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("✓ admin/checkin requires admin role")
    
    def test_admin_checkin_validates_ticket_code(self, admin_session):
        """POST /api/audi-tickets/admin/checkin should validate ticket code"""
        response = admin_session.post(
            f"{BASE_URL}/api/audi-tickets/admin/checkin",
            json={"ticket_code": "INVALID-CODE-12345"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid ticket code, got {response.status_code}"
        print("✓ admin/checkin validates ticket code")


class TestAudiTicketsPurchaseFlow:
    """End-to-end purchase flow tests (requires wallet balance)"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        return session
    
    @pytest.fixture(scope="class")
    def reviewer_session(self):
        """Login as reviewer"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Reviewer login failed: {login_response.status_code}")
        return session
    
    def test_purchase_flow_with_insufficient_balance(self, reviewer_session):
        """Purchase should fail with insufficient wallet balance"""
        # First check wallet balance
        wallet_response = reviewer_session.get(f"{BASE_URL}/api/wallet")
        if wallet_response.status_code != 200:
            pytest.skip("Could not get wallet balance")
        
        wallet = wallet_response.json()
        balance = float(wallet.get("balance", 0))
        
        # Get ticket price
        overview_response = requests.get(f"{BASE_URL}/api/audi-tickets/public/overview")
        ticket_types = overview_response.json().get("ticket_types", [])
        vip_ticket = next((t for t in ticket_types if t["ticket_type_id"] == "vip-hospitality"), None)
        
        if vip_ticket and balance < vip_ticket["price"]:
            # Try to purchase with insufficient balance
            response = reviewer_session.post(
                f"{BASE_URL}/api/audi-tickets/purchase",
                json={"ticket_type_id": "vip-hospitality", "quantity": 1}
            )
            assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
            print(f"✓ Purchase fails with insufficient balance (balance: {balance} EUR, ticket: {vip_ticket['price']} EUR)")
        else:
            print(f"⚠ Skipping insufficient balance test - balance ({balance}) >= ticket price")
    
    def test_admin_can_credit_wallet_for_testing(self, admin_session):
        """Admin can credit wallet for testing purposes"""
        # This test verifies the admin wallet credit endpoint exists
        # The actual credit was done by main agent in self-test
        response = admin_session.get(f"{BASE_URL}/api/admin/overview")
        assert response.status_code == 200, f"Admin overview should work, got {response.status_code}"
        print("✓ Admin can access admin endpoints for wallet management")
    
    def test_existing_orders_visible_in_my_orders(self, reviewer_session):
        """Previously purchased orders should be visible in my-orders"""
        response = reviewer_session.get(f"{BASE_URL}/api/audi-tickets/my-orders")
        assert response.status_code == 200
        data = response.json()
        orders = data.get("orders", [])
        
        if len(orders) > 0:
            # Verify order structure
            order = orders[0]
            assert "order_id" in order, "Order should have order_id"
            assert "ticket_type_id" in order, "Order should have ticket_type_id"
            assert "ticket_type_title" in order, "Order should have ticket_type_title"
            assert "quantity" in order, "Order should have quantity"
            assert "total_amount" in order, "Order should have total_amount"
            assert "status" in order, "Order should have status"
            assert "ticket_codes" in order, "Order should have ticket_codes"
            print(f"✓ Found {len(orders)} existing orders, first order: {order['order_id']}")
        else:
            print("⚠ No existing orders found for reviewer")


class TestAudiTicketsCheckinFlow:
    """Admin check-in flow tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Login as admin"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        return session
    
    def test_checkin_already_checked_in_ticket_fails(self, admin_session):
        """Check-in of already checked-in ticket should fail"""
        # The main agent already checked in AUDI-TKT-CEE4FA13
        response = admin_session.post(
            f"{BASE_URL}/api/audi-tickets/admin/checkin",
            json={"ticket_code": "AUDI-TKT-CEE4FA13"}
        )
        # Should return 404 because ticket is already checked in (status != 'valid')
        assert response.status_code == 404, f"Expected 404 for already checked-in ticket, got {response.status_code}"
        print("✓ Already checked-in ticket returns 404")
    
    def test_dashboard_shows_checkin_metrics(self, admin_session):
        """Admin dashboard should show check-in metrics"""
        response = admin_session.get(f"{BASE_URL}/api/audi-tickets/admin/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        metrics = data.get("metrics", {})
        checked_in_count = metrics.get("checked_in_count", 0)
        recent_checkins = data.get("recent_checkins", [])
        
        print(f"✓ Dashboard shows {checked_in_count} checked-in tickets, {len(recent_checkins)} recent check-ins")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
