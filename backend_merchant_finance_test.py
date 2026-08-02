"""
BidBlitz Merchant Finance Backend API Tests
Tests: merchant login, balance, command-center, payouts, settlements, admin access
"""
import requests
import json
import time

BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"

# Test credentials from review request
MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


def test_merchant_login():
    """1. Merchant-Login funktioniert"""
    print("\n=== Test 1: Merchant Login ===")
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    assert resp.status_code == 200, f"Merchant login failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    assert "email" in data or "id" in data, "Expected user data in response"
    print(f"✓ Merchant login successful: {MERCHANT_EMAIL}")
    print(f"  - User role: {data.get('role', 'N/A')}")
    print(f"  - User ID: {data.get('id', 'N/A')}")
    return session


def test_merchant_balance(session):
    """2. GET /api/merchant/balance liefert 200 und Minor-Unit-Felder"""
    print("\n=== Test 2: Merchant Balance ===")
    resp = session.get(f"{BASE_URL}/api/merchant/balance")
    assert resp.status_code == 200, f"Balance failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    # Check for minor unit fields
    assert "available_minor" in data, "Expected available_minor field"
    assert "pending_minor" in data, "Expected pending_minor field"
    assert "reserved_minor" in data, "Expected reserved_minor field"
    assert "payout_in_progress_minor" in data, "Expected payout_in_progress_minor field"
    
    print(f"✓ Balance endpoint works with minor unit fields")
    print(f"  - Available: {data.get('available_minor')} minor units")
    print(f"  - Pending: {data.get('pending_minor')} minor units")
    print(f"  - Reserved: {data.get('reserved_minor')} minor units")
    print(f"  - Payout in progress: {data.get('payout_in_progress_minor')} minor units")
    return True


def test_merchant_command_center(session):
    """3. GET /api/merchant/command-center liefert 200 und Kernblöcke"""
    print("\n=== Test 3: Merchant Command Center ===")
    resp = session.get(f"{BASE_URL}/api/merchant/command-center")
    assert resp.status_code == 200, f"Command center failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    # Check for core blocks
    required_blocks = ["merchant", "balances", "top_cards", "live_status", "tasks", "settlements", "payouts"]
    for block in required_blocks:
        assert block in data, f"Expected {block} block in command center"
    
    print(f"✓ Command center endpoint works with all core blocks")
    print(f"  - Merchant: {data['merchant'].get('merchant_id', 'N/A')}")
    print(f"  - Balances: Available={data['balances'].get('available', 0)} EUR")
    print(f"  - Top Cards: {len(data['top_cards'])} cards")
    print(f"  - Live Status: {data['live_status'].get('status', 'N/A')}")
    print(f"  - Tasks: {len(data['tasks'])} tasks")
    print(f"  - Settlements: {len(data['settlements'])} settlements")
    print(f"  - Payouts: {len(data['payouts'])} payouts")
    return True


def test_merchant_payouts(session):
    """4. GET /api/merchant/payouts liefert 200"""
    print("\n=== Test 4: Merchant Payouts ===")
    resp = session.get(f"{BASE_URL}/api/merchant/payouts")
    assert resp.status_code == 200, f"Payouts failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert "rows" in data, "Expected rows in payouts response"
    print(f"✓ Payouts endpoint works")
    print(f"  - Total payouts: {len(data['rows'])}")
    if data['rows']:
        print(f"  - Latest payout: {data['rows'][0].get('payout_id', 'N/A')} - {data['rows'][0].get('status', 'N/A')}")
    return True


def test_merchant_instant_availability(session):
    """5. GET /api/merchant/payouts/instant-availability liefert 200 und available=false"""
    print("\n=== Test 5: Merchant Instant Payout Availability ===")
    resp = session.get(f"{BASE_URL}/api/merchant/payouts/instant-availability")
    assert resp.status_code == 200, f"Instant availability failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert "available" in data, "Expected available field"
    assert data["available"] is False, f"Expected available=false, got {data['available']}"
    print(f"✓ Instant payout availability endpoint works")
    print(f"  - Available: {data['available']}")
    print(f"  - Message: {data.get('message', 'N/A')}")
    return True


def test_merchant_daily_closing(session):
    """6. GET /api/merchant/pos/daily-closing liefert 200 und report_number"""
    print("\n=== Test 6: Merchant Daily Closing ===")
    resp = session.get(f"{BASE_URL}/api/merchant/pos/daily-closing")
    assert resp.status_code == 200, f"Daily closing failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert "report_number" in data, "Expected report_number field"
    print(f"✓ Daily closing endpoint works")
    print(f"  - Report number: {data.get('report_number', 'N/A')}")
    print(f"  - Date: {data.get('date', 'N/A')}")
    print(f"  - Gross sales: {data.get('gross_sales_minor', 0)} minor units")
    print(f"  - Net sales: {data.get('net_sales_minor', 0)} minor units")
    return True


