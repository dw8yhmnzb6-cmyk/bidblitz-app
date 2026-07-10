#!/usr/bin/env python3
"""
Backend Test: Move & Earn Admin Analytics - New Contracts
Tests the new Move-&-Earn Admin-Analytics-Backend contracts against the external Preview-API.

Test Focus:
1. POST /api/auth/login
2. GET /api/admin/move/stats with Session-Cookie

Expected NEW fields/contracts:
- summary: dau, wau, mau, retention_30_pct, repeat_rate_90_pct, roi_value_index_30, roi_per_eur_30, cost_per_mau_30, cost_per_dau_30
- growth: dau, wau, mau, retention_30_pct, repeat_rate_90_pct, active_users_7d, active_users_30d
- roi: window_days, reward_cost_eur, merchant_events, qr_events, ride_xp, eco_xp, value_index, value_per_eur, cost_per_mau, cost_per_dau
- reward_cost_breakdown: by_type, by_source, by_segment
- trend_14d: array

Admin Credentials: admin@bidblitz.ae / BidBlitz2026!
Backend URL: https://swipe-match-chat-8.preview.emergentagent.com
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = {
    "test_date": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "admin_email": ADMIN_EMAIL,
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
    test_results["tests"].append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    return passed

def test_admin_login():
    """Test 1: POST /api/auth/login"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/auth/login")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            },
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            cookies = response.cookies
            
            # Check if we got auth cookies
            has_access_token = 'access_token' in cookies
            has_refresh_token = 'refresh_token' in cookies
            
            details = {
                "status_code": response.status_code,
                "has_access_token": has_access_token,
                "has_refresh_token": has_refresh_token,
                "user_email": data.get("email"),
                "user_role": data.get("role")
            }
            
            print(f"User Email: {data.get('email')}")
            print(f"User Role: {data.get('role')}")
            print(f"Access Token Cookie: {has_access_token}")
            print(f"Refresh Token Cookie: {has_refresh_token}")
            
            passed = has_access_token and data.get("role") == "admin"
            return log_test("Admin Login", passed, details), cookies
        else:
            details = {
                "status_code": response.status_code,
                "error": response.text[:500]
            }
            return log_test("Admin Login", False, details), None
            
    except Exception as e:
        details = {"error": str(e)}
        return log_test("Admin Login", False, details), None

