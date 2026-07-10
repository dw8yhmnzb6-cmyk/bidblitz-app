"""
Restaurant Printer Flow - Backend Smoke Test
Tests existing endpoints for Kitchen → Service → Bill guided onboarding flow
Only frontend extensions were added, no new backend logic.

Endpoints to test:
- GET /api/table-hardware
- GET /api/table-hardware/diagnostics
- POST /api/table-hardware/diagnostics
- POST /api/table-hardware/discover
- POST /api/table-hardware/printers/test
"""

import os
import requests
import json

BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

def login():
    """Login and return session with cookies"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if resp.status_code == 429:
        print("❌ Rate limited - retry later")
        return None
    
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} - {resp.text}")
        return None
    
    print(f"✅ Login successful: {ADMIN_EMAIL}")
    return session


def test_get_table_hardware(session):
    """Test GET /api/table-hardware"""
    print("\n📋 Test 1: GET /api/table-hardware")
    
    resp = session.get(f"{BASE_URL}/api/table-hardware")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Status {resp.status_code}")
        print(f"   Response: {resp.text[:200]}")
        return False
    
    data = resp.json()
    
    # Check required fields
    required_fields = ["printers", "button_webhook_url", "nfc_base_url"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        print(f"❌ FAILED: Missing fields: {missing}")
        return False
    
    if not isinstance(data["printers"], list):
        print(f"❌ FAILED: 'printers' is not a list")
        return False
    
    print(f"✅ PASSED: Returns {len(data['printers'])} printers")
    print(f"   Fields: printers, button_webhook_url, nfc_base_url")
    return True


def test_get_diagnostics_history(session):
    """Test GET /api/table-hardware/diagnostics"""
    print("\n📋 Test 2: GET /api/table-hardware/diagnostics")
    
    resp = session.get(f"{BASE_URL}/api/table-hardware/diagnostics")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Status {resp.status_code}")
        print(f"   Response: {resp.text[:200]}")
        return False
    
    data = resp.json()
    
    if "logs" not in data:
        print(f"❌ FAILED: Missing 'logs' field")
        return False
    
    if not isinstance(data["logs"], list):
        print(f"❌ FAILED: 'logs' is not a list")
        return False
    
    print(f"✅ PASSED: Returns {len(data['logs'])} diagnostic logs")
    return True


def test_post_diagnostics(session):
    """Test POST /api/table-hardware/diagnostics"""
    print("\n📋 Test 3: POST /api/table-hardware/diagnostics")
    
    # Test with kitchen role
    resp = session.post(f"{BASE_URL}/api/table-hardware/diagnostics", json={
        "role": "kitchen"
    })
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Status {resp.status_code}")
        print(f"   Response: {resp.text[:200]}")
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        print(f"❌ FAILED: Response ok=false")
        return False
    
    if "result" not in data:
        print(f"❌ FAILED: Missing 'result' field")
        return False
    
    if data["result"].get("role") != "kitchen":
        print(f"❌ FAILED: Expected role='kitchen', got '{data['result'].get('role')}'")
        return False
    
    print(f"✅ PASSED: Diagnostics for kitchen role successful")
    print(f"   Result: {json.dumps(data['result'], indent=2)[:150]}...")
    return True


def test_discover_printers(session):
    """Test POST /api/table-hardware/discover"""
    print("\n📋 Test 4: POST /api/table-hardware/discover")
    
    # Test with small subnet range (won't find real printers in preview env)
    resp = session.post(f"{BASE_URL}/api/table-hardware/discover", json={
        "subnet": "192.168.1",
        "start_host": 1,
        "end_host": 3,
        "ports": [9100]
    })
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Status {resp.status_code}")
        print(f"   Response: {resp.text[:200]}")
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        print(f"❌ FAILED: Response ok=false")
        return False
    
    required_fields = ["results", "count", "subnet"]
    missing = [f for f in required_fields if f not in data]
    
    if missing:
        print(f"❌ FAILED: Missing fields: {missing}")
        return False
    
    if not isinstance(data["results"], list):
        print(f"❌ FAILED: 'results' is not a list")
        return False
    
    print(f"✅ PASSED: Discovery completed, found {data['count']} printers")
    print(f"   (Expected 0 in preview environment)")
    return True


def test_printer_test(session):
    """Test POST /api/table-hardware/printers/test"""
    print("\n📋 Test 5: POST /api/table-hardware/printers/test")
    
    # Test with file type (fallback, should always work)
    resp = session.post(f"{BASE_URL}/api/table-hardware/printers/test", json={
        "role": "kitchen",
        "name": "Smoke Test Printer",
        "type": "file",
        "ip": "",
        "port": 9100,
        "device": ""
    })
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Status {resp.status_code}")
        print(f"   Response: {resp.text[:200]}")
        return False
    
    data = resp.json()
    
    if not data.get("ok"):
        print(f"❌ FAILED: Response ok=false")
        return False
    
    if "result" not in data:
        print(f"❌ FAILED: Missing 'result' field")
        return False
    
    print(f"✅ PASSED: Printer test successful")
    print(f"   Result: {json.dumps(data['result'], indent=2)[:150]}...")
    return True


def main():
    print("=" * 70)
    print("Restaurant Printer Flow - Backend Smoke Test")
    print("=" * 70)
    print(f"Environment: {BASE_URL}")
    print(f"Credentials: {ADMIN_EMAIL}")
    print("=" * 70)
    
    # Login
    session = login()
    if not session:
        print("\n❌ SMOKE TEST FAILED: Cannot login")
        return
    
    # Run tests
    results = []
    results.append(("GET /api/table-hardware", test_get_table_hardware(session)))
    results.append(("GET /api/table-hardware/diagnostics", test_get_diagnostics_history(session)))
    results.append(("POST /api/table-hardware/diagnostics", test_post_diagnostics(session)))
    results.append(("POST /api/table-hardware/discover", test_discover_printers(session)))
    results.append(("POST /api/table-hardware/printers/test", test_printer_test(session)))
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for endpoint, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {endpoint}")
    
    print("=" * 70)
    print(f"Result: {passed}/{total} tests passed ({passed*100//total}%)")
    print("=" * 70)
    
    if passed == total:
        print("\n✅ ALL SMOKE TESTS PASSED - Backend endpoints working correctly")
    else:
        print(f"\n❌ {total - passed} test(s) failed - See details above")


if __name__ == "__main__":
    main()
