#!/usr/bin/env python3
"""
BidBlitz Mobility Platform - Final Backend Flow Testing
Testing gegen externe Preview-URL: https://biometric-checkout-7.preview.emergentagent.com

Fokus:
1. GET/POST /api/mobility-platform/preferences
2. POST /api/mobility-platform/checkout/session für QR/Apple Pay/Google Pay/NFC
3. POST /api/mobility-platform/book für Wallet
4. GET /api/mobility-platform/booking/{booking_id}
5. POST /api/mobility-platform/booking/{booking_id}/cancel
6. Regression auf /api/mobility-platform/route und /api/mobility-platform/ai-recommendation
"""

import json
import requests
from datetime import datetime

BASE_URL = "https://biometric-checkout-7.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

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
    print(f"Details: {json.dumps(details, indent=2, ensure_ascii=False)}")
    return passed

def login():
    """Login and get session cookies"""
    print(f"\n{'='*80}")
    print("LOGGING IN AS ADMIN")
    print(f"{'='*80}")
    
    response = requests.post(
        f"{API_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None
    
    cookies = response.cookies
    user_data = response.json()
    print(f"✅ Logged in as: {user_data.get('user', {}).get('email')}")
    print(f"Balance: €{user_data.get('user', {}).get('balance', 0):.2f}")
    return cookies

def test_get_preferences(cookies):
    """Test 1: GET /api/mobility-platform/preferences"""
    print(f"\n{'='*80}")
    print("TEST 1: GET /api/mobility-platform/preferences")
    print(f"{'='*80}")
    
    response = requests.get(
        f"{API_URL}/mobility-platform/preferences",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "GET /api/mobility-platform/preferences",
            False,
            {"status_code": response.status_code, "error": response.text}
        )
    
    data = response.json()
    preferences = data.get("preferences", {})
    
    # Validate structure
    has_priority = "priority" in preferences
    has_luggage = "luggage" in preferences
    has_child_seat = "childSeat" in preferences
    
    return log_test(
        "GET /api/mobility-platform/preferences",
        has_priority and has_luggage and has_child_seat,
        {
            "status_code": response.status_code,
            "preferences": preferences,
            "has_all_fields": has_priority and has_luggage and has_child_seat
        }
    )

def test_post_preferences(cookies):
    """Test 2: POST /api/mobility-platform/preferences"""
    print(f"\n{'='*80}")
    print("TEST 2: POST /api/mobility-platform/preferences")
    print(f"{'='*80}")
    
    test_preferences = {
        "priority": "fastest",
        "luggage": True,
        "childSeat": True
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/preferences",
        json=test_preferences,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/preferences",
            False,
            {"status_code": response.status_code, "error": response.text}
        )
    
    data = response.json()
    saved_prefs = data.get("preferences", {})
    
    # Verify saved preferences match what we sent
    matches = (
        saved_prefs.get("priority") == "fastest" and
        saved_prefs.get("luggage") == True and
        saved_prefs.get("childSeat") == True
    )
    
    return log_test(
        "POST /api/mobility-platform/preferences",
        data.get("ok") == True and matches,
        {
            "status_code": response.status_code,
            "ok": data.get("ok"),
            "saved_preferences": saved_prefs,
            "matches_input": matches
        }
    )

def test_checkout_session_qr(cookies):
    """Test 3a: POST /api/mobility-platform/checkout/session with QR payment"""
    print(f"\n{'='*80}")
    print("TEST 3a: POST /api/mobility-platform/checkout/session (QR Payment)")
    print(f"{'='*80}")
    
    checkout_request = {
        "transport_type": "taxi",
        "payment_method": "qr",
        "origin_url": BASE_URL,
        "pickup": {
            "address": "Alexanderplatz, Berlin, Deutschland",
            "lat": 52.5200,
            "lng": 13.4050
        },
        "dropoff": {
            "address": "Brandenburger Tor, Berlin, Deutschland",
            "lat": 52.5163,
            "lng": 13.3777
        },
        "preferences": {
            "priority": "balance",
            "luggage": False,
            "childSeat": False
        }
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/checkout/session",
        json=checkout_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/checkout/session (QR)",
            False,
            {"status_code": response.status_code, "error": response.text}
        ), None
    
    data = response.json()
    has_checkout_url = "checkout_url" in data
    has_session_id = "session_id" in data
    has_booking_id = "booking_id" in data
    
    passed = has_checkout_url and has_session_id and has_booking_id
    
    log_test(
        "POST /api/mobility-platform/checkout/session (QR)",
        passed,
        {
            "status_code": response.status_code,
            "has_checkout_url": has_checkout_url,
            "has_session_id": has_session_id,
            "has_booking_id": has_booking_id,
            "booking_id": data.get("booking_id"),
            "checkout_url_preview": data.get("checkout_url", "")[:100] if has_checkout_url else None
        }
    )
    
    return passed, data.get("booking_id")

def test_checkout_session_apple_pay(cookies):
    """Test 3b: POST /api/mobility-platform/checkout/session with Apple Pay"""
    print(f"\n{'='*80}")
    print("TEST 3b: POST /api/mobility-platform/checkout/session (Apple Pay)")
    print(f"{'='*80}")
    
    checkout_request = {
        "transport_type": "scooter",
        "payment_method": "apple_pay",
        "origin_url": BASE_URL,
        "pickup": {
            "address": "Potsdamer Platz, Berlin, Deutschland",
            "lat": 52.5096,
            "lng": 13.3760
        },
        "dropoff": {
            "address": "Checkpoint Charlie, Berlin, Deutschland",
            "lat": 52.5075,
            "lng": 13.3903
        }
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/checkout/session",
        json=checkout_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/checkout/session (Apple Pay)",
            False,
            {"status_code": response.status_code, "error": response.text}
        ), None
    
    data = response.json()
    has_checkout_url = "checkout_url" in data
    has_session_id = "session_id" in data
    has_booking_id = "booking_id" in data
    
    passed = has_checkout_url and has_session_id and has_booking_id
    
    log_test(
        "POST /api/mobility-platform/checkout/session (Apple Pay)",
        passed,
        {
            "status_code": response.status_code,
            "has_checkout_url": has_checkout_url,
            "has_session_id": has_session_id,
            "has_booking_id": has_booking_id,
            "booking_id": data.get("booking_id")
        }
    )
    
    return passed, data.get("booking_id")

def test_checkout_session_google_pay(cookies):
    """Test 3c: POST /api/mobility-platform/checkout/session with Google Pay"""
    print(f"\n{'='*80}")
    print("TEST 3c: POST /api/mobility-platform/checkout/session (Google Pay)")
    print(f"{'='*80}")
    
    checkout_request = {
        "transport_type": "bike",
        "payment_method": "google_pay",
        "origin_url": BASE_URL,
        "pickup": {
            "address": "Fernsehturm, Berlin, Deutschland",
            "lat": 52.5208,
            "lng": 13.4094
        },
        "dropoff": {
            "address": "Reichstag, Berlin, Deutschland",
            "lat": 52.5186,
            "lng": 13.3761
        }
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/checkout/session",
        json=checkout_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/checkout/session (Google Pay)",
            False,
            {"status_code": response.status_code, "error": response.text}
        ), None
    
    data = response.json()
    has_checkout_url = "checkout_url" in data
    has_session_id = "session_id" in data
    has_booking_id = "booking_id" in data
    
    passed = has_checkout_url and has_session_id and has_booking_id
    
    log_test(
        "POST /api/mobility-platform/checkout/session (Google Pay)",
        passed,
        {
            "status_code": response.status_code,
            "has_checkout_url": has_checkout_url,
            "has_session_id": has_session_id,
            "has_booking_id": has_booking_id,
            "booking_id": data.get("booking_id")
        }
    )
    
    return passed, data.get("booking_id")

def test_checkout_session_nfc(cookies):
    """Test 3d: POST /api/mobility-platform/checkout/session with NFC payment"""
    print(f"\n{'='*80}")
    print("TEST 3d: POST /api/mobility-platform/checkout/session (NFC Payment)")
    print(f"{'='*80}")
    
    checkout_request = {
        "transport_type": "car_rental",
        "payment_method": "nfc",
        "origin_url": BASE_URL,
        "pickup": {
            "address": "Berlin Hauptbahnhof, Berlin, Deutschland",
            "lat": 52.5250,
            "lng": 13.3694
        },
        "dropoff": {
            "address": "Flughafen Berlin Brandenburg, Schönefeld, Deutschland",
            "lat": 52.3667,
            "lng": 13.5033
        }
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/checkout/session",
        json=checkout_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/checkout/session (NFC)",
            False,
            {"status_code": response.status_code, "error": response.text}
        ), None
    
    data = response.json()
    has_checkout_url = "checkout_url" in data
    has_session_id = "session_id" in data
    has_booking_id = "booking_id" in data
    
    passed = has_checkout_url and has_session_id and has_booking_id
    
    log_test(
        "POST /api/mobility-platform/checkout/session (NFC)",
        passed,
        {
            "status_code": response.status_code,
            "has_checkout_url": has_checkout_url,
            "has_session_id": has_session_id,
            "has_booking_id": has_booking_id,
            "booking_id": data.get("booking_id")
        }
    )
    
    return passed, data.get("booking_id")

def test_wallet_booking(cookies):
    """Test 4: POST /api/mobility-platform/book with Wallet payment"""
    print(f"\n{'='*80}")
    print("TEST 4: POST /api/mobility-platform/book (Wallet Payment)")
    print(f"{'='*80}")
    
    booking_request = {
        "transport_type": "taxi",
        "transport_label": "Taxi",
        "price_eur": 18.50,
        "duration_min": 12,
        "distance_km": 3.8,
        "payment_method": "wallet",
        "pickup": {
            "address": "Kurfürstendamm 123, Berlin, Deutschland",
            "lat": 52.5048,
            "lng": 13.3301
        },
        "dropoff": {
            "address": "Zoologischer Garten, Berlin, Deutschland",
            "lat": 52.5075,
            "lng": 13.3387
        },
        "preferences": {
            "priority": "fastest",
            "luggage": True,
            "childSeat": False
        }
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/book",
        json=booking_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/book (Wallet)",
            False,
            {"status_code": response.status_code, "error": response.text}
        ), None
    
    data = response.json()
    booking = data.get("booking", {})
    
    has_booking_id = "booking_id" in booking
    has_new_balance = "new_balance" in data
    is_confirmed = booking.get("status") == "confirmed"
    is_paid = booking.get("payment_status") == "paid"
    is_wallet = booking.get("payment_method") == "wallet"
    
    passed = (
        data.get("ok") == True and
        has_booking_id and
        has_new_balance and
        is_confirmed and
        is_paid and
        is_wallet
    )
    
    log_test(
        "POST /api/mobility-platform/book (Wallet)",
        passed,
        {
            "status_code": response.status_code,
            "ok": data.get("ok"),
            "booking_id": booking.get("booking_id"),
            "status": booking.get("status"),
            "payment_status": booking.get("payment_status"),
            "payment_method": booking.get("payment_method"),
            "price_eur": booking.get("price_eur"),
            "new_balance": data.get("new_balance"),
            "all_checks_passed": passed
        }
    )
    
    return passed, booking.get("booking_id")

def test_get_booking_detail(cookies, booking_id):
    """Test 5: GET /api/mobility-platform/booking/{booking_id}"""
    print(f"\n{'='*80}")
    print(f"TEST 5: GET /api/mobility-platform/booking/{booking_id}")
    print(f"{'='*80}")
    
    if not booking_id:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id}",
            False,
            {"error": "No booking_id provided from previous test"}
        )
    
    response = requests.get(
        f"{API_URL}/mobility-platform/booking/{booking_id}",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "GET /api/mobility-platform/booking/{booking_id}",
            False,
            {"status_code": response.status_code, "error": response.text, "booking_id": booking_id}
        )
    
    data = response.json()
    booking = data.get("booking", {})
    tracking = data.get("tracking", {})
    
    has_booking = "booking" in data
    has_tracking = "tracking" in data
    has_status = "status" in tracking
    has_eta = "eta_minutes" in tracking
    has_can_cancel = "can_cancel" in tracking
    
    passed = has_booking and has_tracking and has_status and has_eta and has_can_cancel
    
    return log_test(
        "GET /api/mobility-platform/booking/{booking_id}",
        passed,
        {
            "status_code": response.status_code,
            "booking_id": booking.get("booking_id"),
            "status": booking.get("status"),
            "tracking_status": tracking.get("status"),
            "eta_minutes": tracking.get("eta_minutes"),
            "can_cancel": tracking.get("can_cancel"),
            "has_all_fields": passed
        }
    )

