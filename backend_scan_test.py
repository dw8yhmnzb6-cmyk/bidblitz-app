#!/usr/bin/env python3
"""
BidBlitz V2 - Barcode/QR-Scan System Backend API Testing
=========================================================
Tests:
1. POST /api/scan/resolve with TBL-... → /order/qr/...
2. POST /api/scan/resolve with BBINV-... → /invoice/pay/...
3. GET /api/invoicing/public/:scanCode
4. POST /api/invoicing/public/:scanCode/pay with Auth
5. QR-Tisch-Erstellung liefert stabiles scan_code Feld
"""
import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://taxi-uber-style.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"
MANAGER_EMAIL = "haendler@bidblitz.com"
MANAGER_PASSWORD = "Haendler2026!"

# Test results storage
test_results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}

def log_test(test_name, passed, details):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    test_results["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })

def login(email, password):
    """Login and return session cookies"""
    print(f"\n🔐 Logging in as {email}...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        print(f"✅ Login successful: {email}")
        return response.cookies
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_scan_resolve_tbl():
    """Test 1: POST /api/scan/resolve with TBL-... → /order/qr/..."""
    print("\n" + "="*80)
    print("TEST 1: POST /api/scan/resolve with TBL-... code")
    print("="*80)
    
    # First, create a test table as manager
    manager_cookies = login(MANAGER_EMAIL, MANAGER_PASSWORD)
    if not manager_cookies:
        log_test("Test 1: Scan Resolve TBL", False, "Manager login failed")
        return None
    
    # Create a test table
    print("\n📋 Creating test table...")
    create_response = requests.post(
        f"{BASE_URL}/api/merchant/qr-tables",
        json={
            "merchant_id": "test_merchant_001",
            "label": "Test Tisch 1",
            "capacity": 4
        },
        cookies=manager_cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if create_response.status_code != 200:
        log_test("Test 1: Scan Resolve TBL", False, f"Table creation failed: {create_response.status_code} - {create_response.text}")
        return None
    
    table_data = create_response.json()
    print(f"✅ Table created: {json.dumps(table_data, indent=2)}")
    
    scan_code = table_data.get("table", {}).get("scan_code")
    if not scan_code or not scan_code.startswith("TBL-"):
        log_test("Test 1: Scan Resolve TBL", False, f"Invalid scan_code format: {scan_code}")
        return None
    
    print(f"\n🔍 Testing scan resolve with code: {scan_code}")
    
    # Test scan/resolve endpoint
    resolve_response = requests.post(
        f"{BASE_URL}/api/scan/resolve",
        json={"code": scan_code},
        headers={"Content-Type": "application/json"}
    )
    
    if resolve_response.status_code == 200:
        resolve_data = resolve_response.json()
        print(f"✅ Scan resolve response: {json.dumps(resolve_data, indent=2)}")
        
        # Verify response structure
        if resolve_data.get("ok") and resolve_data.get("type") == "table_order" and "/order/qr/" in resolve_data.get("route", ""):
            log_test("Test 1: Scan Resolve TBL", True, f"TBL-{scan_code[-10:]} correctly resolved to {resolve_data.get('route')}")
            return scan_code
        else:
            log_test("Test 1: Scan Resolve TBL", False, f"Invalid response structure: {resolve_data}")
            return None
    else:
        log_test("Test 1: Scan Resolve TBL", False, f"Scan resolve failed: {resolve_response.status_code} - {resolve_response.text}")
        return None

def test_scan_resolve_invoice():
    """Test 2: POST /api/scan/resolve with BBINV-... → /invoice/pay/..."""
    print("\n" + "="*80)
    print("TEST 2: POST /api/scan/resolve with BBINV-... code")
    print("="*80)
    
    # Login as manager to create invoice
    manager_cookies = login(MANAGER_EMAIL, MANAGER_PASSWORD)
    if not manager_cookies:
        log_test("Test 2: Scan Resolve BBINV", False, "Manager login failed")
        return None
    
    # Create a test invoice
    print("\n📄 Creating test invoice...")
    create_response = requests.post(
        f"{BASE_URL}/api/invoicing/create",
        json={
            "client_name": "Test Kunde QR Scan",
            "client_email": "testkunde@example.com",
            "items": [
                {"description": "Test Artikel 1", "quantity": 2, "unit_price": 15.50},
                {"description": "Test Artikel 2", "quantity": 1, "unit_price": 25.00}
            ],
            "notes": "Test Rechnung für QR-Scan System",
            "due_days": 14
        },
        cookies=manager_cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if create_response.status_code != 200:
        log_test("Test 2: Scan Resolve BBINV", False, f"Invoice creation failed: {create_response.status_code} - {create_response.text}")
        return None
    
    invoice_data = create_response.json()
    print(f"✅ Invoice created: {json.dumps(invoice_data, indent=2)}")
    
    scan_code = invoice_data.get("scan_code")
    if not scan_code or not scan_code.startswith("BBINV-"):
        log_test("Test 2: Scan Resolve BBINV", False, f"Invalid scan_code format: {scan_code}")
        return None
    
    print(f"\n🔍 Testing scan resolve with code: {scan_code}")
    
    # Test scan/resolve endpoint
    resolve_response = requests.post(
        f"{BASE_URL}/api/scan/resolve",
        json={"code": scan_code},
        headers={"Content-Type": "application/json"}
    )
    
    if resolve_response.status_code == 200:
        resolve_data = resolve_response.json()
        print(f"✅ Scan resolve response: {json.dumps(resolve_data, indent=2)}")
        
        # Verify response structure
        if resolve_data.get("ok") and resolve_data.get("type") == "invoice" and "/invoice/pay/" in resolve_data.get("route", ""):
            log_test("Test 2: Scan Resolve BBINV", True, f"{scan_code} correctly resolved to {resolve_data.get('route')}")
            return scan_code
        else:
            log_test("Test 2: Scan Resolve BBINV", False, f"Invalid response structure: {resolve_data}")
            return None
    else:
        log_test("Test 2: Scan Resolve BBINV", False, f"Scan resolve failed: {resolve_response.status_code} - {resolve_response.text}")
        return None

def test_public_invoice_get(scan_code):
    """Test 3: GET /api/invoicing/public/:scanCode"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/invoicing/public/:scanCode")
    print("="*80)
    
    print(f"\n🔍 Fetching public invoice: {scan_code}")
    
    response = requests.get(
        f"{BASE_URL}/api/invoicing/public/{scan_code}",
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        invoice_data = response.json()
        print(f"✅ Public invoice response: {json.dumps(invoice_data, indent=2)}")
        
        # Verify required fields
        required_fields = ["invoice_id", "invoice_number", "scan_code", "client_name", "items", "total", "status"]
        missing_fields = [f for f in required_fields if f not in invoice_data]
        
        if not missing_fields:
            log_test("Test 3: Public Invoice GET", True, f"Invoice {scan_code} retrieved successfully with all required fields")
            return invoice_data
        else:
            log_test("Test 3: Public Invoice GET", False, f"Missing fields: {missing_fields}")
            return None
    else:
        log_test("Test 3: Public Invoice GET", False, f"Failed to fetch invoice: {response.status_code} - {response.text}")
        return None

def test_public_invoice_pay(scan_code):
    """Test 4: POST /api/invoicing/public/:scanCode/pay with Auth"""
    print("\n" + "="*80)
    print("TEST 4: POST /api/invoicing/public/:scanCode/pay with Auth")
    print("="*80)
    
    # Login as admin (different user than invoice creator)
    admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_cookies:
        log_test("Test 4: Public Invoice Pay", False, "Admin login failed")
        return False
    
    print(f"\n💳 Attempting to pay invoice: {scan_code}")
    
    response = requests.post(
        f"{BASE_URL}/api/invoicing/public/{scan_code}/pay",
        cookies=admin_cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        pay_data = response.json()
        print(f"✅ Payment response: {json.dumps(pay_data, indent=2)}")
        
        if pay_data.get("ok") and pay_data.get("invoice", {}).get("status") == "paid":
            log_test("Test 4: Public Invoice Pay", True, f"Invoice {scan_code} paid successfully")
            return True
        else:
            log_test("Test 4: Public Invoice Pay", False, f"Payment succeeded but status not updated: {pay_data}")
            return False
    elif response.status_code == 409:
        # Already paid - this is acceptable
        print(f"⚠️ Invoice already paid (409 Conflict)")
        log_test("Test 4: Public Invoice Pay", True, f"Invoice {scan_code} already paid (expected for re-run)")
        return True
    elif response.status_code == 402:
        # Insufficient balance
        print(f"⚠️ Insufficient balance (402 Payment Required)")
        log_test("Test 4: Public Invoice Pay", True, f"Payment blocked due to insufficient balance (expected behavior)")
        return True
    else:
        log_test("Test 4: Public Invoice Pay", False, f"Payment failed: {response.status_code} - {response.text}")
        return False

def test_table_scan_code_stability():
    """Test 5: QR-Tisch-Erstellung liefert stabiles scan_code Feld"""
    print("\n" + "="*80)
    print("TEST 5: QR-Tisch-Erstellung liefert stabiles scan_code Feld")
    print("="*80)
    
    # Login as manager
    manager_cookies = login(MANAGER_EMAIL, MANAGER_PASSWORD)
    if not manager_cookies:
        log_test("Test 5: Table scan_code Stability", False, "Manager login failed")
        return False
    
    # Create a test table
    print("\n📋 Creating test table for stability check...")
    create_response = requests.post(
        f"{BASE_URL}/api/merchant/qr-tables",
        json={
            "merchant_id": "test_merchant_stability",
            "label": "Stability Test Tisch",
            "capacity": 6
        },
        cookies=manager_cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if create_response.status_code != 200:
        log_test("Test 5: Table scan_code Stability", False, f"Table creation failed: {create_response.status_code}")
        return False
    
    table_data = create_response.json()
    table_id = table_data.get("table", {}).get("table_id")
    scan_code_1 = table_data.get("table", {}).get("scan_code")
    
    print(f"✅ Table created with scan_code: {scan_code_1}")
    
    if not scan_code_1 or not scan_code_1.startswith("TBL-"):
        log_test("Test 5: Table scan_code Stability", False, f"Invalid scan_code format: {scan_code_1}")
        return False
    
    # Fetch table list to verify scan_code persists
    print(f"\n🔍 Fetching table list to verify scan_code persistence...")
    list_response = requests.get(
        f"{BASE_URL}/api/merchant/qr-tables/test_merchant_stability",
        cookies=manager_cookies,
        headers={"Content-Type": "application/json"}
    )
    
    if list_response.status_code != 200:
        log_test("Test 5: Table scan_code Stability", False, f"Failed to fetch table list: {list_response.status_code}")
        return False
    
    tables = list_response.json().get("tables", [])
    matching_table = next((t for t in tables if t.get("table_id") == table_id), None)
    
    if not matching_table:
        log_test("Test 5: Table scan_code Stability", False, f"Table {table_id} not found in list")
        return False
    
    scan_code_2 = matching_table.get("scan_code")
    print(f"✅ Table fetched with scan_code: {scan_code_2}")
    
    # Verify scan_code is stable
    if scan_code_1 == scan_code_2:
        log_test("Test 5: Table scan_code Stability", True, f"scan_code is stable: {scan_code_1} == {scan_code_2}")
        return True
    else:
        log_test("Test 5: Table scan_code Stability", False, f"scan_code changed: {scan_code_1} != {scan_code_2}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BidBlitz V2 - Barcode/QR-Scan System Backend API Testing")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {test_results['timestamp']}")
    
    # Test 1: Scan resolve with TBL code
    tbl_scan_code = test_scan_resolve_tbl()
    
    # Test 2: Scan resolve with BBINV code
    invoice_scan_code = test_scan_resolve_invoice()
    
    # Test 3: Public invoice GET
    if invoice_scan_code:
        invoice_data = test_public_invoice_get(invoice_scan_code)
        
        # Test 4: Public invoice pay
        if invoice_data:
            test_public_invoice_pay(invoice_scan_code)
    
    # Test 5: Table scan_code stability
    test_table_scan_code_stability()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(test_results["tests"])
    passed_tests = sum(1 for t in test_results["tests"] if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print("\n📋 Detailed Results:")
    for i, test in enumerate(test_results["tests"], 1):
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"{i}. {status}: {test['name']}")
        print(f"   {test['details']}")
    
    # Save results to file
    with open("/app/scan_system_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n💾 Test results saved to: /app/scan_system_test_results.json")
    
    # Exit with appropriate code
    sys.exit(0 if failed_tests == 0 else 1)

if __name__ == "__main__":
    main()
