#!/usr/bin/env python3
"""
BidBlitz Taxi Tariff Zones P1 Backend Testing
==============================================
Tests against: https://swipe-match-chat-8.preview.emergentagent.com

Test Coverage:
1. Backend runs without dead imports (taxi_operator/taxi_driver)
2. GET /api/taxi/tariff-zones returns active zones
3. Admin login with admin@bidblitz.com / BidBlitz2026!
4. POST /api/taxi/admin/tariff-zones creates a zone
5. DELETE /api/taxi/admin/tariff-zones/{id} deactivates it
6. Admin endpoints are protected without auth
"""

import requests
import json
from datetime import datetime

# Test Configuration
BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test Results Storage
test_results = {
    "test_suite": "Taxi Tariff Zones P1",
    "base_url": BASE_URL,
    "timestamp": datetime.utcnow().isoformat(),
    "tests": []
}

def log_test(test_name, passed, details):
    """Log test result"""
    result = {
        "test": test_name,
        "passed": passed,
        "details": details,
        "timestamp": datetime.utcnow().isoformat()
    }
    test_results["tests"].append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    return passed

def test_1_backend_no_dead_imports():
    """Test 1: Backend runs without dead imports for taxi_operator/taxi_driver"""
    try:
        # Check if backend is responding by testing a known working endpoint
        # If backend had dead imports, it wouldn't start and this would fail
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        
        if response.status_code == 200:
            return log_test(
                "Backend No Dead Imports",
                True,
                f"Backend is running and responding (status {response.status_code}). No dead imports (taxi_operator/taxi_driver) blocking startup. Backend successfully registered all routers."
            )
        else:
            return log_test(
                "Backend No Dead Imports",
                False,
                f"Backend returned unexpected status: {response.status_code}"
            )
    except Exception as e:
        return log_test(
            "Backend No Dead Imports",
            False,
            f"Backend not responding: {str(e)}"
        )

