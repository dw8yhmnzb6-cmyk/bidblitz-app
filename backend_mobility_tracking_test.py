#!/usr/bin/env python3
"""
BidBlitz Mobility Booking Tracking Backend Test
Final dedicated backend check for new tracking features
Testing iteration 156 - verifying 100% green status
"""

import json
import requests
from datetime import datetime

# Configuration
BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"
CREDENTIALS = {
    "email": "haendler@bidblitz.com",
    "password": "Haendler2026!"
}

# Test results storage
test_results = {
    "test_date": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "credentials_used": CREDENTIALS["email"],
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
    print(f"Details: {json.dumps(details, indent=2)}")
    return passed

def login():
    """Login and get session cookies"""
    print(f"\n{'='*80}")
    print("LOGGING IN...")
    print(f"{'='*80}")
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=CREDENTIALS,
        timeout=30
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    print(f"✅ Login successful")
    return response.cookies

def test_booking_detail_tracking_fields(cookies):
    """
    TEST 1: GET /api/mobility-platform/booking/{booking_id}
    Must return: tracking.live_status, phase_label, next_event_label, 
                 progress_percent, timeline, route_points, assigned_resource.live_position
    """
    print(f"\n{'='*80}")
    print("TEST 1: Booking Detail Tracking Fields")
    print(f"{'='*80}")
    
    # First get my bookings to find a booking_id
    response = requests.get(
        f"{BASE_URL}/api/mobility-platform/my-bookings",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
            False,
            {"error": "Failed to get bookings list", "status": response.status_code, "response": response.text[:500]}
        )
    
    bookings_data = response.json()
    bookings = bookings_data.get("bookings", [])
    
    if not bookings:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
            False,
            {"error": "No bookings found to test", "bookings_count": 0}
        )
    
    # Use the first booking
    booking_id = bookings[0].get("booking_id")
    print(f"Testing with booking_id: {booking_id}")
    
    # Get booking detail
    response = requests.get(
        f"{BASE_URL}/api/mobility-platform/booking/{booking_id}",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
            False,
            {"error": "Failed to get booking detail", "status": response.status_code, "response": response.text[:500]}
        )
    
    data = response.json()
    tracking = data.get("tracking", {})
    
    # Check all required fields
    required_fields = {
        "live_status": tracking.get("live_status"),
        "phase_label": tracking.get("phase_label"),
        "next_event_label": tracking.get("next_event_label"),
        "progress_percent": tracking.get("progress_percent"),
        "timeline": tracking.get("timeline"),
        "route_points": tracking.get("route_points"),
        "assigned_resource": tracking.get("assigned_resource"),
    }
    
    # Check if assigned_resource has live_position
    assigned_resource = tracking.get("assigned_resource", {})
    has_live_position = "live_position" in assigned_resource or ("lat" in assigned_resource and "lng" in assigned_resource)
    
    missing_fields = [k for k, v in required_fields.items() if v is None]
    
    if missing_fields:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
            False,
            {
                "error": "Missing required tracking fields",
                "missing_fields": missing_fields,
                "tracking_data": tracking
            }
        )
    
    # Validate field types and values
    validations = []
    
    # live_status should be a string
    if not isinstance(tracking.get("live_status"), str):
        validations.append("live_status is not a string")
    
    # phase_label should be a string
    if not isinstance(tracking.get("phase_label"), str):
        validations.append("phase_label is not a string")
    
    # next_event_label should be a string
    if not isinstance(tracking.get("next_event_label"), str):
        validations.append("next_event_label is not a string")
    
    # progress_percent should be a number between 0-100
    progress = tracking.get("progress_percent")
    if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
        validations.append(f"progress_percent invalid: {progress}")
    
    # timeline should be a list
    if not isinstance(tracking.get("timeline"), list):
        validations.append("timeline is not a list")
    
    # route_points should be a list
    if not isinstance(tracking.get("route_points"), list):
        validations.append("route_points is not a list")
    
    # assigned_resource should have live_position or lat/lng
    if not has_live_position:
        validations.append("assigned_resource missing live_position or lat/lng")
    
    if validations:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
            False,
            {
                "error": "Field validation failed",
                "validation_errors": validations,
                "tracking_data": tracking
            }
        )
    
    return log_test(
        "GET /api/mobility-platform/booking/{booking_id} - Tracking Fields",
        True,
        {
            "booking_id": booking_id,
            "live_status": tracking.get("live_status"),
            "phase_label": tracking.get("phase_label"),
            "next_event_label": tracking.get("next_event_label"),
            "progress_percent": tracking.get("progress_percent"),
            "timeline_steps": len(tracking.get("timeline", [])),
            "route_points_count": len(tracking.get("route_points", [])),
            "assigned_resource": {
                "has_live_position": has_live_position,
                "resource_id": assigned_resource.get("resource_id"),
                "label": assigned_resource.get("label"),
                "lat": assigned_resource.get("lat"),
                "lng": assigned_resource.get("lng"),
            }
        }
    )

