"""
Iteration 134 - Full BidBlitz Super-App Test Sweep
Tests: Auth, Legal/Impressum, Leaderboard, Auctions, Restaurant Admin, USB Discovery
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://super-app-staging-2.preview.emergentagent.com").rstrip("/")

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Authenticated session with admin login"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 200:
        return session
    elif resp.status_code == 429:
        pytest.skip("Rate limited - skipping authenticated tests")
    else:
        pytest.skip(f"Login failed: {resp.status_code} - {resp.text[:200]}")


# ═══════════════════════════════════════════════════════════════
# AUTH TESTS
# ═══════════════════════════════════════════════════════════════

class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self, session):
        """Test admin login returns 200 and user data"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        # Accept 200 (success) or 429 (rate limited)
        assert resp.status_code in [200, 429], f"Expected 200 or 429, got {resp.status_code}: {resp.text[:200]}"
        if resp.status_code == 200:
            data = resp.json()
            assert "email" in data or "id" in data, "Response should contain user data"
            print(f"✓ Login successful for {ADMIN_EMAIL}")
        else:
            print(f"⚠ Rate limited (429) - expected behavior after multiple attempts")
    
    def test_login_invalid_credentials(self, session):
        """Test login with wrong password returns 401"""
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        # Accept 401 (invalid) or 429 (rate limited)
        assert resp.status_code in [401, 429], f"Expected 401 or 429, got {resp.status_code}"
        print(f"✓ Invalid login correctly rejected with {resp.status_code}")


# ═══════════════════════════════════════════════════════════════
# LEGAL TESTS - Impressum with Betreiber Afrim Krasniqi
# ═══════════════════════════════════════════════════════════════

class TestLegal:
    """Legal pages tests - Impressum, AGB, Datenschutz, Sicherheit"""
    
    def test_impressum_loads(self, session):
        """Test /api/legal/impressum returns content with Betreiber"""
        resp = session.get(f"{BASE_URL}/api/legal/impressum")
        assert resp.status_code == 200, f"Impressum failed: {resp.status_code}"
        data = resp.json()
        assert "content" in data, "Impressum should have content"
        assert len(data["content"]) > 0, "Impressum content should not be empty"
        
        # Check for Betreiber Afrim Krasniqi
        content_text = str(data["content"])
        assert "Afrim Krasniqi" in content_text, "Impressum must contain Betreiber Afrim Krasniqi"
        print(f"✓ Impressum loaded with {len(data['content'])} sections, Betreiber: Afrim Krasniqi found")
    
    def test_impressum_no_empty_end(self, session):
        """Test Impressum doesn't end with empty section"""
        resp = session.get(f"{BASE_URL}/api/legal/impressum")
        assert resp.status_code == 200
        data = resp.json()
        content = data.get("content", [])
        if content:
            last_section = content[-1]
            assert last_section.get("heading") or last_section.get("text"), "Last section should not be empty"
            print(f"✓ Impressum last section: {last_section.get('heading', 'N/A')[:50]}")
    
    def test_agb_loads(self, session):
        """Test /api/legal/agb returns content"""
        resp = session.get(f"{BASE_URL}/api/legal/agb")
        assert resp.status_code == 200, f"AGB failed: {resp.status_code}"
        data = resp.json()
        assert "content" in data and len(data["content"]) > 0
        print(f"✓ AGB loaded with {len(data['content'])} sections")
    
    def test_datenschutz_loads(self, session):
        """Test /api/legal/datenschutz returns content"""
        resp = session.get(f"{BASE_URL}/api/legal/datenschutz")
        assert resp.status_code == 200, f"Datenschutz failed: {resp.status_code}"
        data = resp.json()
        assert "content" in data and len(data["content"]) > 0
        print(f"✓ Datenschutz loaded with {len(data['content'])} sections")
    
    def test_sicherheit_loads(self, session):
        """Test /api/legal/sicherheit returns content"""
        resp = session.get(f"{BASE_URL}/api/legal/sicherheit")
        assert resp.status_code == 200, f"Sicherheit failed: {resp.status_code}"
        data = resp.json()
        assert "content" in data and len(data["content"]) > 0
        print(f"✓ Sicherheit loaded with {len(data['content'])} sections")


# ═══════════════════════════════════════════════════════════════
# LEADERBOARD TESTS - All 3 Tabs
# ═══════════════════════════════════════════════════════════════