def test_2_get_tariff_zones_public():
    """Test 2: GET /api/taxi/tariff-zones returns active zones (public endpoint)"""
    try:
        response = requests.get(f"{BASE_URL}/api/taxi/tariff-zones", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "items" in data:
                return log_test(
                    "GET /api/taxi/tariff-zones (Public)",
                    True,
                    f"Endpoint working. Returned {len(data['items'])} active zones. Response: {json.dumps(data, indent=2)}"
                )
            else:
                return log_test(
                    "GET /api/taxi/tariff-zones (Public)",
                    False,
                    f"Response missing 'items' field. Got: {data}"
                )
        else:
            return log_test(
                "GET /api/taxi/tariff-zones (Public)",
                False,
                f"Unexpected status {response.status_code}. Response: {response.text}"
            )
    except Exception as e:
        return log_test(
            "GET /api/taxi/tariff-zones (Public)",
            False,
            f"Request failed: {str(e)}"
        )

def test_3_admin_login():
    """Test 3: Admin login with admin@bidblitz.com / BidBlitz2026!"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            cookies = response.cookies
            if "access_token" in cookies or "session" in cookies or "admin_session" in cookies:
                return log_test(
                    "Admin Login",
                    True,
                    f"Admin login successful. Cookies: {list(cookies.keys())}"
                ), cookies
            else:
                return log_test(
                    "Admin Login",
                    False,
                    f"Login returned 200 but no session cookie. Cookies: {list(cookies.keys())}"
                ), None
        else:
            return log_test(
                "Admin Login",
                False,
                f"Login failed with status {response.status_code}. Response: {response.text}"
            ), None
    except Exception as e:
        return log_test(
            "Admin Login",
            False,
            f"Login request failed: {str(e)}"
        ), None

def test_4_create_tariff_zone(cookies):
    """Test 4: POST /api/taxi/admin/tariff-zones creates a zone"""
    if not cookies:
        return log_test(
            "POST /api/taxi/admin/tariff-zones (Create Zone)",
            False,
            "Skipped - no admin session cookie from login"
        ), None
    
    try:
        # Create a test tariff zone
        zone_data = {
            "name": "Test Zone Berlin Mitte",
            "center_lat": 52.5200,
            "center_lng": 13.4050,
            "radius_km": 10.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        
        response = requests.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=zone_data,
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "zone" in data:
                zone_id = data["zone"].get("id")
                return log_test(
                    "POST /api/taxi/admin/tariff-zones (Create Zone)",
                    True,
                    f"Zone created successfully. ID: {zone_id}. Zone data: {json.dumps(data['zone'], indent=2)}"
                ), zone_id
            else:
                return log_test(
                    "POST /api/taxi/admin/tariff-zones (Create Zone)",
                    False,
                    f"Response missing success/zone fields. Got: {data}"
                ), None
        else:
            return log_test(
                "POST /api/taxi/admin/tariff-zones (Create Zone)",
                False,
                f"Create failed with status {response.status_code}. Response: {response.text}"
            ), None
    except Exception as e:
        return log_test(
            "POST /api/taxi/admin/tariff-zones (Create Zone)",
            False,
            f"Request failed: {str(e)}"
        ), None

def test_5_delete_tariff_zone(cookies, zone_id):
    """Test 5: DELETE /api/taxi/admin/tariff-zones/{id} deactivates zone"""
    if not cookies:
        return log_test(
            "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
            False,
            "Skipped - no admin session cookie"
        )
    
    if not zone_id:
        return log_test(
            "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
            False,
            "Skipped - no zone_id from create test"
        )
    
    try:
        response = requests.delete(
            f"{BASE_URL}/api/taxi/admin/tariff-zones/{zone_id}",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                return log_test(
                    "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
                    True,
                    f"Zone {zone_id} deactivated successfully. Response: {data}"
                )
            else:
                return log_test(
                    "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
                    False,
                    f"Response missing success field. Got: {data}"
                )
        else:
            return log_test(
                "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
                False,
                f"Delete failed with status {response.status_code}. Response: {response.text}"
            )
    except Exception as e:
        return log_test(
            "DELETE /api/taxi/admin/tariff-zones/{id} (Deactivate)",
            False,
            f"Request failed: {str(e)}"
        )

def test_6_admin_endpoints_protected():
    """Test 6: Admin endpoints are protected without auth"""
    try:
        # Try to create zone without auth
        zone_data = {
            "name": "Unauthorized Test",
            "center_lat": 52.5200,
            "center_lng": 13.4050,
            "radius_km": 10.0,
            "base_fare": 3.50,
            "per_km": 1.80,
            "per_min": 0.30,
            "night_multiplier": 1.20,
            "weekend_multiplier": 1.15
        }
        
        response = requests.post(
            f"{BASE_URL}/api/taxi/admin/tariff-zones",
            json=zone_data,
            timeout=10
        )
        
        # Should return 401 or 403
        if response.status_code in [401, 403]:
            return log_test(
                "Admin Endpoints Protected (No Auth)",
                True,
                f"Correctly rejected unauthorized request with status {response.status_code}"
            )
        else:
            return log_test(
                "Admin Endpoints Protected (No Auth)",
                False,
                f"Endpoint not properly protected. Status: {response.status_code}, Response: {response.text}"
            )
    except Exception as e:
        return log_test(
            "Admin Endpoints Protected (No Auth)",
            False,
            f"Request failed: {str(e)}"
        )

def run_all_tests():
    """Run all tests in sequence"""
    print("=" * 80)
    print("BidBlitz Taxi Tariff Zones P1 Backend Testing")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Started: {datetime.utcnow().isoformat()}")
    print("=" * 80)
    
    # Test 1: Backend no dead imports
    test_1_backend_no_dead_imports()
    
    # Test 2: Public tariff zones endpoint
    test_2_get_tariff_zones_public()
    
    # Test 3: Admin login
    login_passed, cookies = test_3_admin_login()
    
    # Test 4: Create tariff zone
    create_passed, zone_id = test_4_create_tariff_zone(cookies)
    
    # Test 5: Delete tariff zone
    test_5_delete_tariff_zone(cookies, zone_id)
    
    # Test 6: Admin endpoints protected
    test_6_admin_endpoints_protected()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for t in test_results["tests"] if t["passed"])
    total = len(test_results["tests"])
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    print("\nTest Results:")
    for i, test in enumerate(test_results["tests"], 1):
        status = "✅" if test["passed"] else "❌"
        print(f"{i}. {status} {test['test']}")
    
    # Save results to file
    output_file = "/app/taxi_tariff_zones_p1_test_results.json"
    with open(output_file, "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\nDetailed results saved to: {output_file}")
    print("=" * 80)
    
    return passed, total

if __name__ == "__main__":
    passed, total = run_all_tests()
    exit(0 if passed == total else 1)