def test_cancel_booking(cookies, booking_id):
    """Test 6: POST /api/mobility-platform/booking/{booking_id}/cancel"""
    print(f"\n{'='*80}")
    print(f"TEST 6: POST /api/mobility-platform/booking/{booking_id}/cancel")
    print(f"{'='*80}")
    
    if not booking_id:
        return log_test(
            "POST /api/mobility-platform/booking/{booking_id}/cancel",
            False,
            {"error": "No booking_id provided from previous test"}
        )
    
    response = requests.post(
        f"{API_URL}/mobility-platform/booking/{booking_id}/cancel",
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/booking/{booking_id}/cancel",
            False,
            {"status_code": response.status_code, "error": response.text, "booking_id": booking_id}
        )
    
    data = response.json()
    
    passed = (
        data.get("ok") == True and
        data.get("booking_id") == booking_id and
        data.get("status") == "cancelled"
    )
    
    return log_test(
        "POST /api/mobility-platform/booking/{booking_id}/cancel",
        passed,
        {
            "status_code": response.status_code,
            "ok": data.get("ok"),
            "booking_id": data.get("booking_id"),
            "status": data.get("status"),
            "cancellation_successful": passed
        }
    )

def test_route_regression(cookies):
    """Test 7: POST /api/mobility-platform/route (Regression Check)"""
    print(f"\n{'='*80}")
    print("TEST 7: POST /api/mobility-platform/route (REGRESSION CHECK)")
    print(f"{'='*80}")
    
    route_request = {
        "pickup_lat": 52.5200,
        "pickup_lng": 13.4050,
        "dropoff_lat": 52.5163,
        "dropoff_lng": 13.3777,
        "pickup_address": "Alexanderplatz, Berlin",
        "dropoff_address": "Brandenburger Tor, Berlin"
    }
    
    response = requests.post(
        f"{API_URL}/mobility-platform/route",
        json=route_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/route (REGRESSION)",
            False,
            {"status_code": response.status_code, "error": response.text}
        )
    
    data = response.json()
    
    has_distance = "distance_km" in data
    has_duration = "duration_min" in data
    has_options = "options" in data and len(data.get("options", [])) > 0
    has_recommendations = "recommendations" in data
    
    passed = has_distance and has_duration and has_options and has_recommendations
    
    return log_test(
        "POST /api/mobility-platform/route (REGRESSION)",
        passed,
        {
            "status_code": response.status_code,
            "distance_km": data.get("distance_km"),
            "duration_min": data.get("duration_min"),
            "options_count": len(data.get("options", [])),
            "has_recommendations": has_recommendations,
            "no_regression": passed
        }
    )