def test_my_bookings_active(cookies):
    """
    TEST 2: GET /api/mobility-platform/my-bookings
    Must return active bookings for tracking entry
    """
    print(f"\n{'='*80}")
    print("TEST 2: My Bookings - Active Bookings for Tracking")
    print(f"{'='*80}")
    
    response = requests.get(
        f"{BASE_URL}/api/mobility-platform/my-bookings",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "GET /api/mobility-platform/my-bookings - Active Bookings",
            False,
            {"error": "Failed to get bookings", "status": response.status_code, "response": response.text[:500]}
        )
    
    data = response.json()
    bookings = data.get("bookings", [])
    
    if not isinstance(bookings, list):
        return log_test(
            "GET /api/mobility-platform/my-bookings - Active Bookings",
            False,
            {"error": "bookings is not a list", "data": data}
        )
    
    # Check for active bookings (confirmed or payment_pending status)
    active_bookings = [
        b for b in bookings 
        if b.get("status") in ["confirmed", "payment_pending"]
    ]
    
    # Validate booking structure
    if bookings:
        sample_booking = bookings[0]
        required_fields = ["booking_id", "transport_type", "status", "pickup", "dropoff", "created_at"]
        missing_fields = [f for f in required_fields if f not in sample_booking]
        
        if missing_fields:
            return log_test(
                "GET /api/mobility-platform/my-bookings - Active Bookings",
                False,
                {
                    "error": "Missing required fields in booking",
                    "missing_fields": missing_fields,
                    "sample_booking": sample_booking
                }
            )
    
    return log_test(
        "GET /api/mobility-platform/my-bookings - Active Bookings",
        True,
        {
            "total_bookings": len(bookings),
            "active_bookings": len(active_bookings),
            "sample_booking_ids": [b.get("booking_id") for b in bookings[:3]],
            "sample_statuses": [b.get("status") for b in bookings[:3]]
        }
    )

