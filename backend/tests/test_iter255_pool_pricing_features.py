"""
Iteration 255: Pool Facility System - New Pricing & Hardware Command Features
Tests for:
- /api/pool/public/pricing/quote - Dynamic pricing quote endpoint
- /api/pool/admin/pricing/config - Admin pricing configuration
- /api/pool/admin/access/door-command - Door/gate command endpoint
- /api/pool/admin/lockers/open - Manual locker open command
- Extended /admin/dashboard with hardware_commands
- Extended /admin/turnstile/scan with access zone validation
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestPoolPublicPricingQuote:
    """Tests for /api/pool/public/pricing/quote endpoint"""

    def test_pricing_quote_day_pass_adults(self):
        """Test pricing quote for day pass with adults"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 2,
                "child_count": 0,
                "extras": [],
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total" in data, "Missing 'total' in response"
        assert "breakdown" in data, "Missing 'breakdown' in response"
        assert "duration_id" in data, "Missing 'duration_id' in response"
        assert "day_type" in data, "Missing 'day_type' in response"
        assert "access_zones" in data, "Missing 'access_zones' in response"
        
        # Verify pricing values
        assert data["duration_id"] == "day"
        assert data["adult_count"] == 2
        assert data["child_count"] == 0
        assert data["total"] > 0
        print(f"Day pass for 2 adults: € {data['total']}")

    def test_pricing_quote_2h_pass(self):
        """Test pricing quote for 2-hour pass"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "2h",
                "adult_count": 1,
                "child_count": 1,
                "extras": [],
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["duration_id"] == "2h"
        assert "duration_label_de" in data
        print(f"2h pass for 1 adult + 1 child: € {data['total']}")

    def test_pricing_quote_evening_pass(self):
        """Test pricing quote for evening pass"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "evening",
                "adult_count": 1,
                "child_count": 0,
                "extras": [],
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["duration_id"] == "evening"
        print(f"Evening pass for 1 adult: € {data['total']}")

    def test_pricing_quote_with_extras(self):
        """Test pricing quote with extras (sauna, locker)"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 2,
                "child_count": 1,
                "extras": ["sauna", "locker"],
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
            },
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify extras are in breakdown
        breakdown_types = [item.get("type") for item in data.get("breakdown", [])]
        assert "extra" in breakdown_types, "Extras should be in breakdown"
        
        # Verify access zones include sauna zones
        access_zones = data.get("access_zones", [])
        assert "sauna_gate" in access_zones or "sauna_zone" in access_zones, "Sauna zones should be included"
        print(f"Day pass with sauna + locker: € {data['total']}, zones: {access_zones}")

    def test_pricing_quote_family_bundle(self):
        """Test family bundle pricing (2 adults + 2 children)"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 2,
                "child_count": 2,
                "extras": [],
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
            },
        )
        assert response.status_code == 200
        data = response.json()
        
        # Family bundle should be applied
        assert "applied_family_bundle" in data
        print(f"Family bundle applied: {data.get('applied_family_bundle')}, total: € {data['total']}")

    def test_pricing_quote_weekend_vs_weekday(self):
        """Test weekend vs weekday pricing difference"""
        # Find next Saturday
        today = datetime.now()
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        next_saturday = today + timedelta(days=days_until_saturday)
        
        # Find next Monday
        days_until_monday = (0 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = today + timedelta(days=days_until_monday)
        
        # Weekend quote
        weekend_response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "extras": [],
                "visit_date": next_saturday.strftime("%Y-%m-%d"),
            },
        )
        assert weekend_response.status_code == 200
        weekend_data = weekend_response.json()
        
        # Weekday quote
        weekday_response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "extras": [],
                "visit_date": next_monday.strftime("%Y-%m-%d"),
            },
        )
        assert weekday_response.status_code == 200
        weekday_data = weekday_response.json()
        
        print(f"Weekend ({next_saturday.strftime('%Y-%m-%d')}): € {weekend_data['total']}, day_type: {weekend_data['day_type']}")
        print(f"Weekday ({next_monday.strftime('%Y-%m-%d')}): € {weekday_data['total']}, day_type: {weekday_data['day_type']}")
        
        # Weekend should be more expensive or equal
        assert weekend_data["day_type"] == "weekend"
        assert weekday_data["day_type"] == "weekday"

    def test_pricing_quote_no_guests_error(self):
        """Test error when no guests specified"""
        response = requests.post(
            f"{BASE_URL}/api/pool/public/pricing/quote",
            json={
                "duration_id": "day",
                "adult_count": 0,
                "child_count": 0,
                "extras": [],
            },
        )
        assert response.status_code == 400, f"Expected 400 for no guests, got {response.status_code}"