def test_ai_recommendation_regression(cookies):
    """Test 8: POST /api/mobility-platform/ai-recommendation (Regression Check)"""
    print(f"\n{'='*80}")
    print("TEST 8: POST /api/mobility-platform/ai-recommendation (REGRESSION CHECK)")
    print(f"{'='*80}")
    
    ai_request = {
        "pickup_address": "Alexanderplatz, Berlin",
        "dropoff_address": "Brandenburger Tor, Berlin",
        "distance_km": 2.5,
        "duration_min": 6,
        "options": [
            {
                "type": "taxi",
                "label": "Taxi",
                "price_eur": 12.50,
                "duration_min": 6,
                "distance_km": 2.5,
                "eco_score": 60
            },
            {
                "type": "scooter",
                "label": "E-Scooter",
                "price_eur": 3.80,
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
        f"{API_URL}/mobility-platform/ai-recommendation",
        json=ai_request,
        cookies=cookies,
        timeout=30
    )
    
    if response.status_code != 200:
        return log_test(
            "POST /api/mobility-platform/ai-recommendation (REGRESSION)",
            False,
            {"status_code": response.status_code, "error": response.text}
        )
    
    data = response.json()
    
    has_available = "available" in data
    has_headline = "headline" in data
    has_summary = "summary" in data
    has_best_option = "best_option_type" in data
    has_provider = "provider" in data
    has_model = "model" in data
    
    passed = (
        has_available and
        data.get("available") == True and
        has_headline and
        has_summary and
        has_best_option and
        has_provider and
        has_model
    )
    
    return log_test(
        "POST /api/mobility-platform/ai-recommendation (REGRESSION)",
        passed,
        {
            "status_code": response.status_code,
            "available": data.get("available"),
            "provider": data.get("provider"),
            "model": data.get("model"),
            "best_option_type": data.get("best_option_type"),
            "headline": data.get("headline", "")[:100],
            "no_regression": passed
        }
    )

def main():
    """Run all tests"""
    print(f"\n{'='*80}")
    print("BIDBLITZ MOBILITY PLATFORM - FINAL BACKEND FLOW TESTING")
    print(f"Testing against: {BASE_URL}")
    print(f"{'='*80}")
    
    # Login
    cookies = login()
    if not cookies:
        print("\n❌ CRITICAL: Login failed. Cannot proceed with tests.")
        return
    
    # Run all tests
    test_get_preferences(cookies)
    test_post_preferences(cookies)
    
    # Checkout session tests for different payment methods
    test_checkout_session_qr(cookies)
    test_checkout_session_apple_pay(cookies)
    test_checkout_session_google_pay(cookies)
    test_checkout_session_nfc(cookies)
    
    # Wallet booking test
    wallet_passed, wallet_booking_id = test_wallet_booking(cookies)
    
    # Booking detail and cancellation tests (using wallet booking)
    if wallet_booking_id:
        test_get_booking_detail(cookies, wallet_booking_id)
        test_cancel_booking(cookies, wallet_booking_id)
    
    # Regression tests
    test_route_regression(cookies)
    test_ai_recommendation_regression(cookies)
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}")
    
    total_tests = len(test_results["tests"])
    passed_tests = sum(1 for t in test_results["tests"] if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    # List failed tests
    if failed_tests > 0:
        print(f"\n{'='*80}")
        print("FAILED TESTS:")
        print(f"{'='*80}")
        for test in test_results["tests"]:
            if not test["passed"]:
                print(f"❌ {test['test']}")
                print(f"   Details: {json.dumps(test['details'], indent=6, ensure_ascii=False)}")
    
    # Save results to file
    with open("/app/mobility_final_backend_test_results.json", "w", encoding="utf-8") as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*80}")
    print("Test results saved to: /app/mobility_final_backend_test_results.json")
    print(f"{'='*80}")
    
    # Determine which payment methods are active
    print(f"\n{'='*80}")
    print("ACTIVE PAYMENT METHODS:")
    print(f"{'='*80}")
    
    payment_methods = {
        "Wallet": wallet_passed,
        "QR Code": any(t["test"] == "POST /api/mobility-platform/checkout/session (QR)" and t["passed"] for t in test_results["tests"]),
        "Apple Pay": any(t["test"] == "POST /api/mobility-platform/checkout/session (Apple Pay)" and t["passed"] for t in test_results["tests"]),
        "Google Pay": any(t["test"] == "POST /api/mobility-platform/checkout/session (Google Pay)" and t["passed"] for t in test_results["tests"]),
        "NFC": any(t["test"] == "POST /api/mobility-platform/checkout/session (NFC)" and t["passed"] for t in test_results["tests"])
    }
    
    for method, active in payment_methods.items():
        status = "✅ ACTIVE" if active else "❌ INACTIVE"
        print(f"{status}: {method}")
    
    print(f"\n{'='*80}")
    print("PRODUCTION READINESS:")
    print(f"{'='*80}")
    
    all_critical_passed = (
        passed_tests == total_tests and
        wallet_passed
    )
    
    if all_critical_passed:
        print("✅ ALL TESTS PASSED - Backend flows are PRODUCTION-READY")
    else:
        print("⚠️  SOME TESTS FAILED - Review failed tests before production deployment")

if __name__ == "__main__":
    main()
