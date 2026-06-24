#!/usr/bin/env python3
"""
BidBlitz Admin Auth Tracking Backend Test
Tests the new Admin-Auth-Tracking flows:
1. POST /api/auth/login - Admin login
2. GET /api/admin/wallet/users?q=admin@bidblitz.com - User search with tracking fields
3. GET /api/admin/wallet/users/{user_id}/login-history - Login history endpoint
4. Timestamp validation
5. Regression check: Admin-Wallet-User search
"""

import requests
import json
from datetime import datetime

# External preview URL
BASE_URL = "https://commerce-hub-565.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "timestamp": datetime.utcnow().isoformat(),
    "base_url": BASE_URL,
    "tests": [],
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
}

def log_test(name, passed, details):
    """Log test result"""
    results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    results["summary"]["total"] += 1
    if passed:
        results["summary"]["passed"] += 1
        print(f"✅ {name}")
    else:
        results["summary"]["failed"] += 1
        print(f"❌ {name}")
        print(f"   Details: {details}")

def validate_iso_timestamp(ts_str, field_name):
    """Validate that a timestamp is in ISO format and parseable"""
    if not ts_str:
        return False, f"{field_name} is empty or None"
    try:
        datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        return True, f"{field_name} is valid ISO timestamp: {ts_str}"
    except Exception as e:
        return False, f"{field_name} is not valid ISO timestamp: {ts_str} - Error: {str(e)}"

print("=" * 80)
print("BidBlitz Admin Auth Tracking Backend Test")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"Admin: {ADMIN_EMAIL}")
print()

# ============================================================================
# TEST 1: Admin Login (POST /api/auth/login)
# ============================================================================
print("TEST 1: Admin Login (POST /api/auth/login)")
print("-" * 80)

session = requests.Session()

try:
    login_response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        },
        timeout=10
    )
    
    if login_response.status_code == 200:
        login_data = login_response.json()
        
        # Check if cookies are set
        cookies_set = "access_token" in session.cookies and "refresh_token" in session.cookies
        
        # Check if user data is returned
        has_user_data = "email" in login_data and login_data["email"] == ADMIN_EMAIL
        
        if cookies_set and has_user_data:
            log_test(
                "Admin Login",
                True,
                f"Login successful - Status: {login_response.status_code}, Email: {login_data.get('email')}, Role: {login_data.get('role')}, Cookies set: {cookies_set}"
            )
            admin_user_data = login_data
        else:
            log_test(
                "Admin Login",
                False,
                f"Login returned 200 but missing data - Cookies: {cookies_set}, User data: {has_user_data}"
            )
            admin_user_data = None
    else:
        log_test(
            "Admin Login",
            False,
            f"Login failed - Status: {login_response.status_code}, Response: {login_response.text[:200]}"
        )
        admin_user_data = None
        
except Exception as e:
    log_test("Admin Login", False, f"Exception: {str(e)}")
    admin_user_data = None

print()

# ============================================================================
# TEST 2: GET /api/admin/wallet/users?q=admin@bidblitz.com
# ============================================================================
print("TEST 2: GET /api/admin/wallet/users?q=admin@bidblitz.com")
print("-" * 80)

admin_user_id = None

try:
    search_response = session.get(
        f"{BASE_URL}/api/admin/wallet/users",
        params={"q": ADMIN_EMAIL},
        timeout=10
    )
    
    if search_response.status_code == 200:
        search_data = search_response.json()
        users = search_data.get("users", [])
        
        if len(users) > 0:
            admin_user = users[0]
            admin_user_id = admin_user.get("user_id")
            
            # Check for required tracking fields
            has_registered_at = "registered_at" in admin_user and admin_user["registered_at"]
            has_last_login_at = "last_login_at" in admin_user
            has_login_count = "login_count" in admin_user
            
            # Validate registered_at timestamp
            registered_at_valid = False
            registered_at_msg = ""
            if has_registered_at:
                registered_at_valid, registered_at_msg = validate_iso_timestamp(
                    admin_user["registered_at"], 
                    "registered_at"
                )
            
            # Validate last_login_at timestamp (can be None initially)
            last_login_at_valid = True
            last_login_at_msg = "last_login_at is None (acceptable)"
            if admin_user.get("last_login_at"):
                last_login_at_valid, last_login_at_msg = validate_iso_timestamp(
                    admin_user["last_login_at"], 
                    "last_login_at"
                )
            
            # Check login_count is a number
            login_count_valid = isinstance(admin_user.get("login_count"), int)
            
            all_fields_present = has_registered_at and has_last_login_at and has_login_count
            all_valid = registered_at_valid and last_login_at_valid and login_count_valid
            
            if all_fields_present and all_valid:
                log_test(
                    "Admin User Search with Tracking Fields",
                    True,
                    f"Found admin user with all tracking fields - user_id: {admin_user_id}, registered_at: {admin_user.get('registered_at')}, last_login_at: {admin_user.get('last_login_at')}, login_count: {admin_user.get('login_count')}"
                )
            else:
                log_test(
                    "Admin User Search with Tracking Fields",
                    False,
                    f"Missing or invalid fields - has_registered_at: {has_registered_at}, has_last_login_at: {has_last_login_at}, has_login_count: {has_login_count}, registered_at_valid: {registered_at_valid} ({registered_at_msg}), last_login_at_valid: {last_login_at_valid} ({last_login_at_msg}), login_count_valid: {login_count_valid}"
                )
        else:
            log_test(
                "Admin User Search with Tracking Fields",
                False,
                f"No users found for query: {ADMIN_EMAIL}"
            )
    else:
        log_test(
            "Admin User Search with Tracking Fields",
            False,
            f"Search failed - Status: {search_response.status_code}, Response: {search_response.text[:200]}"
        )
        