def test_merchant_settlements_list(session):
    """7. GET /api/merchant-settlements liefert 200"""
    print("\n=== Test 7: Merchant Settlements List ===")
    resp = session.get(f"{BASE_URL}/api/merchant-settlements")
    assert resp.status_code == 200, f"Settlements list failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert "rows" in data, "Expected rows in settlements response"
    print(f"✓ Settlements list endpoint works")
    print(f"  - Total settlements: {len(data['rows'])}")
    if data['rows']:
        print(f"  - Latest settlement: {data['rows'][0].get('settlement_id', 'N/A')} - {data['rows'][0].get('status', 'N/A')}")
    return True


def test_merchant_settlements_overview(session):
    """8. GET /api/merchant-settlements/overview liefert 200"""
    print("\n=== Test 8: Merchant Settlements Overview ===")
    resp = session.get(f"{BASE_URL}/api/merchant-settlements/overview")
    assert resp.status_code == 200, f"Settlements overview failed: {resp.status_code} - {resp.text}"
    data = resp.json()
    
    assert "balances" in data, "Expected balances in overview"
    assert "settlements" in data, "Expected settlements in overview"
    assert "payouts" in data, "Expected payouts in overview"
    print(f"✓ Settlements overview endpoint works")
    print(f"  - Balances: {data['balances'].get('available', 0)} EUR available")
    print(f"  - Settlements: {len(data['settlements'])} settlements")
    print(f"  - Payouts: {len(data['payouts'])} payouts")
    return True


def test_admin_merchant_settlements():
    """9. GET /api/admin/merchant-settlements liefert für Admin 200 und für Merchant 403"""
    print("\n=== Test 9: Admin Merchant Settlements Access Control ===")
    
    # Test with admin
    print("  Testing with admin credentials...")
    admin_session = requests.Session()
    admin_login = admin_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert admin_login.status_code == 200, f"Admin login failed: {admin_login.status_code}"
    
    admin_resp = admin_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
    assert admin_resp.status_code == 200, f"Admin access failed: {admin_resp.status_code} - {admin_resp.text}"
    admin_data = admin_resp.json()
    
    assert "settlements" in admin_data, "Expected settlements in admin response"
    assert "payouts" in admin_data, "Expected payouts in admin response"
    assert "balances" in admin_data, "Expected balances in admin response"
    print(f"  ✓ Admin can access: {len(admin_data['settlements'])} settlements, {len(admin_data['payouts'])} payouts")
    
    # Test with merchant (should get 403)
    print("  Testing with merchant credentials...")
    merchant_session = requests.Session()
    merchant_login = merchant_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": MERCHANT_EMAIL,
        "password": MERCHANT_PASSWORD
    })
    assert merchant_login.status_code == 200, f"Merchant login failed: {merchant_login.status_code}"
    
    merchant_resp = merchant_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
    assert merchant_resp.status_code == 403, f"Expected 403 for merchant, got {merchant_resp.status_code}"
    print(f"  ✓ Merchant correctly denied access (403)")
    
    print(f"✓ Admin access control works correctly")
    return True


def run_all_tests():
    """Run all Merchant Finance backend tests"""
    print("=" * 80)
    print("BidBlitz Merchant Finance Backend API Test Suite")
    print("=" * 80)
    
    # First login as merchant
    merchant_session = test_merchant_login()
    
    tests = [
        ("Merchant Balance", lambda: test_merchant_balance(merchant_session)),
        ("Merchant Command Center", lambda: test_merchant_command_center(merchant_session)),
        ("Merchant Payouts", lambda: test_merchant_payouts(merchant_session)),
        ("Merchant Instant Availability", lambda: test_merchant_instant_availability(merchant_session)),
        ("Merchant Daily Closing", lambda: test_merchant_daily_closing(merchant_session)),
        ("Merchant Settlements List", lambda: test_merchant_settlements_list(merchant_session)),
        ("Merchant Settlements Overview", lambda: test_merchant_settlements_overview(merchant_session)),
        ("Admin Merchant Settlements Access Control", test_admin_merchant_settlements),
    ]
    
    passed = 0
    failed = 0
    errors = []
    
    for name, test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            failed += 1
            errors.append(f"❌ {name}: {str(e)}")
            print(f"❌ FAILED: {name}")
            print(f"   Error: {str(e)}")
        except Exception as e:
            failed += 1
            errors.append(f"❌ {name}: {type(e).__name__}: {str(e)}")
            print(f"❌ ERROR: {name}")
            print(f"   {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total: {len(tests) + 1} tests (including login)")
    print(f"✓ Passed: {passed + 1}")
    print(f"❌ Failed: {failed}")
    
    if errors:
        print("\nFailed Tests:")
        for error in errors:
            print(f"  {error}")
    
    print("=" * 80)
    return passed + 1, failed, errors


if __name__ == "__main__":
    passed, failed, errors = run_all_tests()
    exit(0 if failed == 0 else 1)
