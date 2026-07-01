#!/usr/bin/env python3
"""
BidBlitz Mobility Backend Regression Test
Tests backend endpoints after Tracking/NFC UI improvements to ensure no regressions.

Test Focus (from German review):
1. /api/mobility-platform/booking/{booking_id} - delivers tracking data correctly
2. /api/mobility-platform/preferences - remains intact
3. /api/mobility-platform/book - remains intact
4. /api/mobility-platform/checkout/session - remains intact
5. /api/mobility-platform/checkout/status/{session_id} - remains intact
6. /api/mobility-platform/ai-recommendation - regression check
"""

import json
import requests
from datetime import datetime

# Configuration
BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "admin@bidblitz.com"
TEST_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = {
    "test_date": datetime.now().isoformat(),
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
    test_results["tests"].append(result)
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    return passed

def login():
    """Login and get session cookies"""
    print("\n" + "="*80)
    print("LOGGING IN")
    print("="*80)
    
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    
    if response.status_code == 200:
        print(f"✅ Login successful as {TEST_EMAIL}")
        return response.cookies
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_preferences_get(cookies):
    """Test 1: GET /api/mobility-platform/preferences"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/mobility-platform/preferences")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/mobility-platform/preferences",
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            # Response structure is {"preferences": {...}}
            if "preferences" in data:
                prefs = data["preferences"]
                required_fields = ["priority", "luggage", "childSeat"]
                has_all_fields = all(field in prefs for field in required_fields)
                
                if has_all_fields:
                    return log_test(
                        "GET /api/mobility-platform/preferences",
                        True,
                        f"Returns 200 OK with all required fields: priority={prefs.get('priority')}, luggage={prefs.get('luggage')}, childSeat={prefs.get('childSeat')}"
                    )
                else:
                    return log_test(
                        "GET /api/mobility-platform/preferences",
                        False,
                        f"Missing required fields in preferences. Got: {list(prefs.keys())}, Expected: {required_fields}"
                    )
            else:
                return log_test(
                    "GET /api/mobility-platform/preferences",
                    False,
                    f"Response missing 'preferences' key. Got: {list(data.keys())}"
                )
        else:
            return log_test(
                "GET /api/mobility-platform/preferences",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        return log_test("GET /api/mobility-platform/preferences", False, f"Exception: {str(e)}")

def test_preferences_post(cookies):
    """Test 2: POST /api/mobility-platform/preferences"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/mobility-platform/preferences")
    print("="*80)
    
    try:
        payload = {
            "priority": "fastest",
            "luggage": True,
            "childSeat": False
        }
        
        response = requests.post(
            f"{API_BASE}/mobility-platform/preferences",
            json=payload,
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True:
                return log_test(
                    "POST /api/mobility-platform/preferences",
                    True,
                    f"Successfully saved preferences: {payload}"
                )
            else:
                return log_test(
                    "POST /api/mobility-platform/preferences",
                    False,
                    f"Response missing 'ok: true'. Got: {data}"
                )
        else:
            return log_test(
                "POST /api/mobility-platform/preferences",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        return log_test("POST /api/mobility-platform/preferences", False, f"Exception: {str(e)}")

def test_book_wallet(cookies):
    """Test 3: POST /api/mobility-platform/book (Wallet payment)"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/mobility-platform/book (Wallet)")
    print("="*80)
    
    try:
        payload = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 12.50,
            "duration_min": 8,
            "distance_km": 3.2,
            "payment_method": "wallet",
            "pickup": {
                "address": "Alexanderplatz, Berlin, Germany",
                "lat": 52.5200,
                "lng": 13.4050
            },
            "dropoff": {
                "address": "Brandenburg Gate, Berlin, Germany",
                "lat": 52.5163,
                "lng": 13.3777
            }
        }
        
        response = requests.post(
            f"{API_BASE}/mobility-platform/book",
            json=payload,
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["ok", "booking", "new_balance"]
            has_all_fields = all(field in data for field in required_fields)
            
            if has_all_fields and data.get("ok") == True:
                booking = data.get("booking", {})
                booking_id = booking.get("booking_id")
                return log_test(
                    "POST /api/mobility-platform/book",
                    True,
                    f"Booking created successfully. booking_id={booking_id}, status={booking.get('status')}, payment_status={booking.get('payment_status')}, new_balance={data.get('new_balance')}"
                ), booking_id
            else:
                return log_test(
                    "POST /api/mobility-platform/book",
                    False,
                    f"Missing required fields or ok != true. Got: {list(data.keys())}"
                ), None
        else:
            return log_test(
                "POST /api/mobility-platform/book",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            ), None
    except Exception as e:
        return log_test("POST /api/mobility-platform/book", False, f"Exception: {str(e)}"), None

def test_booking_detail(cookies, booking_id):
    """Test 4: GET /api/mobility-platform/booking/{booking_id} - CRITICAL for tracking page"""
    print("\n" + "="*80)
    print(f"TEST 4: GET /api/mobility-platform/booking/{booking_id}")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/mobility-platform/booking/{booking_id}",
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required top-level fields
            required_top_fields = ["booking", "tracking"]
            has_top_fields = all(field in data for field in required_top_fields)
            
            # Check for required tracking fields (critical for tracking page)
            tracking = data.get("tracking", {})
            required_tracking_fields = ["status", "eta_minutes", "assigned_resource", "can_cancel"]
            has_tracking_fields = all(field in tracking for field in required_tracking_fields)
            
            # Check booking object
            booking = data.get("booking", {})
            has_booking_id = booking.get("booking_id") == booking_id
            
            if has_top_fields and has_tracking_fields and has_booking_id:
                return log_test(
                    f"GET /api/mobility-platform/booking/{booking_id}",
                    True,
                    f"✅ TRACKING DATA CORRECT: booking_id={booking_id}, status={tracking.get('status')}, eta_minutes={tracking.get('eta_minutes')}, can_cancel={tracking.get('can_cancel')}, assigned_resource={tracking.get('assigned_resource')}"
                )
            else:
                missing = []
                if not has_top_fields:
                    missing.append(f"top-level fields (got: {list(data.keys())})")
                if not has_tracking_fields:
                    missing.append(f"tracking fields (got: {list(tracking.keys())})")
                if not has_booking_id:
                    missing.append(f"booking_id mismatch")
                
                return log_test(
                    f"GET /api/mobility-platform/booking/{booking_id}",
                    False,
                    f"Missing or incorrect fields: {', '.join(missing)}"
                )
        else:
            return log_test(
                f"GET /api/mobility-platform/booking/{booking_id}",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        return log_test(f"GET /api/mobility-platform/booking/{booking_id}", False, f"Exception: {str(e)}")

def test_checkout_session(cookies):
    """Test 5: POST /api/mobility-platform/checkout/session"""
    print("\n" + "="*80)
    print("TEST 5: POST /api/mobility-platform/checkout/session")
    print("="*80)
    
    try:
        payload = {
            "transport_type": "scooter",
            "payment_method": "qr",
            "origin_url": BASE_URL,  # Required field
            "pickup": {
                "address": "Potsdamer Platz, Berlin, Germany",
                "lat": 52.5096,
                "lng": 13.3760
            },
            "dropoff": {
                "address": "Checkpoint Charlie, Berlin, Germany",
                "lat": 52.5075,
                "lng": 13.3903
            }
        }
        
        response = requests.post(
            f"{API_BASE}/mobility-platform/checkout/session",
            json=payload,
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["checkout_url", "session_id", "booking_id"]
            has_all_fields = all(field in data for field in required_fields)
            
            if has_all_fields:
                session_id = data.get("session_id")
                booking_id = data.get("booking_id")
                checkout_url = data.get("checkout_url")
                
                # Verify checkout_url is a valid Stripe URL
                is_stripe_url = "checkout.stripe.com" in checkout_url
                
                if is_stripe_url:
                    return log_test(
                        "POST /api/mobility-platform/checkout/session",
                        True,
                        f"Checkout session created successfully. session_id={session_id}, booking_id={booking_id}, checkout_url={checkout_url[:80]}..."
                    ), session_id
                else:
                    return log_test(
                        "POST /api/mobility-platform/checkout/session",
                        False,
                        f"checkout_url is not a valid Stripe URL: {checkout_url}"
                    ), None
            else:
                return log_test(
                    "POST /api/mobility-platform/checkout/session",
                    False,
                    f"Missing required fields. Got: {list(data.keys())}, Expected: {required_fields}"
                ), None
        else:
            return log_test(
                "POST /api/mobility-platform/checkout/session",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            ), None
    except Exception as e:
        return log_test("POST /api/mobility-platform/checkout/session", False, f"Exception: {str(e)}"), None

def test_checkout_status(cookies, session_id):
    """Test 6: GET /api/mobility-platform/checkout/status/{session_id}"""
    print("\n" + "="*80)
    print(f"TEST 6: GET /api/mobility-platform/checkout/status/{session_id}")
    print("="*80)
    
    try:
        response = requests.get(
            f"{API_BASE}/mobility-platform/checkout/status/{session_id}",
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["status", "payment_status", "amount_total", "currency"]
            has_all_fields = all(field in data for field in required_fields)
            
            if has_all_fields:
                return log_test(
                    f"GET /api/mobility-platform/checkout/status/{session_id}",
                    True,
                    f"Checkout status retrieved successfully. status={data.get('status')}, payment_status={data.get('payment_status')}, amount_total={data.get('amount_total')}, currency={data.get('currency')}"
                )
            else:
                return log_test(
                    f"GET /api/mobility-platform/checkout/status/{session_id}",
                    False,
                    f"Missing required fields. Got: {list(data.keys())}, Expected: {required_fields}"
                )
        else:
            return log_test(
                f"GET /api/mobility-platform/checkout/status/{session_id}",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        return log_test(f"GET /api/mobility-platform/checkout/status/{session_id}", False, f"Exception: {str(e)}")

def test_ai_recommendation(cookies):
    """Test 7: POST /api/mobility-platform/ai-recommendation - REGRESSION CHECK"""
    print("\n" + "="*80)
    print("TEST 7: POST /api/mobility-platform/ai-recommendation (REGRESSION)")
    print("="*80)
    
    try:
        payload = {
            "pickup_address": "Alexanderplatz, Berlin, Germany",
            "dropoff_address": "Brandenburg Gate, Berlin, Germany",
            "distance_km": 2.5,
            "duration_min": 6,
            "options": [
                {
                    "type": "taxi",
                    "label": "Taxi",
                    "price_eur": 15.50,
                    "duration_min": 6,
                    "distance_km": 2.5,
                    "eco_score": 45
                },
                {
                    "type": "scooter",
                    "label": "E-Scooter",
                    "price_eur": 3.20,
                    "duration_min": 8,
                    "distance_km": 2.5,
                    "eco_score": 85
                },
                {
                    "type": "bike",
                    "label": "Fahrrad",
                    "price_eur": 2.10,
                    "duration_min": 12,
                    "distance_km": 2.5,
                    "eco_score": 95
                }
            ],
            "preferences": {
                "priority": "balance",
                "luggage": False,
                "childSeat": False
            }
        }
        
        response = requests.post(
            f"{API_BASE}/mobility-platform/ai-recommendation",
            json=payload,
            cookies=cookies
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required fields
            required_fields = ["available", "headline", "summary", "best_option_type", "provider", "model"]
            has_all_fields = all(field in data for field in required_fields)
            
            # Validate best_option_type is one of the valid transport types
            valid_types = ["taxi", "scooter", "bike", "car_rental", "airport_shuttle", "vip"]
            best_option_valid = data.get("best_option_type") in valid_types
            
            # Check if AI is available
            is_available = data.get("available") == True
            
            if has_all_fields and best_option_valid and is_available:
                return log_test(
                    "POST /api/mobility-platform/ai-recommendation",
                    True,
                    f"✅ AI RECOMMENDATION WORKING: available={data.get('available')}, provider={data.get('provider')}, model={data.get('model')}, best_option={data.get('best_option_type')}, headline='{data.get('headline')[:60]}...', confidence={data.get('confidence')}"
                )
            else:
                issues = []
                if not has_all_fields:
                    issues.append(f"missing fields (got: {list(data.keys())})")
                if not best_option_valid:
                    issues.append(f"invalid best_option_type: {data.get('best_option_type')}")
                if not is_available:
                    issues.append(f"available=false")
                
                return log_test(
                    "POST /api/mobility-platform/ai-recommendation",
                    False,
                    f"Issues: {', '.join(issues)}"
                )
        else:
            return log_test(
                "POST /api/mobility-platform/ai-recommendation",
                False,
                f"Status {response.status_code}: {response.text[:200]}"
            )
    except Exception as e:
        return log_test("POST /api/mobility-platform/ai-recommendation", False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BIDBLITZ MOBILITY BACKEND REGRESSION TEST")
    print("Testing after Tracking/NFC UI improvements")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Login
    cookies = login()
    if not cookies:
        print("\n❌ CRITICAL: Login failed. Cannot proceed with tests.")
        return
    
    # Run tests
    passed_count = 0
    total_count = 0
    
    # Test 1: GET preferences
    total_count += 1
    if test_preferences_get(cookies):
        passed_count += 1
    
    # Test 2: POST preferences
    total_count += 1
    if test_preferences_post(cookies):
        passed_count += 1
    
    # Test 3: POST book (Wallet) - also creates a booking for Test 4
    total_count += 1
    book_result, booking_id = test_book_wallet(cookies)
    if book_result:
        passed_count += 1
    
    # Test 4: GET booking detail (CRITICAL for tracking page)
    if booking_id:
        total_count += 1
        if test_booking_detail(cookies, booking_id):
            passed_count += 1
    else:
        print("\n⚠️ WARNING: Skipping Test 4 (booking detail) because booking creation failed")
    
    # Test 5: POST checkout session - also creates a session for Test 6
    total_count += 1
    checkout_result, session_id = test_checkout_session(cookies)
    if checkout_result:
        passed_count += 1
    
    # Test 6: GET checkout status
    if session_id:
        total_count += 1
        if test_checkout_status(cookies, session_id):
            passed_count += 1
    else:
        print("\n⚠️ WARNING: Skipping Test 6 (checkout status) because checkout session creation failed")
    
    # Test 7: POST ai-recommendation (REGRESSION CHECK)
    total_count += 1
    if test_ai_recommendation(cookies):
        passed_count += 1
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {total_count - passed_count}")
    print(f"Success Rate: {(passed_count/total_count*100):.1f}%")
    
    # Save results
    test_results["summary"] = {
        "total": total_count,
        "passed": passed_count,
        "failed": total_count - passed_count,
        "success_rate": f"{(passed_count/total_count*100):.1f}%"
    }
    
    with open("/app/mobility_regression_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✅ Test results saved to /app/mobility_regression_test_results.json")
    
    # Final verdict
    if passed_count == total_count:
        print("\n✅ ALL TESTS PASSED - No regressions detected after Tracking/NFC UI improvements")
    else:
        print(f"\n⚠️ {total_count - passed_count} TEST(S) FAILED - Regressions detected")

if __name__ == "__main__":
    main()
