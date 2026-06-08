#!/usr/bin/env python3
"""
BidBlitz P0 Security Smoke Test
================================
Lightweight smoke test after P0 security blocker cleanup.
Tests: API health, login flow, basic endpoints, security config verification.

Preview URL: https://taxi-uber-style.preview.emergentagent.com
Test Account: admin@bidblitz.com / BidBlitz2026!
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://taxi-uber-style.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"
TEST_EMAIL = "admin@bidblitz.com"
TEST_PASSWORD = "BidBlitz2026!"

# Test results
results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": [],
    "summary": {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    
    results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    results["summary"]["total"] += 1
    if passed:
        results["summary"]["passed"] += 1
    else:
        results["summary"]["failed"] += 1

def test_api_health():
    """Test 1: API responds"""
    try:
        response = requests.get(f"{API_URL}/diag/health/probe", timeout=10)
        if response.status_code == 200:
            log_test("API Health Check", True, f"Status: {response.status_code}")
            return True
        else:
            log_test("API Health Check", False, f"Unexpected status: {response.status_code}")
            return False
    except Exception as e:
        log_test("API Health Check", False, f"Error: {str(e)}")
        return False

def test_login_flow():
    """Test 2: Login flow works"""
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check for access_token cookie
            if 'access_token' in cookies:
                log_test("Login Flow", True, f"Login successful, user: {data.get('user', {}).get('email', 'N/A')}")
                return cookies
            else:
                log_test("Login Flow", False, "No access_token cookie in response")
                return None
        else:
            log_test("Login Flow", False, f"Login failed with status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        log_test("Login Flow", False, f"Error: {str(e)}")
        return None

def test_auth_me(cookies):
    """Test 3: Auth/me endpoint works with session"""
    if not cookies:
        log_test("Auth Me Endpoint", False, "No cookies available (login failed)")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/auth/me",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            user_email = data.get('email', 'N/A')
            user_role = data.get('role', 'N/A')
            log_test("Auth Me Endpoint", True, f"User: {user_email}, Role: {user_role}")
            return True
        else:
            log_test("Auth Me Endpoint", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Auth Me Endpoint", False, f"Error: {str(e)}")
        return False

def test_critical_endpoints(cookies):
    """Test 4: Critical endpoints respond (no 500 errors)"""
    endpoints = [
        "/auctions/active",
        "/wallet/balance",
        "/admin/overview"
    ]
    
    all_passed = True
    for endpoint in endpoints:
        try:
            response = requests.get(
                f"{API_URL}{endpoint}",
                cookies=cookies if cookies else {},
                timeout=10
            )
            
            # Accept any status except 500 (internal server error)
            if response.status_code != 500:
                log_test(f"Endpoint {endpoint}", True, f"Status: {response.status_code}")
            else:
                log_test(f"Endpoint {endpoint}", False, f"Internal Server Error (500)")
                all_passed = False
        except Exception as e:
            log_test(f"Endpoint {endpoint}", False, f"Error: {str(e)}")
            all_passed = False
    
    return all_passed

def verify_security_config():
    """Test 5: Verify security configuration"""
    print("\n🔒 Security Configuration Verification:")
    
    # Check iOS Info.plist
    try:
        with open("/app/frontend/ios/App/App/Info.plist", "r") as f:
            content = f.read()
            if "NSAllowsArbitraryLoads" in content and "<false/>" in content:
                log_test("iOS NSAllowsArbitraryLoads=false", True, "ATS properly configured")
            else:
                log_test("iOS NSAllowsArbitraryLoads=false", False, "ATS not properly configured")
    except Exception as e:
        log_test("iOS NSAllowsArbitraryLoads=false", False, f"Error reading Info.plist: {str(e)}")
    
    # Check Android keystore is removed
    import os
    import glob
    
    keystore_files = glob.glob("/app/**/bidblitz-upload.jks", recursive=True)
    if len(keystore_files) == 0:
        log_test("Android keystore removed", True, "bidblitz-upload.jks not found in repo")
    else:
        log_test("Android keystore removed", False, f"Found keystore files: {keystore_files}")

def main():
    print("=" * 70)
    print("BidBlitz P0 Security Smoke Test")
    print("=" * 70)
    print(f"Preview URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print(f"Timestamp: {results['timestamp']}")
    print("=" * 70)
    print()
    
    # Run tests
    print("🧪 Running Smoke Tests:\n")
    
    # Test 1: API Health
    test_api_health()
    
    # Test 2: Login Flow
    cookies = test_login_flow()
    
    # Test 3: Auth Me
    test_auth_me(cookies)
    
    # Test 4: Critical Endpoints
    test_critical_endpoints(cookies)
    
    # Test 5: Security Config
    verify_security_config()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 Test Summary:")
    print("=" * 70)
    print(f"Total Tests: {results['summary']['total']}")
    print(f"✅ Passed: {results['summary']['passed']}")
    print(f"❌ Failed: {results['summary']['failed']}")
    print(f"Success Rate: {(results['summary']['passed'] / results['summary']['total'] * 100):.1f}%")
    print("=" * 70)
    
    # Save results
    with open("/app/p0_security_smoke_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to: /app/p0_security_smoke_test_results.json")
    
    # Exit with appropriate code
    if results['summary']['failed'] > 0:
        print("\n⚠️  Some tests failed. Please review the results above.")
        sys.exit(1)
    else:
        print("\n✅ All smoke tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()
