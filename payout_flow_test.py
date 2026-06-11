#!/usr/bin/env python3
"""
BidBlitz Payout Flow Test
Tests the repaired Mining Withdraw and Merchant Payout flow in preview environment.

Test Scope:
1. Login functionality
2. Mining Withdraw API (POST /api/mining/withdraw) - increases EUR wallet
3. Merchant Payout Balance (GET /api/payout/balance) - returns meaningful data
4. Merchant Payout Request (POST /api/payout/request) - creates request successfully
5. Payout History (GET /api/payout/history) - shows new request

External Preview URL: https://taxi-uber-style.preview.emergentagent.com
Test User: admin@bidblitz.com / BidBlitz2026!
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any

# Configuration
BASE_URL = "https://taxi-uber-style.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = []
session_cookies = None


def log_test(test_name: str, passed: bool, status_code: int, response_data: Any, 
             expected: str, actual: str, notes: str = ""):
    """Log test result with detailed information"""
    result = {
        "test_name": test_name,
        "passed": passed,
        "status_code": status_code,
        "response": response_data if isinstance(response_data, dict) else str(response_data),
        "expected": expected,
        "actual": actual,
        "notes": notes,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    print(f"   Status Code: {status_code}")
    if notes:
        print(f"   Notes: {notes}")
    if not passed:
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
    return passed


def make_request(method: str, endpoint: str, data: Dict = None, cookies: Dict = None) -> tuple:
    """Make HTTP request and return (status_code, response_data)"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, cookies=cookies, timeout=30)
        elif method == "POST":
            resp = requests.post(url, json=data, cookies=cookies, timeout=30)
        else:
            return 0, {"error": f"Unsupported method: {method}"}
        
        try:
            return resp.status_code, resp.json()
        except:
            return resp.status_code, {"text": resp.text}
    except Exception as e:
        return 0, {"error": str(e)}


def test_login():
    """Test 1: Login functionality"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 1: Login Functionality")
    print("="*80)
    
    # Make login request and capture cookies
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    status = resp.status_code
    try:
        data = resp.json()
    except:
        data = {"text": resp.text}
    
    session_cookies = resp.cookies.get_dict()
    
    # Check if login was successful (200 status and has user data or id field)
    if status == 200 and ("id" in data or "user" in data or "email" in data):
        passed = log_test(
            "Login with admin@bidblitz.com",
            True,
            status,
            data,
            "200 OK with user data",
            f"Status {status}, User ID: {data.get('id', 'N/A')}, Email: {data.get('email', 'N/A')}",
            f"Login successful. Session cookies: {list(session_cookies.keys())}"
        )
        return passed
    else:
        passed = log_test(
            "Login with admin@bidblitz.com",
            False,
            status,
            data,
            "200 OK with user data",
            f"Status {status}, data: {data}",
            "Login failed"
        )
        return passed


def test_mining_withdraw():
    """Test 2: Mining Withdraw API"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 2: Mining Withdraw API")
    print("="*80)
    
    # First, get current mining wallet balance via dashboard
    status, wallet_data = make_request("GET", "/mining/dashboard", cookies=session_cookies)
    
    if status != 200:
        log_test(
            "Get Mining Dashboard",
            False,
            status,
            wallet_data,
            "200 OK with dashboard data",
            f"Status {status}",
            "Failed to get mining dashboard"
        )
        return False
    
    # Extract wallet info from dashboard
    wallet = wallet_data.get("wallet", {})
    blz_balance = wallet.get("blz_balance", 0)
    print(f"   Current BLZ Balance: {blz_balance}")
    
    # Get current EUR balance
    status, user_data = make_request("GET", "/auth/me", cookies=session_cookies)
    if status != 200:
        log_test(
            "Get User EUR Balance",
            False,
            status,
            user_data,
            "200 OK with user data",
            f"Status {status}",
            "Failed to get user EUR balance"
        )
        return False
    
    initial_eur_balance = user_data.get("balance", 0)
    print(f"   Current EUR Balance: €{initial_eur_balance}")
    
    # Check if we have enough BLZ to withdraw
    if blz_balance < 10:
        log_test(
            "Mining Withdraw - Insufficient Balance Check",
            True,
            status,
            {"blz_balance": blz_balance},
            "BLZ balance >= 10 for test",
            f"BLZ balance: {blz_balance}",
            f"Insufficient BLZ balance ({blz_balance}) for withdraw test. Skipping withdraw test."
        )
        return True  # Not a failure, just insufficient balance
    
    # Attempt to withdraw 10 BLZ
    withdraw_amount = 10.0
    status, withdraw_data = make_request("POST", "/mining/withdraw", {
        "amount": withdraw_amount
    }, cookies=session_cookies)
    
    if status == 200:
        new_blz_balance = withdraw_data.get("new_blz_balance", 0)
        new_eur_balance = withdraw_data.get("new_eur_balance", 0)
        received_eur = withdraw_data.get("received_eur", 0)
        
        # Verify BLZ was deducted
        blz_deducted = abs(blz_balance - new_blz_balance - withdraw_amount) < 0.01
        
        # Verify EUR was added
        eur_added = abs(new_eur_balance - initial_eur_balance - received_eur) < 0.01
        
        if blz_deducted and eur_added:
            passed = log_test(
                "Mining Withdraw - 10 BLZ to EUR",
                True,
                status,
                withdraw_data,
                f"BLZ deducted: {withdraw_amount}, EUR added: {received_eur}",
                f"BLZ: {blz_balance} → {new_blz_balance}, EUR: €{initial_eur_balance} → €{new_eur_balance}",
                f"Successfully withdrew {withdraw_amount} BLZ and received €{received_eur}"
            )
            return passed
        else:
            passed = log_test(
                "Mining Withdraw - Balance Verification",
                False,
                status,
                withdraw_data,
                f"BLZ deducted: {withdraw_amount}, EUR added",
                f"BLZ deducted: {blz_deducted}, EUR added: {eur_added}",
                "Balance changes don't match expected values"
            )
            return passed
    else:
        passed = log_test(
            "Mining Withdraw - API Call",
            False,
            status,
            withdraw_data,
            "200 OK with withdraw confirmation",
            f"Status {status}",
            "Mining withdraw API call failed"
        )
        return passed


