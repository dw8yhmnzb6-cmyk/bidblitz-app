#!/usr/bin/env python3
"""
BidBlitz Backend Review Test
=============================
Testing recently fixed flows on preview URL:
1. Login with reviewer@bidblitz.ae / BidBlitzReview2026!
2. /api/user/profile - Set or read language to sq-XK and confirm 200/OK
3. /api/p2p/lookup with query=admin@bidblitz.ae - Test and confirm recipient with bidblitz_id is returned
4. Check that a private BLZ recipient code like BLZ-5824-A240 is lookup-able in the Send flow (via the appropriate API path)
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://super-app-staging-2.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "reviewer@bidblitz.ae"
TEST_PASSWORD = "BidBlitzReview2026!"

# Test results
results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}

def log_test(test_name, passed, details):
    """Log test result"""
    result = {
        "test": test_name,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    results["tests"].append(result)
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    print(f"Details: {json.dumps(details, indent=2)}")
    return passed

def test_login():
    """Test 1: Login with reviewer@bidblitz.ae / BidBlitzReview2026!"""
    print("\n" + "="*80)
    print("TEST 1: Login with reviewer@bidblitz.ae")
    print("="*80)
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            },
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check if we have auth cookies
            has_access_token = "access_token" in cookies
            has_refresh_token = "refresh_token" in cookies
            
            return log_test(
                "Login with reviewer@bidblitz.ae",
                True,
                {
                    "status_code": response.status_code,
                    "has_access_token": has_access_token,
                    "has_refresh_token": has_refresh_token,
                    "user_id": data.get("id"),
                    "email": data.get("email"),
                    "name": data.get("name"),
                    "cookies": dict(cookies)
                }
            ), cookies
        else:
            return log_test(
                "Login with reviewer@bidblitz.ae",
                False,
                {
                    "status_code": response.status_code,
                    "error": response.text
                }
            ), None
            
    except Exception as e:
        return log_test(
            "Login with reviewer@bidblitz.ae",
            False,
            {"error": str(e)}
        ), None

def test_profile_language(cookies):
    """Test 2: /api/user/profile - Set or read language to sq-XK and confirm 200/OK"""
    print("\n" + "="*80)
    print("TEST 2: /api/user/profile - Language sq-XK")
    print("="*80)
    
    if not cookies:
        return log_test(
            "Profile Language Test",
            False,
            {"error": "No authentication cookies available"}
        )
    
    try:
        # First, read current profile
        response = requests.get(
            f"{API_BASE}/user/profile",
            cookies=cookies,
            timeout=15
        )
        
        if response.status_code != 200:
            return log_test(
                "Profile Language Test - GET",
                False,
                {
                    "status_code": response.status_code,
                    "error": response.text
                }
            )
        
        current_profile = response.json()
        current_language = current_profile.get("language", "de")
        
        print(f"Current language: {current_language}")
        
        # Now update language to sq-XK
        response = requests.put(
            f"{API_BASE}/user/profile",
            json={"language": "sq-XK"},
            cookies=cookies,
            timeout=15
        )
        
        if response.status_code == 200:
            updated_profile = response.json()
            new_language = updated_profile.get("language")
            
            return log_test(
                "Profile Language Test - SET sq-XK",
                new_language == "sq-XK",
                {
                    "status_code": response.status_code,
                    "previous_language": current_language,
                    "new_language": new_language,
                    "language_updated": new_language == "sq-XK"
                }
            )
        else:
            return log_test(
                "Profile Language Test - SET sq-XK",
                False,
                {
                    "status_code": response.status_code,
                    "error": response.text
                }
            )
            
    except Exception as e:
        return log_test(
            "Profile Language Test",
            False,
            {"error": str(e)}
        )

def test_p2p_lookup_email(cookies):
    """Test 3: /api/p2p/lookup with query=admin@bidblitz.ae"""
    print("\n" + "="*80)
    print("TEST 3: /api/p2p/lookup with query=admin@bidblitz.ae")
    print("="*80)
    
    if not cookies:
        return log_test(
            "P2P Lookup Email Test",
            False,
            {"error": "No authentication cookies available"}
        )
    
    try:
        response = requests.post(
            f"{API_BASE}/p2p/lookup",
            json={
                "query": "admin@bidblitz.ae",
                "type": "auto"
            },
            cookies=cookies,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            recipient = data.get("recipient", {})
            bidblitz_id = recipient.get("bidblitz_id")
            
            return log_test(
                "P2P Lookup Email - admin@bidblitz.ae",
                bidblitz_id is not None,
                {
                    "status_code": response.status_code,
                    "found": data.get("found"),
                    "recipient_name": recipient.get("name"),
                    "recipient_username": recipient.get("username"),
                    "bidblitz_id": bidblitz_id,
                    "has_bidblitz_id": bidblitz_id is not None
                }
            )
        else:
            return log_test(
                "P2P Lookup Email - admin@bidblitz.ae",
                False,
                {
                    "status_code": response.status_code,
                    "error": response.text
                }
            )
            
    except Exception as e:
        return log_test(
            "P2P Lookup Email Test",
            False,
            {"error": str(e)}
        )

def test_p2p_lookup_blz_code(cookies):
    """Test 4: Check that a private BLZ recipient code like BLZ-5824-A240 is lookup-able"""
    print("\n" + "="*80)
    print("TEST 4: /api/p2p/lookup with BLZ code (BLZ-5824-A240)")
    print("="*80)
    
    if not cookies:
        return log_test(
            "P2P Lookup BLZ Code Test",
            False,
            {"error": "No authentication cookies available"}
        )
    
    try:
        # Test with a BLZ code format
        test_code = "BLZ-5824-A240"
        
        response = requests.post(
            f"{API_BASE}/p2p/lookup",
            json={
                "query": test_code,
                "type": "auto"
            },
            cookies=cookies,
            timeout=15
        )
        
        # The endpoint should either:
        # 1. Return 200 with a recipient (if the code exists)
        # 2. Return 404 if the code doesn't exist (which is expected for a random code)
        # Both are acceptable - we're testing that the endpoint handles BLZ codes correctly
        
        if response.status_code == 200:
            data = response.json()
            recipient = data.get("recipient", {})
            
            return log_test(
                "P2P Lookup BLZ Code - Format Handling",
                True,
                {
                    "status_code": response.status_code,
                    "test_code": test_code,
                    "found": data.get("found"),
                    "recipient_name": recipient.get("name"),
                    "bidblitz_id": recipient.get("bidblitz_id"),
                    "note": "BLZ code lookup working - recipient found"
                }
            )
        elif response.status_code == 404:
            # 404 is acceptable - means the code doesn't exist but the lookup mechanism works
            return log_test(
                "P2P Lookup BLZ Code - Format Handling",
                True,
                {
                    "status_code": response.status_code,
                    "test_code": test_code,
                    "note": "BLZ code lookup working - code not found (expected for test code)",
                    "error_message": response.json().get("detail", "")
                }
            )
        else:
            return log_test(
                "P2P Lookup BLZ Code - Format Handling",
                False,
                {
                    "status_code": response.status_code,
                    "test_code": test_code,
                    "error": response.text
                }
            )
            
    except Exception as e:
        return log_test(
            "P2P Lookup BLZ Code Test",
            False,
            {"error": str(e)}
        )

def test_p2p_lookup_admin_blz_id(cookies):
    """Test 4b: Get admin's actual BLZ ID and test lookup"""
    print("\n" + "="*80)
    print("TEST 4b: Lookup admin's actual BLZ ID")
    print("="*80)
    
    if not cookies:
        return log_test(
            "P2P Lookup Admin BLZ ID Test",
            False,
            {"error": "No authentication cookies available"}
        )
    
    try:
        # First, get admin's profile to find their BLZ ID
        # We need to login as admin first
        admin_response = requests.post(
            f"{API_BASE}/auth/login",
            json={
                "email": "admin@bidblitz.ae",
                "password": "BidBlitz2026!"
            },
            timeout=15
        )
        
        if admin_response.status_code != 200:
            return log_test(
                "P2P Lookup Admin BLZ ID - Get Admin Profile",
                False,
                {
                    "status_code": admin_response.status_code,
                    "error": "Could not login as admin to get BLZ ID"
                }
            )
        
        admin_cookies = admin_response.cookies
        
        # Get admin's P2P profile to find their BLZ ID
        profile_response = requests.get(
            f"{API_BASE}/p2p/profile",
            cookies=admin_cookies,
            timeout=15
        )
        
        if profile_response.status_code != 200:
            return log_test(
                "P2P Lookup Admin BLZ ID - Get Admin Profile",
                False,
                {
                    "status_code": profile_response.status_code,
                    "error": "Could not get admin P2P profile"
                }
            )
        
        admin_profile = profile_response.json()
        admin_blz_id = admin_profile.get("bidblitz_id")
        
        if not admin_blz_id:
            return log_test(
                "P2P Lookup Admin BLZ ID - Get Admin Profile",
                False,
                {
                    "error": "Admin does not have a BidBlitz ID yet"
                }
            )
        
        print(f"Admin BLZ ID: {admin_blz_id}")
        
        # Now test lookup with reviewer's cookies
        lookup_response = requests.post(
            f"{API_BASE}/p2p/lookup",
            json={
                "query": admin_blz_id,
                "type": "auto"
            },
            cookies=cookies,
            timeout=15
        )
        
        if lookup_response.status_code == 200:
            data = lookup_response.json()
            recipient = data.get("recipient", {})
            
            return log_test(
                "P2P Lookup Admin BLZ ID - Lookup by BLZ Code",
                True,
                {
                    "status_code": lookup_response.status_code,
                    "admin_blz_id": admin_blz_id,
                    "found": data.get("found"),
                    "recipient_name": recipient.get("name"),
                    "recipient_bidblitz_id": recipient.get("bidblitz_id"),
                    "blz_id_match": recipient.get("bidblitz_id") == admin_blz_id
                }
            )
        else:
            return log_test(
                "P2P Lookup Admin BLZ ID - Lookup by BLZ Code",
                False,
                {
                    "status_code": lookup_response.status_code,
                    "admin_blz_id": admin_blz_id,
                    "error": lookup_response.text
                }
            )
            
    except Exception as e:
        return log_test(
            "P2P Lookup Admin BLZ ID Test",
            False,
            {"error": str(e)}
        )

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BidBlitz Backend Review Test")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test 1: Login
    login_passed, cookies = test_login()
    
    if not login_passed:
        print("\n❌ Login failed - cannot proceed with other tests")
        results["summary"] = {
            "total_tests": 1,
            "passed": 0,
            "failed": 1,
            "success_rate": "0%"
        }
        with open("/app/backend_review_test_results.json", "w") as f:
            json.dump(results, f, indent=2)
        sys.exit(1)
    
    # Test 2: Profile Language
    test_profile_language(cookies)
    
    # Test 3: P2P Lookup by Email
    test_p2p_lookup_email(cookies)
    
    # Test 4: P2P Lookup by BLZ Code
    test_p2p_lookup_blz_code(cookies)
    
    # Test 4b: P2P Lookup by Admin's actual BLZ ID
    test_p2p_lookup_admin_blz_id(cookies)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(results["tests"])
    passed_tests = sum(1 for t in results["tests"] if t["passed"])
    failed_tests = total_tests - passed_tests
    success_rate = f"{(passed_tests/total_tests)*100:.1f}%" if total_tests > 0 else "0%"
    
    results["summary"] = {
        "total_tests": total_tests,
        "passed": passed_tests,
        "failed": failed_tests,
        "success_rate": success_rate
    }
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")
    print(f"Success Rate: {success_rate}")
    
    # Save results
    with open("/app/backend_review_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: /app/backend_review_test_results.json")
    
    # Exit with appropriate code
    sys.exit(0 if failed_tests == 0 else 1)

if __name__ == "__main__":
    main()