class TestPoolAdminPricingConfig:
    """Tests for /api/pool/admin/pricing/config endpoint"""

    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        return session

    def test_get_pricing_config(self, admin_session):
        """Test GET pricing config"""
        response = admin_session.get(f"{BASE_URL}/api/pool/admin/pricing/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "pricing_config" in data
        config = data["pricing_config"]
        
        # Verify structure
        assert "durations" in config
        assert "rates" in config
        assert "extras" in config
        assert "weekend_days" in config
        
        # Verify durations
        duration_ids = [d["duration_id"] for d in config["durations"]]
        assert "2h" in duration_ids
        assert "day" in duration_ids
        assert "evening" in duration_ids
        
        print(f"Pricing config loaded with {len(config['durations'])} durations")

    def test_update_pricing_config(self, admin_session):
        """Test POST pricing config update"""
        # First get current config
        get_response = admin_session.get(f"{BASE_URL}/api/pool/admin/pricing/config")
        assert get_response.status_code == 200
        current_config = get_response.json()["pricing_config"]
        
        # Update a rate
        current_config["rates"]["weekday"]["day"]["adult"] = 19.0
        
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/pricing/config",
            json={"pricing_config": current_config},
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("ok") is True
        assert "pricing_config" in data
        print("Pricing config updated successfully")

    def test_pricing_config_requires_auth(self):
        """Test that pricing config requires authentication"""
        response = requests.get(f"{BASE_URL}/api/pool/admin/pricing/config")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"


class TestPoolAdminDoorCommand:
    """Tests for /api/pool/admin/access/door-command endpoint"""

    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        return session

    def test_door_command_unlock(self, admin_session):
        """Test door unlock command"""
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/access/door-command",
            json={
                "door_id": "ENTRY-01",
                "action": "unlock",
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("ok") is True
        assert "command" in data
        command = data["command"]
        assert command["device_id"] == "ENTRY-01"
        assert command["action"] == "unlock"
        assert command["status"] == "queued"
        print(f"Door command queued: {command['command_id']}")

    def test_door_command_with_ticket(self, admin_session):
        """Test door command with ticket code"""
        # First create a ticket
        ticket_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/tickets/cash-sale",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
                "quantity": 1,
                "extras": [],
                "payment_method": "cash",
            },
        )
        assert ticket_response.status_code == 200
        ticket_code = ticket_response.json()["ticket"]["ticket_code"]
        
        # Send door command with ticket - use ENTRY-01 which is in base access zones
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/access/door-command",
            json={
                "door_id": "ENTRY-01",
                "ticket_code": ticket_code,
                "action": "unlock",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        print(f"Door command with ticket {ticket_code} queued")

    def test_door_command_requires_auth(self):
        """Test that door command requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/pool/admin/access/door-command",
            json={"door_id": "ENTRY-01", "action": "unlock"},
        )
        assert response.status_code in [401, 403]


class TestPoolAdminLockerOpen:
    """Tests for /api/pool/admin/lockers/open endpoint"""

    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        return session

    def test_locker_open_command(self, admin_session):
        """Test manual locker open command"""
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/lockers/open",
            json={
                "locker_id": "L-A01",
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("ok") is True
        assert "command" in data
        command = data["command"]
        assert command["device_id"] == "L-A01"
        assert command["action"] == "open_locker"
        assert command["status"] == "queued"
        print(f"Locker open command queued: {command['command_id']}")

    def test_locker_open_with_ticket(self, admin_session):
        """Test locker open with ticket code"""
        # First create a ticket
        ticket_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/tickets/cash-sale",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
                "quantity": 1,
                "extras": ["locker"],
                "payment_method": "cash",
            },
        )
        assert ticket_response.status_code == 200
        ticket_code = ticket_response.json()["ticket"]["ticket_code"]
        
        # Assign locker first
        assign_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/lockers/assign",
            json={"ticket_code": ticket_code},
        )
        assert assign_response.status_code == 200
        locker_id = assign_response.json()["locker"]["locker_id"]
        
        # Open locker with ticket
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/lockers/open",
            json={
                "locker_id": locker_id,
                "ticket_code": ticket_code,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("ok") is True
        print(f"Locker {locker_id} open command with ticket {ticket_code} queued")

    def test_locker_open_invalid_locker(self, admin_session):
        """Test locker open with invalid locker ID"""
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/lockers/open",
            json={
                "locker_id": "INVALID-LOCKER",
            },
        )
        assert response.status_code == 404, f"Expected 404 for invalid locker, got {response.status_code}"


class TestPoolAdminDashboardHardwareCommands:
    """Tests for hardware_commands in admin dashboard"""

    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        return session

    def test_dashboard_includes_hardware_commands(self, admin_session):
        """Test that dashboard includes hardware_commands array"""
        response = admin_session.get(f"{BASE_URL}/api/pool/admin/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "hardware_commands" in data, "Dashboard should include hardware_commands"
        assert isinstance(data["hardware_commands"], list)
        
        # Verify command structure if any exist
        if data["hardware_commands"]:
            command = data["hardware_commands"][0]
            assert "command_id" in command
            assert "device_type" in command
            assert "device_id" in command
            assert "action" in command
            assert "status" in command
        
        print(f"Dashboard has {len(data['hardware_commands'])} hardware commands")

    def test_dashboard_includes_pricing_config(self, admin_session):
        """Test that dashboard includes pricing_config"""
        response = admin_session.get(f"{BASE_URL}/api/pool/admin/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "pricing_config" in data, "Dashboard should include pricing_config"
        config = data["pricing_config"]
        assert "durations" in config
        assert "rates" in config
        print("Dashboard includes pricing_config")

    def test_dashboard_includes_access_points(self, admin_session):
        """Test that dashboard includes access_points"""
        response = admin_session.get(f"{BASE_URL}/api/pool/admin/dashboard")
        assert response.status_code == 200
        data = response.json()
        
        assert "access_points" in data, "Dashboard should include access_points"
        assert isinstance(data["access_points"], list)
        assert len(data["access_points"]) > 0
        
        # Verify access point structure
        point = data["access_points"][0]
        assert "door_id" in point
        assert "label_de" in point
        assert "zone_id" in point
        print(f"Dashboard has {len(data['access_points'])} access points")


class TestPoolTurnstileScanAccessZones:
    """Tests for access zone validation in turnstile scan"""

    @pytest.fixture
    def admin_session(self):
        """Login as admin and return session"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.text}")
        return session

    def test_entry_scan_success(self, admin_session):
        """Test successful entry scan"""
        # Create a ticket
        ticket_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/tickets/cash-sale",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
                "quantity": 1,
                "extras": [],
                "payment_method": "cash",
            },
        )
        assert ticket_response.status_code == 200
        ticket_code = ticket_response.json()["ticket"]["ticket_code"]
        
        # Scan entry
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/turnstile/scan",
            json={
                "scan_code": ticket_code,
                "direction": "entry",
                "turnstile_id": "ENTRY-01",
            },
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "ticket" in data
        assert data["ticket"]["status"] == "active"
        print(f"Entry scan successful: {data['message']}")

    def test_spa_entry_without_sauna_extra_fails(self, admin_session):
        """Test that SPA entry fails without sauna extra"""
        # Create a ticket WITHOUT sauna extra
        ticket_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/tickets/cash-sale",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
                "quantity": 1,
                "extras": [],  # No sauna
                "payment_method": "cash",
            },
        )
        assert ticket_response.status_code == 200
        ticket_code = ticket_response.json()["ticket"]["ticket_code"]
        
        # Try to scan at SPA gate
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/turnstile/scan",
            json={
                "scan_code": ticket_code,
                "direction": "entry",
                "turnstile_id": "SPA-01",
            },
        )
        # Should fail with 403 - no access to sauna zone
        assert response.status_code == 403, f"Expected 403 for SPA without sauna extra, got {response.status_code}"
        print("SPA entry correctly denied without sauna extra")

    def test_spa_entry_with_sauna_extra_succeeds(self, admin_session):
        """Test that SPA entry succeeds with sauna extra"""
        # Create a ticket WITH sauna extra
        ticket_response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/tickets/cash-sale",
            json={
                "duration_id": "day",
                "adult_count": 1,
                "child_count": 0,
                "visit_date": datetime.now().strftime("%Y-%m-%d"),
                "quantity": 1,
                "extras": ["sauna"],  # With sauna
                "payment_method": "cash",
            },
        )
        assert ticket_response.status_code == 200
        ticket_code = ticket_response.json()["ticket"]["ticket_code"]
        access_zones = ticket_response.json()["ticket"].get("access_zones", [])
        
        # Verify sauna zones are in access_zones
        assert "sauna_gate" in access_zones or "sauna_zone" in access_zones, f"Sauna zones should be in access_zones: {access_zones}"
        
        # Scan at SPA gate
        response = admin_session.post(
            f"{BASE_URL}/api/pool/admin/turnstile/scan",
            json={
                "scan_code": ticket_code,
                "direction": "entry",
                "turnstile_id": "SPA-01",
            },
        )
        assert response.status_code == 200, f"Expected 200 for SPA with sauna extra, got {response.status_code}: {response.text}"
        print("SPA entry correctly allowed with sauna extra")


class TestPoolPublicOverviewPricingConfig:
    """Tests for pricing_config in public overview"""

    def test_public_overview_includes_pricing_config(self):
        """Test that public overview includes pricing_config"""
        response = requests.get(f"{BASE_URL}/api/pool/public/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "pricing_config" in data, "Public overview should include pricing_config"
        config = data["pricing_config"]
        
        assert "durations" in config
        assert "rates" in config
        assert "extras" in config
        
        # Verify durations have labels
        for duration in config["durations"]:
            assert "duration_id" in duration
            assert "label_de" in duration
            assert "label_en" in duration
        
        print(f"Public overview includes pricing_config with {len(config['durations'])} durations")

    def test_public_overview_includes_access_points(self):
        """Test that public overview includes access_points"""
        response = requests.get(f"{BASE_URL}/api/pool/public/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "access_points" in data, "Public overview should include access_points"
        assert len(data["access_points"]) > 0
        print(f"Public overview includes {len(data['access_points'])} access points")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