except Exception as e:
    log_test("Admin User Search with Tracking Fields", False, f"Exception: {str(e)}")

print()

# ============================================================================
# TEST 3: GET /api/admin/wallet/users/{user_id}/login-history?limit=5
# ============================================================================
print("TEST 3: GET /api/admin/wallet/users/{user_id}/login-history?limit=5")
print("-" * 80)

if admin_user_id:
    try:
        history_response = session.get(
            f"{BASE_URL}/api/admin/wallet/users/{admin_user_id}/login-history",
            params={"limit": 5},
            timeout=10
        )
        
        if history_response.status_code == 200:
            history_data = history_response.json()
            
            # Check structure
            has_user = "user" in history_data
            has_history = "history" in history_data
            
            if has_user and has_history:
                user_info = history_data["user"]
                history_list = history_data["history"]
                
                # Validate user info has tracking fields
                user_has_registered_at = "registered_at" in user_info
                user_has_last_login_at = "last_login_at" in user_info
                user_has_login_count = "login_count" in user_info
                
                # Validate history entries
                history_valid = True
                history_details = []
                
                for idx, entry in enumerate(history_list[:5]):  # Check first 5
                    event = entry.get("event", "")
                    timestamp = entry.get("timestamp", "")
                    ip = entry.get("ip", "")
                    
                    # Validate timestamp
                    ts_valid, ts_msg = validate_iso_timestamp(timestamp, f"history[{idx}].timestamp")
                    
                    if not ts_valid:
                        history_valid = False
                        history_details.append(f"Entry {idx}: Invalid timestamp - {ts_msg}")
                    else:
                        history_details.append(f"Entry {idx}: event={event}, timestamp={timestamp}, ip={ip}")
                
                all_valid = (
                    user_has_registered_at and 
                    user_has_last_login_at and 
                    user_has_login_count and 
                    history_valid
                )
                
                if all_valid:
                    log_test(
                        "Login History Endpoint",
                        True,
                        f"Login history retrieved successfully - {len(history_list)} entries, user_id: {user_info.get('user_id')}, registered_at: {user_info.get('registered_at')}, last_login_at: {user_info.get('last_login_at')}, login_count: {user_info.get('login_count')}, History: {'; '.join(history_details[:3])}"
                    )
                else:
                    log_test(
                        "Login History Endpoint",
                        False,
                        f"Invalid data - user_has_registered_at: {user_has_registered_at}, user_has_last_login_at: {user_has_last_login_at}, user_has_login_count: {user_has_login_count}, history_valid: {history_valid}, Details: {'; '.join(history_details)}"
                    )
            else:
                log_test(
                    "Login History Endpoint",
                    False,
                    f"Missing required fields - has_user: {has_user}, has_history: {has_history}"
                )
        else:
            log_test(
                "Login History Endpoint",
                False,
                f"Request failed - Status: {history_response.status_code}, Response: {history_response.text[:200]}"
            )
            
    except Exception as e:
        log_test("Login History Endpoint", False, f"Exception: {str(e)}")
else:
    log_test("Login History Endpoint", False, "Skipped - admin_user_id not available from previous test")

print()

# ============================================================================
# TEST 4: Timestamp Validation (No 500 errors)
# ============================================================================
print("TEST 4: Timestamp Validation (No 500 errors)")
print("-" * 80)

# This test is implicit in the above tests - if we got 200 responses with valid
# ISO timestamps, then there are no 500 errors
no_500_errors = all(
    test["passed"] or "500" not in test["details"] 
    for test in results["tests"]
)

if no_500_errors:
    log_test(
        "No 500 Errors",
        True,
        "All endpoints returned proper status codes (no 500 Internal Server Errors)"
    )
else:
    log_test(
        "No 500 Errors",
        False,
        "Some endpoints returned 500 errors - check previous test details"
    )

print()

# ============================================================================
# TEST 5: Regression Check - Admin-Wallet-User Search
# ============================================================================
print("TEST 5: Regression Check - Admin-Wallet-User Search")
print("-" * 80)

try:
    # Search for a different user (or empty search to get all users)
    regression_response = session.get(
        f"{BASE_URL}/api/admin/wallet/users",
        params={"q": "", "limit": 10},
        timeout=10
    )
    
    if regression_response.status_code == 200:
        regression_data = regression_response.json()
        users = regression_data.get("users", [])
        count = regression_data.get("count", 0)
        
        # Check that we get a list of users
        if isinstance(users, list) and count >= 0:
            log_test(
                "Regression - Admin Wallet User Search",
                True,
                f"User search working correctly - Found {count} users, Response structure valid"
            )
        else:
            log_test(
                "Regression - Admin Wallet User Search",
                False,
                f"Invalid response structure - users is list: {isinstance(users, list)}, count: {count}"
            )
    else:
        log_test(
            "Regression - Admin Wallet User Search",
            False,
            f"Search failed - Status: {regression_response.status_code}, Response: {regression_response.text[:200]}"
        )
        
except Exception as e:
    log_test("Regression - Admin Wallet User Search", False, f"Exception: {str(e)}")

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {results['summary']['total']}")
print(f"Passed: {results['summary']['passed']} ✅")
print(f"Failed: {results['summary']['failed']} ❌")
print(f"Success Rate: {(results['summary']['passed'] / results['summary']['total'] * 100):.1f}%")
print()

# Save results to file
with open("/app/admin_auth_tracking_test_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("Results saved to: /app/admin_auth_tracking_test_results.json")
print()

# Exit with appropriate code
exit(0 if results['summary']['failed'] == 0 else 1)