def test_admin_move_stats(cookies):
    """Test 2: GET /api/admin/move/stats - Verify NEW contracts"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/admin/move/stats - NEW Contracts Verification")
    print("="*80)
    
    if not cookies:
        return log_test("Admin Move Stats - NEW Contracts", False, {"error": "No auth cookies from login"})
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/move/stats",
            cookies=cookies,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            details = {
                "status_code": response.status_code,
                "error": response.text[:500]
            }
            return log_test("Admin Move Stats - NEW Contracts", False, details)
        
        data = response.json()
        
        # Verify NEW fields in summary
        summary = data.get("summary", {})
        summary_new_fields = {
            "dau": summary.get("dau"),
            "wau": summary.get("wau"),
            "mau": summary.get("mau"),
            "retention_30_pct": summary.get("retention_30_pct"),
            "repeat_rate_90_pct": summary.get("repeat_rate_90_pct"),
            "roi_value_index_30": summary.get("roi_value_index_30"),
            "roi_per_eur_30": summary.get("roi_per_eur_30"),
            "cost_per_mau_30": summary.get("cost_per_mau_30"),
            "cost_per_dau_30": summary.get("cost_per_dau_30")
        }
        
        # Verify growth object
        growth = data.get("growth", {})
        growth_fields = {
            "dau": growth.get("dau"),
            "wau": growth.get("wau"),
            "mau": growth.get("mau"),
            "retention_30_pct": growth.get("retention_30_pct"),
            "repeat_rate_90_pct": growth.get("repeat_rate_90_pct"),
            "active_users_7d": growth.get("active_users_7d"),
            "active_users_30d": growth.get("active_users_30d")
        }
        
        # Verify roi object
        roi = data.get("roi", {})
        roi_fields = {
            "window_days": roi.get("window_days"),
            "reward_cost_eur": roi.get("reward_cost_eur"),
            "merchant_events": roi.get("merchant_events"),
            "qr_events": roi.get("qr_events"),
            "ride_xp": roi.get("ride_xp"),
            "eco_xp": roi.get("eco_xp"),
            "value_index": roi.get("value_index"),
            "value_per_eur": roi.get("value_per_eur"),
            "cost_per_mau": roi.get("cost_per_mau"),
            "cost_per_dau": roi.get("cost_per_dau")
        }
        
        # Verify reward_cost_breakdown
        reward_cost_breakdown = data.get("reward_cost_breakdown", {})
        breakdown_fields = {
            "by_type": reward_cost_breakdown.get("by_type"),
            "by_source": reward_cost_breakdown.get("by_source"),
            "by_segment": reward_cost_breakdown.get("by_segment")
        }
        
        # Verify trend_14d
        trend_14d = data.get("trend_14d", [])
        
        # Check which fields are present
        summary_missing = [k for k, v in summary_new_fields.items() if v is None]
        growth_missing = [k for k, v in growth_fields.items() if v is None]
        roi_missing = [k for k, v in roi_fields.items() if v is None]
        breakdown_missing = [k for k, v in breakdown_fields.items() if v is None or (isinstance(v, list) and len(v) == 0)]
        
        # Print detailed results
        print("\n--- SUMMARY NEW FIELDS ---")
        for field, value in summary_new_fields.items():
            status = "✓" if value is not None else "✗"
            print(f"{status} {field}: {value}")
        
        print("\n--- GROWTH OBJECT ---")
        for field, value in growth_fields.items():
            status = "✓" if value is not None else "✗"
            print(f"{status} {field}: {value}")
        
        print("\n--- ROI OBJECT ---")
        for field, value in roi_fields.items():
            status = "✓" if value is not None else "✗"
            print(f"{status} {field}: {value}")
        
        print("\n--- REWARD COST BREAKDOWN ---")
        for field, value in breakdown_fields.items():
            if isinstance(value, list):
                status = "✓" if len(value) > 0 else "✗"
                print(f"{status} {field}: {len(value)} items")
                if len(value) > 0:
                    print(f"  Sample: {value[0]}")
            else:
                status = "✗"
                print(f"{status} {field}: None")
        
        print("\n--- TREND 14D ---")
        if isinstance(trend_14d, list):
            print(f"✓ trend_14d: {len(trend_14d)} items")
            if len(trend_14d) > 0:
                print(f"  Sample: {trend_14d[0]}")
        else:
            print(f"✗ trend_14d: Not an array")
        
        # Determine if test passed
        all_summary_present = len(summary_missing) == 0
        all_growth_present = len(growth_missing) == 0
        all_roi_present = len(roi_missing) == 0
        all_breakdown_present = len(breakdown_missing) == 0
        trend_present = isinstance(trend_14d, list)
        
        passed = all_summary_present and all_growth_present and all_roi_present and all_breakdown_present and trend_present
        
        details = {
            "status_code": response.status_code,
            "summary_new_fields": summary_new_fields,
            "summary_missing_fields": summary_missing,
            "growth_fields": growth_fields,
            "growth_missing_fields": growth_missing,
            "roi_fields": roi_fields,
            "roi_missing_fields": roi_missing,
            "reward_cost_breakdown": {
                "by_type_count": len(breakdown_fields["by_type"]) if isinstance(breakdown_fields["by_type"], list) else 0,
                "by_source_count": len(breakdown_fields["by_source"]) if isinstance(breakdown_fields["by_source"], list) else 0,
                "by_segment_count": len(breakdown_fields["by_segment"]) if isinstance(breakdown_fields["by_segment"], list) else 0
            },
            "breakdown_missing_fields": breakdown_missing,
            "trend_14d_count": len(trend_14d) if isinstance(trend_14d, list) else 0,
            "all_summary_present": all_summary_present,
            "all_growth_present": all_growth_present,
            "all_roi_present": all_roi_present,
            "all_breakdown_present": all_breakdown_present,
            "trend_present": trend_present
        }
        
        return log_test("Admin Move Stats - NEW Contracts", passed, details)
        
    except Exception as e:
        details = {"error": str(e)}
        return log_test("Admin Move Stats - NEW Contracts", False, details)

def test_no_500_errors(cookies):
    """Test 3: Verify no 500 errors on admin move stats endpoint"""
    print("\n" + "="*80)
    print("TEST 3: No 500 Errors")
    print("="*80)
    
    if not cookies:
        return log_test("No 500 Errors", False, {"error": "No auth cookies from login"})
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/move/stats",
            cookies=cookies,
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        passed = response.status_code != 500
        details = {
            "status_code": response.status_code,
            "no_500_error": passed
        }
        
        return log_test("No 500 Errors", passed, details)
        
    except Exception as e:
        details = {"error": str(e)}
        return log_test("No 500 Errors", False, details)

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("MOVE & EARN ADMIN ANALYTICS - BACKEND CONTRACT TESTING")
    print("Testing NEW fields/contracts in GET /api/admin/move/stats")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_EMAIL}")
    print(f"Test Date: {datetime.now().isoformat()}")
    
    # Run tests
    test1_passed, cookies = test_admin_login()
    test2_passed = test_admin_move_stats(cookies)
    test3_passed = test_no_500_errors(cookies)
    
    # Summary
    total_tests = 3
    passed_tests = sum([test1_passed, test2_passed, test3_passed])
    
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    test_results["summary"] = {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": total_tests - passed_tests,
        "success_rate": f"{(passed_tests/total_tests)*100:.1f}%"
    }
    
    # Save results
    output_file = "/app/move_admin_analytics_backend_test_results.json"
    with open(output_file, "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\nTest results saved to: {output_file}")
    
    if passed_tests == total_tests:
        print("\n✅ ALL TESTS PASSED - Move & Earn Admin Analytics Backend contracts are working correctly!")
    else:
        print(f"\n⚠️ {total_tests - passed_tests} TEST(S) FAILED - Please review the details above.")

if __name__ == "__main__":
    main()
