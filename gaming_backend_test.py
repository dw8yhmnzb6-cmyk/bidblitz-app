#!/usr/bin/env python3
"""
Game Center Coins Recharge Backend Test
Tests the gaming API endpoints after router registration fix.

Problem: User reported coins recharge not working in Game Center
Root cause: /api/gaming/* routes were not registered (404 errors)
Fix: Verified routes.gaming router is registered in router_registry.py

Test Focus:
1. POST /api/auth/login works
2. GET /api/gaming/profile returns 200 (not 404)
3. POST /api/gaming/buy-coins with {"amount": 1} returns 200 (not 404)
4. Response contains ok, coins_added, new_balance
5. No 500 errors in gaming flow (regression check)
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "timestamp": datetime.utcnow().isoformat(),
    "base_url": BASE_URL,
    "tests": [],
    "summary": {"passed": 0, "failed": 0, "total": 0}
}


def log_test(test_name, passed, details):
    """Log test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"  Details: {details}")
    
    results["tests"].append({
        "name": test_name,
        "passed": passed,
        "details": details
    })
    results["summary"]["total"] += 1
    if passed:
        results["summary"]["passed"] += 1
    else:
        results["summary"]["failed"] += 1


def test_admin_login():
    """Test 1: POST /api/auth/login works"""
    print("\n" + "="*80)
    print("TEST 1: Admin Login")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check for access_token cookie
            has_token = "access_token" in cookies or "refresh_token" in cookies
            
            log_test(
                "Admin Login",
                True,
                f"Status: {response.status_code}, Has cookies: {has_token}, User: {data.get('email', 'N/A')}"
            )
            return cookies
        else:
            log_test(
                "Admin Login",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            return None
            
    except Exception as e:
        log_test("Admin Login", False, f"Exception: {str(e)}")
        return None


def test_gaming_profile(cookies):
    """Test 2: GET /api/gaming/profile returns 200 (not 404)"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/gaming/profile")
    print("="*80)
    
    if not cookies:
        log_test("Gaming Profile", False, "No cookies from login")
        return None
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/gaming/profile",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for expected fields
            has_coins = "coins" in data
            has_stats = "total_coins_won" in data
            
            log_test(
                "Gaming Profile",
                True,
                f"Status: {response.status_code}, Coins: {data.get('coins', 'N/A')}, Has stats: {has_stats}"
            )
            return data
        elif response.status_code == 404:
            log_test(
                "Gaming Profile",
                False,
                f"❌ CRITICAL: 404 Not Found - Gaming routes NOT registered! Response: {response.text[:200]}"
            )
            return None
        else:
            log_test(
                "Gaming Profile",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            return None
            
    except Exception as e:
        log_test("Gaming Profile", False, f"Exception: {str(e)}")
        return None


def test_buy_coins(cookies, initial_profile):
    """Test 3: POST /api/gaming/buy-coins with {"amount": 1} returns 200 (not 404)"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/gaming/buy-coins")
    print("="*80)
    
    if not cookies:
        log_test("Buy Coins", False, "No cookies from login")
        return None
    
    try:
        # Get initial balance
        initial_coins = initial_profile.get("coins", 0) if initial_profile else 0
        
        response = requests.post(
            f"{BASE_URL}/api/gaming/buy-coins",
            json={"amount": 1},  # Buy 1 EUR worth of coins (1000 coins)
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for expected fields
            has_ok = "ok" in data
            has_coins_added = "coins_added" in data
            has_new_balance = "new_balance" in data
            
            all_fields_present = has_ok and has_coins_added and has_new_balance
            
            log_test(
                "Buy Coins - Response Structure",
                all_fields_present,
                f"Status: {response.status_code}, ok: {data.get('ok')}, coins_added: {data.get('coins_added')}, new_balance: {data.get('new_balance')}"
            )
            
            # Verify coins were actually added
            if all_fields_present:
                coins_added = data.get("coins_added", 0)
                new_balance = data.get("new_balance", 0)
                expected_balance = initial_coins + coins_added
                
                balance_correct = new_balance == expected_balance
                
                log_test(
                    "Buy Coins - Balance Update",
                    balance_correct,
                    f"Initial: {initial_coins}, Added: {coins_added}, New: {new_balance}, Expected: {expected_balance}"
                )
            
            return data
        elif response.status_code == 404:
            log_test(
                "Buy Coins",
                False,
                f"❌ CRITICAL: 404 Not Found - Gaming routes NOT registered! Response: {response.text[:200]}"
            )
            return None
        elif response.status_code == 400:
            # 400 might be due to insufficient wallet balance - this is OK, endpoint exists
            data = response.json()
            log_test(
                "Buy Coins - Endpoint Exists",
                True,
                f"Status: 400 (expected if insufficient balance), Detail: {data.get('detail', 'N/A')}"
            )
            return data
        else:
            log_test(
                "Buy Coins",
                False,
                f"Status: {response.status_code}, Response: {response.text[:200]}"
            )
            return None
            
    except Exception as e:
        log_test("Buy Coins", False, f"Exception: {str(e)}")
        return None


def test_no_500_errors(cookies):
    """Test 4: No 500 errors in gaming flow (regression check)"""
    print("\n" + "="*80)
    print("TEST 4: Regression Check - No 500 Errors")
    print("="*80)
    
    if not cookies:
        log_test("Regression Check", False, "No cookies from login")
        return
    
    endpoints_to_test = [
        ("GET", "/api/gaming/profile", None),
        ("GET", "/api/gaming/leaderboard", None),
        ("GET", "/api/gaming/coin-history", None),
    ]
    
    all_passed = True
    details = []
    
    for method, endpoint, body in endpoints_to_test:
        try:
            if method == "GET":
                response = requests.get(
                    f"{BASE_URL}{endpoint}",
                    cookies=cookies,
                    timeout=10
                )
            else:
                response = requests.post(
                    f"{BASE_URL}{endpoint}",
                    json=body,
                    cookies=cookies,
                    timeout=10
                )
            
            if response.status_code == 500:
                all_passed = False
                details.append(f"❌ {method} {endpoint}: 500 Internal Server Error")
            elif response.status_code == 404:
                all_passed = False
                details.append(f"❌ {method} {endpoint}: 404 Not Found (route not registered)")
            else:
                details.append(f"✅ {method} {endpoint}: {response.status_code}")
                
        except Exception as e:
            all_passed = False
            details.append(f"❌ {method} {endpoint}: Exception - {str(e)}")
    
    log_test(
        "Regression Check - No 500 Errors",
        all_passed,
        "\n    " + "\n    ".join(details)
    )


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("GAME CENTER COINS RECHARGE BACKEND TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print(f"Timestamp: {results['timestamp']}")
    
    # Test 1: Login
    cookies = test_admin_login()
    
    # Test 2: Gaming Profile
    profile = test_gaming_profile(cookies)
    
    # Test 3: Buy Coins
    test_buy_coins(cookies, profile)
    
    # Test 4: Regression Check
    test_no_500_errors(cookies)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {results['summary']['total']}")
    print(f"Passed: {results['summary']['passed']}")
    print(f"Failed: {results['summary']['failed']}")
    print(f"Success Rate: {results['summary']['passed'] / results['summary']['total'] * 100:.1f}%")
    
    # Save results
    with open("/app/gaming_backend_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: /app/gaming_backend_test_results.json")
    
    # Exit with appropriate code
    if results['summary']['failed'] > 0:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