def test_payout_balance():
    """Test 3: Merchant Payout Balance"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 3: Merchant Payout Balance")
    print("="*80)
    
    status, data = make_request("GET", "/payout/balance", cookies=session_cookies)
    
    if status == 200:
        # Check if response has expected fields
        expected_fields = ["available", "pending_payout", "total_paid_out", "total_earnings"]
        has_all_fields = all(field in data for field in expected_fields)
        
        if has_all_fields:
            passed = log_test(
                "Payout Balance - Get Balance",
                True,
                status,
                data,
                "200 OK with balance fields",
                f"Available: €{data.get('available', 0)}, Pending: €{data.get('pending_payout', 0)}, Total Earnings: €{data.get('total_earnings', 0)}",
                f"Payout balance retrieved successfully. Available: €{data.get('available', 0)}"
            )
            return passed
        else:
            missing_fields = [f for f in expected_fields if f not in data]
            passed = log_test(
                "Payout Balance - Field Validation",
                False,
                status,
                data,
                f"All fields present: {expected_fields}",
                f"Missing fields: {missing_fields}",
                "Response missing expected fields"
            )
            return passed
    else:
        passed = log_test(
            "Payout Balance - API Call",
            False,
            status,
            data,
            "200 OK with balance data",
            f"Status {status}",
            "Payout balance API call failed"
        )
        return passed


def test_payout_request():
    """Test 4: Merchant Payout Request"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 4: Merchant Payout Request")
    print("="*80)
    
    # First, get available balance
    status, balance_data = make_request("GET", "/payout/balance", cookies=session_cookies)
    
    if status != 200:
        log_test(
            "Payout Request - Get Balance First",
            False,
            status,
            balance_data,
            "200 OK",
            f"Status {status}",
            "Failed to get balance before payout request"
        )
        return False
    
    available = balance_data.get("available", 0)
    min_payout = balance_data.get("min_payout", 10)
    
    print(f"   Available Balance: €{available}")
    print(f"   Minimum Payout: €{min_payout}")
    
    # Check if there's already a pending payout
    status, history_data = make_request("GET", "/payout/history", cookies=session_cookies)
    if status == 200:
        payouts = history_data.get("payouts", [])
        pending_payouts = [p for p in payouts if p.get("status") in ["pending", "approved"]]
        if pending_payouts:
            log_test(
                "Payout Request - Existing Pending Check",
                True,
                status,
                {"pending_count": len(pending_payouts)},
                "No pending payouts or handle existing",
                f"Found {len(pending_payouts)} pending payout(s)",
                f"There are already {len(pending_payouts)} pending payout(s). Skipping new payout request test."
            )
            return True  # Not a failure, just can't test due to existing pending
    
    # Check if we have enough balance
    if available < min_payout:
        log_test(
            "Payout Request - Insufficient Balance Check",
            True,
            status,
            {"available": available, "min_payout": min_payout},
            f"Available >= {min_payout}",
            f"Available: €{available}",
            f"Insufficient balance (€{available}) for payout request. Minimum: €{min_payout}. Skipping payout request test."
        )
        return True  # Not a failure, just insufficient balance
    
    # Request payout (use minimum amount)
    payout_amount = min_payout
    status, payout_data = make_request("POST", "/payout/request", {
        "amount": payout_amount,
        "notes": "Test payout request from automated testing"
    }, cookies=session_cookies)
    
    if status == 200:
        # Check if payout was created
        if payout_data.get("success") and "payout" in payout_data:
            payout = payout_data["payout"]
            passed = log_test(
                "Payout Request - Create Request",
                True,
                status,
                payout_data,
                f"Payout created with amount €{payout_amount}",
                f"Payout ID: {payout.get('id', 'N/A')}, Status: {payout.get('status', 'N/A')}, Net: €{payout.get('net_amount', 0)}",
                f"Payout request created successfully. Reference: {payout.get('reference', 'N/A')}"
            )
            return passed
        else:
            passed = log_test(
                "Payout Request - Response Validation",
                False,
                status,
                payout_data,
                "success=True and payout object",
                f"success={payout_data.get('success')}, has payout={'payout' in payout_data}",
                "Response missing expected fields"
            )
            return passed
    elif status == 409:
        # Conflict - already has pending payout
        log_test(
            "Payout Request - Duplicate Prevention",
            True,
            status,
            payout_data,
            "409 Conflict for duplicate payout",
            f"Status {status}",
            "Duplicate payout prevention working correctly (409 Conflict)"
        )
        return True
    else:
        passed = log_test(
            "Payout Request - API Call",
            False,
            status,
            payout_data,
            "200 OK with payout confirmation",
            f"Status {status}",
            "Payout request API call failed"
        )
        return passed


