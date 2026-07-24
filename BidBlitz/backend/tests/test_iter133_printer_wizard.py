"""
Iteration 133 - Printer Setup Wizard Backend Tests
Tests for:
- POST /api/table-hardware/discover (network printer discovery)
- POST /api/table-hardware/printers/test (ad-hoc printer test without saving)
- POST /api/table-hardware/printers (save printer mapping)
- POST /api/table-hardware/diagnostics (printer diagnostics)
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"


@pytest.fixture(scope="module")
def session():
    """Create authenticated session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Login and return authenticated session"""
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if resp.status_code == 429:
        pytest.skip("Rate limited - retry later")
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


class TestPrinterDiscoveryEndpoint:
    """Tests for POST /api/table-hardware/discover"""
    
    def test_discover_printers_returns_200(self, auth_session):
        """Discovery endpoint should return 200 with results array"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/discover", json={
            "subnet": "192.168.1",
            "start_host": 1,
            "end_host": 5,
            "ports": [9100]
        })
        assert resp.status_code == 200, f"Discovery failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "results" in data
        assert isinstance(data["results"], list)
        assert "count" in data
        # Note: In preview environment, no real printers will be found
        print(f"Discovery returned {data['count']} printers")
    
    def test_discover_printers_with_cidr_subnet(self, auth_session):
        """Discovery should accept CIDR notation"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/discover", json={
            "subnet": "192.168.1.0/24",
            "start_host": 1,
            "end_host": 3,
            "ports": [9100]
        })
        assert resp.status_code == 200, f"CIDR discovery failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
    
    def test_discover_printers_invalid_subnet_returns_400(self, auth_session):
        """Invalid subnet should return 400"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/discover", json={
            "subnet": "invalid",
            "start_host": 1,
            "end_host": 5,
            "ports": [9100]
        })
        assert resp.status_code == 400, f"Expected 400 for invalid subnet, got {resp.status_code}"


class TestPrinterTestEndpoint:
    """Tests for POST /api/table-hardware/printers/test (ad-hoc test without saving)"""
    
    def test_printer_test_with_file_type_returns_200(self, auth_session):
        """Test printer with type=file should succeed (file fallback)"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers/test", json={
            "role": "kitchen",
            "name": "Test Printer Wizard",
            "type": "file",
            "ip": "",
            "port": 9100,
            "device": ""
        })
        assert resp.status_code == 200, f"File printer test failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "result" in data
        assert data["result"].get("slip_type") == "kitchen"
        print(f"Test printer result: {data['result']}")
    
    def test_printer_test_with_network_type_unreachable(self, auth_session):
        """Test network printer with unreachable IP should return 500 or 502"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers/test", json={
            "role": "service",
            "name": "Unreachable Network Printer",
            "type": "network",
            "ip": "192.168.99.99",
            "port": 9100,
            "device": ""
        })
        # Network printer test to unreachable IP should fail (500 or 502 depending on timeout)
        assert resp.status_code in [500, 502], f"Expected 500/502 for unreachable printer, got {resp.status_code}"
    
    def test_printer_test_with_usb_type_device_not_found(self, auth_session):
        """Test USB printer with non-existent device should return 500"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers/test", json={
            "role": "bill",
            "name": "USB Test Printer",
            "type": "usb",
            "ip": "",
            "port": 9100,
            "device": "/dev/usb/lp99"
        })
        # USB device not found should fail
        assert resp.status_code == 500, f"Expected 500 for missing USB device, got {resp.status_code}"
    
    def test_printer_test_adhoc_without_name(self, auth_session):
        """Test printer without name should use default"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers/test", json={
            "role": "kitchen",
            "type": "file"
        })
        assert resp.status_code == 200, f"Ad-hoc test failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True


class TestPrinterSaveEndpoint:
    """Tests for POST /api/table-hardware/printers (save mapping)"""
    
    def test_save_printer_mapping_returns_200(self, auth_session):
        """Save printer mapping should succeed"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "role": "kitchen",
            "name": "Test Kitchen Printer 133",
            "type": "file",
            "ip": "",
            "port": 9100,
            "device": ""
        })
        assert resp.status_code == 200, f"Save printer failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "printer" in data
        assert data["printer"]["name"] == "Test Kitchen Printer 133"
        assert data["printer"]["role"] == "kitchen"
        assert data["printer"]["type"] == "file"
    
    def test_save_network_printer_mapping(self, auth_session):
        """Save network printer mapping should succeed"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "role": "service",
            "name": "Network Service Printer",
            "type": "network",
            "ip": "192.168.1.100",
            "port": 9100,
            "device": ""
        })
        assert resp.status_code == 200, f"Save network printer failed: {resp.text}"
        data = resp.json()
        assert data["printer"]["type"] == "network"
        assert data["printer"]["ip"] == "192.168.1.100"
        assert data["printer"]["port"] == 9100
    
    def test_save_usb_printer_mapping(self, auth_session):
        """Save USB printer mapping should succeed"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/printers", json={
            "role": "bill",
            "name": "USB Bill Printer",
            "type": "usb",
            "ip": "",
            "port": 9100,
            "device": "/dev/usb/lp0"
        })
        assert resp.status_code == 200, f"Save USB printer failed: {resp.text}"
        data = resp.json()
        assert data["printer"]["type"] == "usb"
        assert data["printer"]["device"] == "/dev/usb/lp0"


class TestPrinterDiagnosticsEndpoint:
    """Tests for POST /api/table-hardware/diagnostics"""
    
    def test_diagnostics_kitchen_role(self, auth_session):
        """Diagnostics for kitchen role should return result"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/diagnostics", json={
            "role": "kitchen"
        })
        assert resp.status_code == 200, f"Diagnostics failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert "result" in data
        assert data["result"].get("role") == "kitchen"
        print(f"Kitchen diagnostics: {data['result']}")
    
    def test_diagnostics_service_role(self, auth_session):
        """Diagnostics for service role should return result"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/diagnostics", json={
            "role": "service"
        })
        assert resp.status_code == 200, f"Diagnostics failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["result"].get("role") == "service"
    
    def test_diagnostics_bill_role(self, auth_session):
        """Diagnostics for bill role should return result"""
        resp = auth_session.post(f"{BASE_URL}/api/table-hardware/diagnostics", json={
            "role": "bill"
        })
        assert resp.status_code == 200, f"Diagnostics failed: {resp.text}"
        data = resp.json()
        assert data.get("ok") is True
        assert data["result"].get("role") == "bill"


class TestHardwareConfigEndpoint:
    """Tests for GET /api/table-hardware"""
    
    def test_get_hardware_config(self, auth_session):
        """Get hardware config should return printers and URLs"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware")
        assert resp.status_code == 200, f"Get hardware config failed: {resp.text}"
        data = resp.json()
        assert "printers" in data
        assert isinstance(data["printers"], list)
        assert "button_webhook_url" in data
        assert "nfc_base_url" in data
        print(f"Hardware config: {len(data['printers'])} printers configured")


class TestDiagnosticsHistoryEndpoint:
    """Tests for GET /api/table-hardware/diagnostics"""
    
    def test_get_diagnostics_history(self, auth_session):
        """Get diagnostics history should return logs"""
        resp = auth_session.get(f"{BASE_URL}/api/table-hardware/diagnostics")
        assert resp.status_code == 200, f"Get diagnostics history failed: {resp.text}"
        data = resp.json()
        assert "logs" in data
        assert isinstance(data["logs"], list)
        print(f"Diagnostics history: {len(data['logs'])} logs")