def test_book_endpoint_no_500(cookies):
    """
    TEST 3: POST /api/mobility-platform/book
    Must not cause 500 errors
    """
    print(f"\n{'='*80}")
    print("TEST 3: Book Endpoint - No 500 Errors")
    print(f"{'='*80}")
    
    # Create a test booking with wallet payment
    booking_payload = {
        "pickup": {
            "address": "Alexanderplatz, Berlin, Germany",
            "lat": 52.5219,
            "lng": 13.4132
        },
        "dropoff": {
            "address": "Brandenburg Gate, Berlin, Germany",
            "lat": 52.5163,
            "lng": 13.3777
        },
        "transport_type": "taxi",
        "transport_label": "Taxi",
        "price_eur": 12.50,
        "duration_min": 8,
        "distance_km": 2.5,
        "payment_method": "wallet",
        "preferences": {
            "priority": "fastest",
            "luggage": False,
            "childSeat": False
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/api/mobility-platform/book",
        json=booking_payload,
        cookies=cookies,
        timeout=30
    )
    
    # Check for 500 errors
    if response.status_code == 500:
        return log_test(
            "POST /api/mobility-platform/book - No 500 Errors",
            False,
            {
                "error": "500 Internal Server Error detected",
                "status": response.status_code,
                "response": response.text[:1000]
            }
        )
    
    # Accept 200 (success) or 400/402 (business logic errors like insufficient balance)
    if response.status_code not in [200, 400, 402]:
        return log_test(
            "POST /api/mobility-platform/book - No 500 Errors",
            False,
            {
                "error": f"Unexpected status code: {response.status_code}",
                "response": response.text[:500]
            }
        )
    
    # If successful, check response structure
    if response.status_code == 200:
        data = response.json()
        if "booking" not in data:
            return log_test(
                "POST /api/mobility-platform/book - No 500 Errors",
                False,
                {
                    "error": "Missing 'booking' in response",
                    "data": data
                }
            )
        
        booking = data.get("booking", {})
        return log_test(
            "POST /api/mobility-platform/book - No 500 Errors",
            True,
            {
                "status": response.status_code,
                "booking_id": booking.get("booking_id"),
                "transport_type": booking.get("transport_type"),
                "payment_status": booking.get("payment_status"),
                "booking_status": booking.get("status"),
                "new_balance": data.get("new_balance")
            }
        )
    else:
        # Business logic error (e.g., insufficient balance) - still counts as no 500 error
        return log_test(
            "POST /api/mobility-platform/book - No 500 Errors",
            True,
            {
                "status": response.status_code,
                "note": "Business logic error (not 500)",
                "error_message": response.json().get("detail") if response.headers.get("content-type") == "application/json" else response.text[:200]
            }
        )

def test_cancel_endpoint_no_500(cookies):
    """
    TEST 4: POST /api/mobility-platform/booking/{id}/cancel
    Must not cause 500 errors
    """
    print(f"\n{'='*80}")
    print("TEST 4: Cancel Booking Endpoint - No 500 Errors")
    print(f"{'='*80}")
    
    # First get a booking to cancel
    response = requests.get(
        f"{BASE_URL}/api/mobility-platform/my-bookings",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/booking/{id}/cancel - No 500 Errors",
            False,
            {"error": "Failed to get bookings list", "status": response.status_code}
        )
    
    bookings = response.json().get("bookings", [])
    
    # Find a confirmed or payment_pending booking to cancel
    cancelable_booking = None
    for booking in bookings:
        if booking.get("status") in ["confirmed", "payment_pending"]:
            cancelable_booking = booking
            break
    
    if not cancelable_booking:
        # No cancelable booking found - try to cancel any booking to test error handling
        if bookings:
            test_booking_id = bookings[0].get("booking_id")
        else:
            # No bookings at all - use a fake ID to test error handling
            test_booking_id = "mob-test123456"
    else:
        test_booking_id = cancelable_booking.get("booking_id")
    
    print(f"Testing cancel with booking_id: {test_booking_id}")
    
    response = requests.post(
        f"{BASE_URL}/api/mobility-platform/booking/{test_booking_id}/cancel",
        cookies=cookies,
        timeout=30
    )
    
    # Check for 500 errors
    if response.status_code == 500:
        return log_test(
            "POST /api/mobility-platform/booking/{id}/cancel - No 500 Errors",
            False,
            {
                "error": "500 Internal Server Error detected",
                "booking_id": test_booking_id,
                "response": response.text[:1000]
            }
        )
    
    # Accept 200 (success), 400 (can't cancel), or 404 (not found)
    if response.status_code not in [200, 400, 404]:
        return log_test(
            "POST /api/mobility-platform/booking/{id}/cancel - No 500 Errors",
            False,
            {
                "error": f"Unexpected status code: {response.status_code}",
                "booking_id": test_booking_id,
                "response": response.text[:500]
            }
        )
    
    # Parse response
    try:
        data = response.json()
    except:
        data = {"raw_response": response.text[:200]}
    
    return log_test(
        "POST /api/mobility-platform/booking/{id}/cancel - No 500 Errors",
        True,
        {
            "status": response.status_code,
            "booking_id": test_booking_id,
            "was_cancelable": cancelable_booking is not None,
            "response": data
        }
    )

def test_no_serialization_errors(cookies):
    """
    TEST 5: Check for serialization problems in mobility endpoints
    Test multiple endpoints to ensure no ObjectId or other serialization issues
    """
    print(f"\n{'='*80}")
    print("TEST 5: No Serialization Problems")
    print(f"{'='*80}")
    
    endpoints_to_test = [
        ("GET", "/api/mobility-platform/my-bookings", None),
        ("GET", "/api/mobility-platform/payment-options", None),
        ("GET", "/api/mobility-platform/saved-locations", None),
        ("GET", "/api/mobility-platform/recent-locations", None),
    ]
    
    serialization_errors = []
    
    for method, endpoint, payload in endpoints_to_test:
        print(f"\nTesting {method} {endpoint}")
        
        try:
            if method == "GET":
                response = requests.get(
                    f"{BASE_URL}{endpoint}",
                    cookies=cookies,
                    timeout=30
                )
            else:
                response = requests.post(
                    f"{BASE_URL}{endpoint}",
                    json=payload,
                    cookies=cookies,
                    timeout=30
                )
            
            # Check for 500 errors
            if response.status_code == 500:
                serialization_errors.append({
                    "endpoint": endpoint,
                    "error": "500 Internal Server Error",
                    "response": response.text[:500]
                })
                continue
            
            # Try to parse JSON
            try:
                data = response.json()
                
                # Check for common serialization error patterns
                json_str = json.dumps(data)
                if "ObjectId" in json_str:
                    serialization_errors.append({
                        "endpoint": endpoint,
                        "error": "ObjectId found in JSON response (not serializable)",
                        "sample": json_str[:200]
                    })
                
            except json.JSONDecodeError as e:
                serialization_errors.append({
                    "endpoint": endpoint,
                    "error": f"JSON decode error: {str(e)}",
                    "response": response.text[:200]
                })
        
        except Exception as e:
            serialization_errors.append({
                "endpoint": endpoint,
                "error": f"Request failed: {str(e)}"
            })
    
    if serialization_errors:
        return log_test(
            "No Serialization Problems in Mobility Endpoints",
            False,
            {
                "error": "Serialization errors detected",
                "errors": serialization_errors
            }
        )
    
    return log_test(
        "No Serialization Problems in Mobility Endpoints",
        True,
        {
            "endpoints_tested": len(endpoints_to_test),
            "all_endpoints_ok": True
        }
    )

def main():
    """Run all tests"""
    print(f"\n{'='*80}")
    print("BIDBLITZ MOBILITY BOOKING TRACKING - FINAL BACKEND CHECK")
    print("Testing Iteration 156 - Verifying 100% Green Status")
    print(f"{'='*80}")
    print(f"Base URL: {BASE_URL}")
    print(f"Credentials: {CREDENTIALS['email']}")
    print(f"Test Date: {datetime.now().isoformat()}")
    
    # Login
    cookies = login()
    if not cookies:
        print("\n❌ FATAL: Login failed. Cannot proceed with tests.")
        return
    
    # Run all tests
    test_1 = test_booking_detail_tracking_fields(cookies)
    test_2 = test_my_bookings_active(cookies)
    test_3 = test_book_endpoint_no_500(cookies)
    test_4 = test_cancel_endpoint_no_500(cookies)
    test_5 = test_no_serialization_errors(cookies)
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}")
    
    all_tests = [test_1, test_2, test_3, test_4, test_5]
    passed = sum(all_tests)
    total = len(all_tests)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    
    print(f"\n{'='*80}")
    print("DETAILED RESULTS")
    print(f"{'='*80}")
    
    for i, test in enumerate(test_results["tests"], 1):
        status = "✅ PASSED" if test["passed"] else "❌ FAILED"
        print(f"\n{i}. {status}: {test['test']}")
    
    # Save results to file
    with open("/app/mobility_tracking_backend_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n{'='*80}")
    print(f"Results saved to: /app/mobility_tracking_backend_test_results.json")
    print(f"{'='*80}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Backend is 100% green.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review details above.")

if __name__ == "__main__":
    main()
