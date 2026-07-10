#!/usr/bin/env python3
"""
BidBlitz Mobility P0 Backend Flow Testing
Tests against: https://swipe-match-chat-8.preview.emergentagent.com
Admin credentials: admin@bidblitz.com / BidBlitz2026!

Test Coverage:
1. GET /api/mobility-platform/payment-options - verify credit_card and cash present
2. Saved Locations CRUD - GET/POST/DELETE /api/mobility-platform/saved-locations
3. Recent Locations - GET/POST /api/mobility-platform/recent-locations
4. Cash Booking - POST /api/mobility-platform/book with cash payment (payment_status=cash_due)
5. Credit Card Checkout - POST /api/mobility-platform/checkout/session (checkout_url)
"""

import json
import httpx
from datetime import datetime

BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

results = {
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
    results["tests"].append(result)
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    print(f"Details: {details}")
    return passed

async def admin_login(client):
    """Login as admin and return session cookies"""
    print(f"\n🔐 Logging in as {ADMIN_EMAIL}...")
    response = await client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        raise Exception(f"Login failed: {response.status_code} - {response.text}")
    print(f"✅ Login successful")
    return response.cookies

async def test_payment_options(client, cookies):
    """Test 1: GET /api/mobility-platform/payment-options - verify credit_card and cash present"""
    test_name = "Payment Options - credit_card and cash present"
    try:
        response = await client.get(
            f"{BASE_URL}/api/mobility-platform/payment-options",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"Status {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Check structure
        if "methods" not in data:
            return log_test(test_name, False, f"Missing 'methods' field in response: {data}")
        
        methods = data["methods"]
        method_ids = [m["id"] for m in methods]
        
        # Check for credit_card
        if "credit_card" not in method_ids:
            return log_test(test_name, False, f"credit_card not found in methods: {method_ids}")
        
        # Check for cash
        if "cash" not in method_ids:
            return log_test(test_name, False, f"cash not found in methods: {method_ids}")
        
        # Find credit_card and cash details
        credit_card = next((m for m in methods if m["id"] == "credit_card"), None)
        cash = next((m for m in methods if m["id"] == "cash"), None)
        
        details = {
            "status_code": response.status_code,
            "wallet_balance": data.get("wallet_balance"),
            "total_methods": len(methods),
            "method_ids": method_ids,
            "credit_card": credit_card,
            "cash": cash
        }
        
        return log_test(test_name, True, json.dumps(details, indent=2))
        
    except Exception as e:
        return log_test(test_name, False, f"Exception: {str(e)}")

async def test_saved_locations_crud(client, cookies):
    """Test 2: Saved Locations CRUD - GET/POST/DELETE"""
    test_name = "Saved Locations CRUD"
    try:
        # Step 1: GET saved locations (initial state)
        response = await client.get(
            f"{BASE_URL}/api/mobility-platform/saved-locations",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"GET failed: {response.status_code} - {response.text}")
        
        initial_data = response.json()
        initial_count = len(initial_data.get("locations", []))
        
        # Step 2: POST new saved location
        new_location = {
            "label": "Test Favorite Location",
            "address": "Alexanderplatz, Berlin, Germany",
            "lat": 52.5200,
            "lng": 13.4050,
            "kind": "custom"
        }
        
        response = await client.post(
            f"{BASE_URL}/api/mobility-platform/saved-locations",
            json=new_location,
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"POST failed: {response.status_code} - {response.text}")
        
        post_data = response.json()
        if not post_data.get("ok"):
            return log_test(test_name, False, f"POST returned ok=false: {post_data}")
        
        created_location = post_data.get("location", {})
        favorite_id = created_location.get("favorite_id")
        
        if not favorite_id:
            return log_test(test_name, False, f"No favorite_id in POST response: {post_data}")
        
        # Step 3: GET saved locations again (should have +1)
        response = await client.get(
            f"{BASE_URL}/api/mobility-platform/saved-locations",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"GET after POST failed: {response.status_code}")
        
        after_post_data = response.json()
        after_post_count = len(after_post_data.get("locations", []))
        
        # Step 4: DELETE the created location
        response = await client.delete(
            f"{BASE_URL}/api/mobility-platform/saved-locations/{favorite_id}",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"DELETE failed: {response.status_code} - {response.text}")
        
        delete_data = response.json()
        if not delete_data.get("ok"):
            return log_test(test_name, False, f"DELETE returned ok=false: {delete_data}")
        
        # Step 5: GET saved locations again (should be back to initial count)
        response = await client.get(
            f"{BASE_URL}/api/mobility-platform/saved-locations",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"GET after DELETE failed: {response.status_code}")
        
        final_data = response.json()
        final_count = len(final_data.get("locations", []))
        
        details = {
            "initial_count": initial_count,
            "after_post_count": after_post_count,
            "final_count": final_count,
            "created_favorite_id": favorite_id,
            "crud_operations": "GET → POST → GET → DELETE → GET",
            "verification": f"Count increased by 1 after POST: {after_post_count == initial_count + 1}, Count back to initial after DELETE: {final_count == initial_count}"
        }
        
        # Verify CRUD worked correctly
        if after_post_count != initial_count + 1:
            return log_test(test_name, False, f"POST did not increase count: {details}")
        
        if final_count != initial_count:
            return log_test(test_name, False, f"DELETE did not restore count: {details}")
        
        return log_test(test_name, True, json.dumps(details, indent=2))
        
    except Exception as e:
        return log_test(test_name, False, f"Exception: {str(e)}")

async def test_recent_locations(client, cookies):
    """Test 3: Recent Locations - GET/POST"""
    test_name = "Recent Locations - GET/POST"
    try:
        # Step 1: POST new recent location
        recent_location = {
            "label": "Brandenburg Gate",
            "address": "Brandenburger Tor, Berlin, Germany",
            "lat": 52.5163,
            "lng": 13.3777,
            "kind": "place"
        }
        
        response = await client.post(
            f"{BASE_URL}/api/mobility-platform/recent-locations",
            json=recent_location,
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"POST failed: {response.status_code} - {response.text}")
        
        post_data = response.json()
        if not post_data.get("ok"):
            return log_test(test_name, False, f"POST returned ok=false: {post_data}")
        
        # Step 2: GET recent locations
        response = await client.get(
            f"{BASE_URL}/api/mobility-platform/recent-locations",
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"GET failed: {response.status_code} - {response.text}")
        
        data = response.json()
        
        if "locations" not in data:
            return log_test(test_name, False, f"Missing 'locations' field: {data}")
        
        locations = data["locations"]
        
        # Verify the posted location is in recent locations
        found = any(loc.get("address") == recent_location["address"] for loc in locations)
        
        details = {
            "post_status": "success",
            "get_status": "success",
            "recent_locations_count": len(locations),
            "posted_location_found": found,
            "sample_locations": locations[:3] if len(locations) > 0 else []
        }
        
        if not found:
            return log_test(test_name, False, f"Posted location not found in recent locations: {details}")
        
        return log_test(test_name, True, json.dumps(details, indent=2))
        
    except Exception as e:
        return log_test(test_name, False, f"Exception: {str(e)}")

async def test_cash_booking(client, cookies):
    """Test 4: Cash Booking - payment_status=cash_due"""
    test_name = "Cash Booking - payment_status=cash_due"
    try:
        booking_request = {
            "transport_type": "taxi",
            "transport_label": "Taxi",
            "price_eur": 12.50,
            "duration_min": 8,
            "distance_km": 2.5,
            "payment_method": "cash",
            "pickup": {
                "address": "Alexanderplatz, Berlin, Germany",
                "lat": 52.5200,
                "lng": 13.4050
            },
            "dropoff": {
                "address": "Brandenburg Gate, Berlin, Germany",
                "lat": 52.5163,
                "lng": 13.3777
            },
            "preferences": {},
            "ai_recommendation": {}
        }
        
        response = await client.post(
            f"{BASE_URL}/api/mobility-platform/book",
            json=booking_request,
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"Status {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Check response structure
        if not data.get("ok"):
            return log_test(test_name, False, f"Response ok=false: {data}")
        
        booking = data.get("booking", {})
        
        # Critical checks
        if booking.get("payment_method") != "cash":
            return log_test(test_name, False, f"payment_method is not 'cash': {booking.get('payment_method')}")
        
        if booking.get("payment_status") != "cash_due":
            return log_test(test_name, False, f"payment_status is not 'cash_due': {booking.get('payment_status')}")
        
        details = {
            "status_code": response.status_code,
            "ok": data.get("ok"),
            "booking_id": booking.get("booking_id"),
            "payment_method": booking.get("payment_method"),
            "payment_status": booking.get("payment_status"),
            "status": booking.get("status"),
            "transport_type": booking.get("transport_type"),
            "price_eur": booking.get("price_eur"),
            "verification": "payment_status=cash_due ✓"
        }
        
        return log_test(test_name, True, json.dumps(details, indent=2))
        
    except Exception as e:
        return log_test(test_name, False, f"Exception: {str(e)}")

async def test_credit_card_checkout(client, cookies):
    """Test 5: Credit Card Checkout - checkout_url present"""
    test_name = "Credit Card Checkout - checkout_url present"
    try:
        checkout_request = {
            "transport_type": "taxi",
            "payment_method": "credit_card",
            "origin_url": "https://swipe-match-chat-8.preview.emergentagent.com",
            "pickup": {
                "address": "Alexanderplatz, Berlin, Germany",
                "lat": 52.5200,
                "lng": 13.4050
            },
            "dropoff": {
                "address": "Brandenburg Gate, Berlin, Germany",
                "lat": 52.5163,
                "lng": 13.3777
            },
            "preferences": {},
            "ai_recommendation": {}
        }
        
        response = await client.post(
            f"{BASE_URL}/api/mobility-platform/checkout/session",
            json=checkout_request,
            cookies=cookies
        )
        
        if response.status_code != 200:
            return log_test(test_name, False, f"Status {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Critical checks
        if "checkout_url" not in data:
            return log_test(test_name, False, f"Missing 'checkout_url' in response: {data}")
        
        checkout_url = data.get("checkout_url")
        if not checkout_url or not checkout_url.startswith("http"):
            return log_test(test_name, False, f"Invalid checkout_url: {checkout_url}")
        
        # Verify it's a Stripe checkout URL
        if "checkout.stripe.com" not in checkout_url:
            return log_test(test_name, False, f"checkout_url is not a Stripe URL: {checkout_url}")
        
        details = {
            "status_code": response.status_code,
            "checkout_url": checkout_url,
            "session_id": data.get("session_id"),
            "booking_id": data.get("booking_id"),
            "verification": "checkout_url present and valid Stripe URL ✓"
        }
        
        return log_test(test_name, True, json.dumps(details, indent=2))
        
    except Exception as e:
        return log_test(test_name, False, f"Exception: {str(e)}")

async def main():
    """Run all Mobility P0 Backend Flow tests"""
    print("=" * 80)
    print("BidBlitz Mobility P0 Backend Flow Testing")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Test Date: {datetime.now().isoformat()}")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            # Login
            cookies = await admin_login(client)
            
            # Run all tests
            test_results = []
            test_results.append(await test_payment_options(client, cookies))
            test_results.append(await test_saved_locations_crud(client, cookies))
            test_results.append(await test_recent_locations(client, cookies))
            test_results.append(await test_cash_booking(client, cookies))
            test_results.append(await test_credit_card_checkout(client, cookies))
            
            # Summary
            print("\n" + "=" * 80)
            print("TEST SUMMARY")
            print("=" * 80)
            passed = sum(test_results)
            total = len(test_results)
            print(f"Total Tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {total - passed}")
            print(f"Success Rate: {(passed/total)*100:.1f}%")
            
            results["summary"] = {
                "total": total,
                "passed": passed,
                "failed": total - passed,
                "success_rate": f"{(passed/total)*100:.1f}%"
            }
            
            # Save results
            with open("/app/mobility_p0_test_results.json", "w") as f:
                json.dump(results, f, indent=2)
            print(f"\n✅ Results saved to /app/mobility_p0_test_results.json")
            
            return passed == total
            
        except Exception as e:
            print(f"\n❌ Fatal error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    exit(0 if success else 1)