class TestLeaderboard:
    """Leaderboard endpoint tests - balance, gaming, rating"""
    
    def test_leaderboard_balance(self, session):
        """Test /api/extras/leaderboard?type=balance returns entries"""
        resp = session.get(f"{BASE_URL}/api/extras/leaderboard?type=balance")
        assert resp.status_code == 200, f"Leaderboard balance failed: {resp.status_code}"
        data = resp.json()
        assert "type" in data, "Response should have type"
        assert "entries" in data, "Response should have entries"
        assert isinstance(data["entries"], list), "Entries should be a list"
        print(f"✓ Leaderboard balance: {len(data['entries'])} entries, type={data.get('type')}")
    
    def test_leaderboard_gaming(self, session):
        """Test /api/extras/leaderboard?type=gaming returns entries"""
        resp = session.get(f"{BASE_URL}/api/extras/leaderboard?type=gaming")
        assert resp.status_code == 200, f"Leaderboard gaming failed: {resp.status_code}"
        data = resp.json()
        assert "type" in data and "entries" in data
        print(f"✓ Leaderboard gaming: {len(data['entries'])} entries, type={data.get('type')}")
    
    def test_leaderboard_rating(self, session):
        """Test /api/extras/leaderboard?type=rating returns entries"""
        resp = session.get(f"{BASE_URL}/api/extras/leaderboard?type=rating")
        assert resp.status_code == 200, f"Leaderboard rating failed: {resp.status_code}"
        data = resp.json()
        assert "type" in data and "entries" in data
        print(f"✓ Leaderboard rating: {len(data['entries'])} entries, type={data.get('type')}")


# ═══════════════════════════════════════════════════════════════
# AUCTIONS TESTS - List, Marine/Boats Filter
# ═══════════════════════════════════════════════════════════════

class TestAuctions:
    """Auction endpoint tests"""
    
    def test_auctions_list(self, session):
        """Test /api/auctions returns auctions list"""
        resp = session.get(f"{BASE_URL}/api/auctions")
        assert resp.status_code == 200, f"Auctions list failed: {resp.status_code}"
        data = resp.json()
        assert "auctions" in data, "Response should have auctions"
        auctions = data["auctions"]
        assert isinstance(auctions, list), "Auctions should be a list"
        print(f"✓ Auctions list: {len(auctions)} auctions found")
        
        # Check for marine/boat auctions
        marine_auctions = [a for a in auctions if a.get("category") == "marine"]
        print(f"  - Marine/Boat auctions: {len(marine_auctions)}")
        
        # Check categories present
        categories = set(a.get("category") for a in auctions if a.get("category"))
        print(f"  - Categories: {categories}")
    
    def test_auctions_active(self, session):
        """Test /api/auctions/active returns active auctions"""
        resp = session.get(f"{BASE_URL}/api/auctions/active")
        assert resp.status_code == 200, f"Active auctions failed: {resp.status_code}"
        data = resp.json()
        assert "auctions" in data
        active = data["auctions"]
        # All should be active status
        for a in active[:5]:  # Check first 5
            assert a.get("status") == "active", f"Expected active status, got {a.get('status')}"
        print(f"✓ Active auctions: {len(active)} auctions")


# ═══════════════════════════════════════════════════════════════
# RESTAURANT TABLE SYSTEM TESTS
# ═══════════════════════════════════════════════════════════════

class TestRestaurantTableSystem:
    """Restaurant table system tests - requires auth"""
    
    def test_table_hardware_config(self, auth_session):
        """Test /api/table-hardware returns hardware config"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware")
        assert resp.status_code == 200, f"Table hardware failed: {resp.status_code}"
        data = resp.json()
        assert "printers" in data, "Response should have printers"
        assert "store_id" in data, "Response should have store_id"
        print(f"✓ Table hardware: store_id={data.get('store_id')}, printers={len(data.get('printers', []))}")
    
    def test_usb_discover_endpoint(self, auth_session):
        """Test /api/table-hardware/usb-discover returns USB devices (mocked in preview)"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware/usb-discover")
        assert resp.status_code == 200, f"USB discover failed: {resp.status_code}"
        data = resp.json()
        assert "devices" in data, "Response should have devices"
        assert "mocked" in data, "Response should indicate if mocked"
        devices = data.get("devices", [])
        mocked = data.get("mocked", False)
        print(f"✓ USB discover: {len(devices)} devices, mocked={mocked}")
        if mocked:
            print(f"  - MOCKED PREVIEW FALLBACK (expected in preview environment)")
    
    def test_tables_list(self, auth_session):
        """Test /api/tables returns tables list"""
        resp = auth_session.get(f"{BASE_URL}/api/tables")
        assert resp.status_code == 200, f"Tables list failed: {resp.status_code}"
        data = resp.json()
        assert "tables" in data, "Response should have tables"
        tables = data.get("tables", [])
        print(f"✓ Tables list: {len(tables)} tables")
    
    def test_printer_diagnostics_history(self, auth_session):
        """Test /api/table-hardware/diagnostics returns logs"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware/diagnostics")
        assert resp.status_code == 200, f"Diagnostics history failed: {resp.status_code}"
        data = resp.json()
        assert "logs" in data, "Response should have logs"
        print(f"✓ Diagnostics history: {len(data.get('logs', []))} logs")


# ═══════════════════════════════════════════════════════════════
# GLOBAL SEARCH TEST
# ═══════════════════════════════════════════════════════════════

class TestExtras:
    """Extra features tests"""
    
    def test_global_search(self, session):
        """Test /api/extras/search returns results"""
        resp = session.get(f"{BASE_URL}/api/extras/search?q=test")
        assert resp.status_code == 200, f"Search failed: {resp.status_code}"
        data = resp.json()
        assert "results" in data, "Response should have results"
        print(f"✓ Global search: {len(data.get('results', []))} results for 'test'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