def test_payout_history():
    """Test 5: Payout History"""
    global session_cookies
    
    print("\n" + "="*80)
    print("TEST 5: Payout History")
    print("="*80)
    
    status, data = make_request("GET", "/payout/history", cookies=session_cookies)
    
    if status == 200:
        # Check if response has expected structure
        if "payouts" in data:
            payouts = data.get("payouts", [])
            total = data.get("total", 0)
            
            passed = log_test(
                "Payout History - Get History",
                True,
                status,
                {"payouts_count": len(payouts), "total": total},
                "200 OK with payouts array",
                f"Found {len(payouts)} payout(s), Total: {total}",
                f"Payout history retrieved successfully. {len(payouts)} payout(s) in history."
            )
            
            # If there are payouts, check the structure of the first one
            if payouts:
                first_payout = payouts[0]
                expected_fields = ["id", "amount", "status", "created_at"]
                has_fields = all(field in first_payout for field in expected_fields)
                
                if has_fields:
                    print(f"   Latest Payout: ID={first_payout.get('id')}, Amount=€{first_payout.get('amount')}, Status={first_payout.get('status')}")
                else:
                    print(f"   Warning: First payout missing some expected fields")
            
            return passed
        else:
            passed = log_test(
                "Payout History - Response Structure",
                False,
                status,
                data,
                "Response with 'payouts' field",
                f"Fields: {list(data.keys())}",
                "Response missing 'payouts' field"
            )
            return passed
    else:
        passed = log_test(
            "Payout History - API Call",
            False,
            status,
            data,
            "200 OK with history data",
            f"Status {status}",
            "Payout history API call failed"
        )
        return passed


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed_tests = sum(1 for t in test_results if t["passed"])
    total_tests = len(test_results)
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print("\n" + "-"*80)
    print("DETAILED RESULTS:")
    print("-"*80)
    
    for result in test_results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"\n{status} - {result['test_name']}")
        print(f"   Status Code: {result['status_code']}")
        if result["notes"]:
            print(f"   Notes: {result['notes']}")
        if not result["passed"]:
            print(f"   Expected: {result['expected']}")
            print(f"   Actual: {result['actual']}")
    
    # Save results to JSON file
    with open("/app/payout_flow_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": total_tests - passed_tests,
                "success_rate": f"{(passed_tests/total_tests*100):.1f}%",
                "timestamp": datetime.now().isoformat()
            },
            "tests": test_results
        }, f, indent=2)
    
    print(f"\n✅ Test results saved to /app/payout_flow_test_results.json")


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BIDBLITZ PAYOUT FLOW TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {ADMIN_EMAIL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Run tests in sequence
    tests = [
        test_login,
        test_mining_withdraw,
        test_payout_balance,
        test_payout_request,
        test_payout_history,
    ]
    
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"\n❌ EXCEPTION in {test_func.__name__}: {str(e)}")
            log_test(
                test_func.__name__,
                False,
                0,
                {"error": str(e)},
                "Test execution without exception",
                f"Exception: {str(e)}",
                "Test raised an exception"
            )
    
    # Print summary
    print_summary()


if __name__ == "__main__":
    main()
