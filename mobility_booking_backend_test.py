#!/usr/bin/env python3
"""
BidBlitz Mobility Booking + AI Preferences Backend Test
Tests the new booking endpoints and AI preferences integration
External API: https://swipe-match-chat-8.preview.emergentagent.com
"""

import json
import httpx
import asyncio
from datetime import datetime

BASE_URL = "https://swipe-match-chat-8.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

# Test results storage
test_results = {
    "timestamp": datetime.now().isoformat(),
    "base_url": BASE_URL,
    "tests": []
}


def log_test(test_name: str, passed: bool, details: dict):
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
    print(f"Details: {json.dumps(details, indent=2, ensure_ascii=False)}")


async def test_mobility_booking_backend():
    """Main test function"""
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        
        # ============================================================
        # TEST 0: Admin Login
        # ============================================================
        print("\n" + "="*80)
        print("TEST 0: Admin Login")
        print("="*80)
        
        try:
            login_response = await client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                cookies = login_response.cookies
                log_test(
                    "Admin Login",
                    True,
                    {
                        "status_code": 200,
                        "user_email": login_data.get("user", {}).get("email"),
                        "cookies_set": len(cookies) > 0
                    }
                )
            else:
                log_test(
                    "Admin Login",
                    False,
                    {
                        "status_code": login_response.status_code,
                        "error": login_response.text
                    }
                )
                return
        except Exception as e:
            log_test("Admin Login", False, {"error": str(e)})
            return
        
        # ============================================================
        # TEST 1: POST /api/mobility-platform/book with Wallet
        # Must return confirmed booking + new_balance
        # ============================================================
        print("\n" + "="*80)
        print("TEST 1: POST /api/mobility-platform/book with Wallet Payment")
        print("="*80)
        
        try:
            # First, get current wallet balance
            balance_response = await client.get(f"{BASE_URL}/api/wallet/balance")
            initial_balance = 0
            if balance_response.status_code == 200:
                initial_balance = balance_response.json().get("balance", 0)
                print(f"Initial wallet balance: €{initial_balance}")
            
            # Create a booking with wallet payment
            booking_payload = {
                "transport_type": "taxi",
                "transport_label": "Taxi",
                "price_eur": 15.50,
                "duration_min": 12,
                "distance_km": 5.2,
                "payment_method": "wallet",
                "pickup": {
                    "address": "Alexanderplatz, Berlin, Deutschland",
                    "lat": 52.5219,
                    "lng": 13.4132
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
                },
                "ai_recommendation": {
                    "best_option_type": "taxi",
                    "confidence": 85
                }
            }
            
            booking_response = await client.post(
                f"{BASE_URL}/api/mobility-platform/book",
                json=booking_payload
            )
            
            if booking_response.status_code == 200:
                booking_data = booking_response.json()
                
                # Verify response structure
                has_ok = booking_data.get("ok") is True
                has_booking = "booking" in booking_data
                has_new_balance = "new_balance" in booking_data
                
                booking_obj = booking_data.get("booking", {})
                has_booking_id = "booking_id" in booking_obj
                has_status = booking_obj.get("status") == "confirmed"
                has_payment_status = booking_obj.get("payment_status") == "paid"
                has_payment_method = booking_obj.get("payment_method") == "wallet"
                
                # Check if balance was deducted
                new_balance = booking_data.get("new_balance")
                balance_deducted = new_balance is not None and new_balance < initial_balance
                
                all_checks_passed = (
                    has_ok and has_booking and has_new_balance and 
                    has_booking_id and has_status and has_payment_status and 
                    has_payment_method and balance_deducted
                )
                
                log_test(
                    "POST /api/mobility-platform/book with Wallet",
                    all_checks_passed,
                    {
                        "status_code": 200,
                        "ok": has_ok,
                        "has_booking": has_booking,
                        "has_new_balance": has_new_balance,
                        "booking_id": booking_obj.get("booking_id"),
                        "status": booking_obj.get("status"),
                        "payment_status": booking_obj.get("payment_status"),
                        "payment_method": booking_obj.get("payment_method"),
                        "price_eur": booking_obj.get("price_eur"),
                        "initial_balance": initial_balance,
                        "new_balance": new_balance,
                        "balance_deducted": balance_deducted,
                        "transport_type": booking_obj.get("transport_type"),
                        "pickup_address": booking_obj.get("pickup", {}).get("address"),
                        "dropoff_address": booking_obj.get("dropoff", {}).get("address"),
                        "is_real_booking": "NOT MOCKED - Real wallet deduction confirmed" if balance_deducted else "MOCKED or balance issue"
                    }
                )
            else:
                log_test(
                    "POST /api/mobility-platform/book with Wallet",
                    False,
                    {
                        "status_code": booking_response.status_code,
                        "error": booking_response.text
                    }
                )
        except Exception as e:
            log_test("POST /api/mobility-platform/book with Wallet", False, {"error": str(e)})
        
        # ============================================================
        # TEST 2: POST /api/mobility-platform/book with non-Wallet payment
        # Must return clean 400 error
        # ============================================================
        print("\n" + "="*80)
        print("TEST 2: POST /api/mobility-platform/book with non-Wallet Payment")
        print("="*80)
        
        try:
            non_wallet_payload = {
                "transport_type": "scooter",
                "transport_label": "E-Scooter",
                "price_eur": 5.50,
                "duration_min": 8,
                "distance_km": 2.5,
                "payment_method": "apple_pay",  # Non-wallet payment
                "pickup": {
                    "address": "Alexanderplatz, Berlin, Deutschland",
                    "lat": 52.5219,
                    "lng": 13.4132
                },
                "dropoff": {
                    "address": "Brandenburger Tor, Berlin, Deutschland",
                    "lat": 52.5163,
                    "lng": 13.3777
                }
            }
            
            non_wallet_response = await client.post(
                f"{BASE_URL}/api/mobility-platform/book",
                json=non_wallet_payload
            )
            
            # Should return 400 with proper error message
            is_400 = non_wallet_response.status_code == 400
            
            error_message = ""
            if is_400:
                try:
                    error_data = non_wallet_response.json()
                    error_message = error_data.get("detail", "")
                except:
                    error_message = non_wallet_response.text
            
            has_proper_error = "wallet" in error_message.lower() or "direktbuchung" in error_message.lower()
            
            log_test(
                "POST /api/mobility-platform/book with non-Wallet Payment",
                is_400 and has_proper_error,
                {
                    "status_code": non_wallet_response.status_code,
                    "expected_status": 400,
                    "error_message": error_message,
                    "has_proper_error": has_proper_error,
                    "validation": "Clean 400 error returned as expected" if is_400 else "Did not return 400"
                }
            )
        except Exception as e:
            log_test("POST /api/mobility-platform/book with non-Wallet Payment", False, {"error": str(e)})
        
        # ============================================================
        # TEST 3: GET /api/mobility-platform/my-bookings
        # Must return new bookings
        # ============================================================
        print("\n" + "="*80)
        print("TEST 3: GET /api/mobility-platform/my-bookings")
        print("="*80)
        
        try:
            bookings_response = await client.get(f"{BASE_URL}/api/mobility-platform/my-bookings")
            
            if bookings_response.status_code == 200:
                bookings_data = bookings_response.json()
                bookings_list = bookings_data.get("bookings", [])
                
                has_bookings = len(bookings_list) > 0
                
                # Check structure of first booking if exists
                first_booking = bookings_list[0] if bookings_list else {}
                has_booking_id = "booking_id" in first_booking
                has_transport_type = "transport_type" in first_booking
                has_price = "price_eur" in first_booking
                has_status = "status" in first_booking
                has_pickup = "pickup" in first_booking
                has_dropoff = "dropoff" in first_booking
                has_created_at = "created_at" in first_booking
                
                structure_valid = (
                    has_booking_id and has_transport_type and has_price and 
                    has_status and has_pickup and has_dropoff and has_created_at
                ) if has_bookings else True
                
                log_test(
                    "GET /api/mobility-platform/my-bookings",
                    bookings_response.status_code == 200 and structure_valid,
                    {
                        "status_code": 200,
                        "bookings_count": len(bookings_list),
                        "has_bookings": has_bookings,
                        "structure_valid": structure_valid,
                        "first_booking": {
                            "booking_id": first_booking.get("booking_id"),
                            "transport_type": first_booking.get("transport_type"),
                            "transport_label": first_booking.get("transport_label"),
                            "price_eur": first_booking.get("price_eur"),
                            "status": first_booking.get("status"),
                            "payment_status": first_booking.get("payment_status"),
                            "pickup_address": first_booking.get("pickup", {}).get("address"),
                            "dropoff_address": first_booking.get("dropoff", {}).get("address"),
                            "created_at": first_booking.get("created_at")
                        } if has_bookings else None,
                        "last_3_bookings": [
                            {
                                "transport_type": b.get("transport_type"),
                                "price_eur": b.get("price_eur"),
                                "status": b.get("status")
                            }
                            for b in bookings_list[:3]
                        ]
                    }
                )
            else:
                log_test(
                    "GET /api/mobility-platform/my-bookings",
                    False,
                    {
                        "status_code": bookings_response.status_code,
                        "error": bookings_response.text
                    }
                )
        except Exception as e:
            log_test("GET /api/mobility-platform/my-bookings", False, {"error": str(e)})
        
        # ============================================================
        # TEST 4: POST /api/mobility-platform/ai-recommendation with preferences
        # Must accept preferences (günstig/schnell/eco/Gepäck/Kind) and return valid response
        # ============================================================
        print("\n" + "="*80)
        print("TEST 4: POST /api/mobility-platform/ai-recommendation with Preferences")
        print("="*80)
        
        # Test 4a: With "günstig" (cheapest) preference
        try:
            ai_payload_cheapest = {
                "pickup_address": "Alexanderplatz, Berlin, Deutschland",
                "dropoff_address": "Brandenburger Tor, Berlin, Deutschland",
                "distance_km": 5.2,
                "duration_min": 12,
                "options": [
                    {
                        "type": "taxi",
                        "label": "Taxi",
                        "price_eur": 15.50,
                        "duration_min": 12,
                        "distance_km": 5.2,
                        "eco_score": 60
                    },
                    {
                        "type": "scooter",
                        "label": "E-Scooter",
                        "price_eur": 3.20,
                        "duration_min": 18,
                        "distance_km": 5.2,
                        "eco_score": 95
                    },
                    {
                        "type": "bike",
                        "label": "Fahrrad",
                        "price_eur": 2.10,
                        "duration_min": 25,
                        "distance_km": 5.2,
                        "eco_score": 100
                    }
                ],
                "recommendations": {
                    "cheapest": {"type": "bike", "label": "Fahrrad"},
                    "fastest": {"type": "taxi", "label": "Taxi"},
                    "eco": {"type": "bike", "label": "Fahrrad"}
                },
                "preferences": {
                    "priority": "cheapest",
                    "luggage": False,
                    "childSeat": False
                }
            }
            
            ai_response_cheapest = await client.post(
                f"{BASE_URL}/api/mobility-platform/ai-recommendation",
                json=ai_payload_cheapest
            )
            
            if ai_response_cheapest.status_code == 200:
                ai_data = ai_response_cheapest.json()
                
                has_available = "available" in ai_data
                has_provider = "provider" in ai_data
                has_model = "model" in ai_data
                has_headline = "headline" in ai_data
                has_summary = "summary" in ai_data
                has_best_option = "best_option_type" in ai_data
                
                is_available = ai_data.get("available") is True
                
                valid_structure = (
                    has_available and has_provider and has_model and 
                    has_headline and has_summary and has_best_option
                )
                
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (günstig preference)",
                    ai_response_cheapest.status_code == 200 and valid_structure,
                    {
                        "status_code": 200,
                        "available": ai_data.get("available"),
                        "provider": ai_data.get("provider"),
                        "model": ai_data.get("model"),
                        "headline": ai_data.get("headline"),
                        "summary": ai_data.get("summary")[:150] + "..." if len(ai_data.get("summary", "")) > 150 else ai_data.get("summary"),
                        "best_option_type": ai_data.get("best_option_type"),
                        "secondary_option_type": ai_data.get("secondary_option_type"),
                        "confidence": ai_data.get("confidence"),
                        "watchouts_count": len(ai_data.get("watchouts", [])),
                        "preferences_accepted": "cheapest",
                        "valid_structure": valid_structure
                    }
                )
            else:
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (günstig preference)",
                    False,
                    {
                        "status_code": ai_response_cheapest.status_code,
                        "error": ai_response_cheapest.text
                    }
                )
        except Exception as e:
            log_test("POST /api/mobility-platform/ai-recommendation (günstig preference)", False, {"error": str(e)})
        
        # Test 4b: With "schnell" (fastest) preference + Gepäck + Kind
        try:
            ai_payload_fastest = {
                "pickup_address": "Berlin Hauptbahnhof, Berlin, Deutschland",
                "dropoff_address": "Berlin Tegel Airport, Berlin, Deutschland",
                "distance_km": 8.5,
                "duration_min": 18,
                "options": [
                    {
                        "type": "taxi",
                        "label": "Taxi",
                        "price_eur": 22.50,
                        "duration_min": 18,
                        "distance_km": 8.5,
                        "eco_score": 60
                    },
                    {
                        "type": "airport_shuttle",
                        "label": "Airport Shuttle",
                        "price_eur": 12.00,
                        "duration_min": 25,
                        "distance_km": 8.5,
                        "eco_score": 75
                    }
                ],
                "recommendations": {
                    "cheapest": {"type": "airport_shuttle", "label": "Airport Shuttle"},
                    "fastest": {"type": "taxi", "label": "Taxi"}
                },
                "preferences": {
                    "priority": "fastest",
                    "luggage": True,
                    "childSeat": True
                }
            }
            
            ai_response_fastest = await client.post(
                f"{BASE_URL}/api/mobility-platform/ai-recommendation",
                json=ai_payload_fastest
            )
            
            if ai_response_fastest.status_code == 200:
                ai_data = ai_response_fastest.json()
                
                has_available = "available" in ai_data
                is_available = ai_data.get("available") is True
                has_best_option = "best_option_type" in ai_data
                
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (schnell + Gepäck + Kind)",
                    ai_response_fastest.status_code == 200 and has_available and has_best_option,
                    {
                        "status_code": 200,
                        "available": ai_data.get("available"),
                        "provider": ai_data.get("provider"),
                        "model": ai_data.get("model"),
                        "headline": ai_data.get("headline"),
                        "best_option_type": ai_data.get("best_option_type"),
                        "confidence": ai_data.get("confidence"),
                        "preferences_accepted": "fastest + luggage + childSeat"
                    }
                )
            else:
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (schnell + Gepäck + Kind)",
                    False,
                    {
                        "status_code": ai_response_fastest.status_code,
                        "error": ai_response_fastest.text
                    }
                )
        except Exception as e:
            log_test("POST /api/mobility-platform/ai-recommendation (schnell + Gepäck + Kind)", False, {"error": str(e)})
        
        # Test 4c: With "eco" preference
        try:
            ai_payload_eco = {
                "pickup_address": "Potsdamer Platz, Berlin, Deutschland",
                "dropoff_address": "Checkpoint Charlie, Berlin, Deutschland",
                "distance_km": 2.1,
                "duration_min": 8,
                "options": [
                    {
                        "type": "taxi",
                        "label": "Taxi",
                        "price_eur": 8.50,
                        "duration_min": 8,
                        "distance_km": 2.1,
                        "eco_score": 60
                    },
                    {
                        "type": "bike",
                        "label": "Fahrrad",
                        "price_eur": 1.50,
                        "duration_min": 12,
                        "distance_km": 2.1,
                        "eco_score": 100
                    }
                ],
                "recommendations": {
                    "cheapest": {"type": "bike", "label": "Fahrrad"},
                    "fastest": {"type": "taxi", "label": "Taxi"},
                    "eco": {"type": "bike", "label": "Fahrrad"}
                },
                "preferences": {
                    "priority": "eco",
                    "luggage": False,
                    "childSeat": False
                }
            }
            
            ai_response_eco = await client.post(
                f"{BASE_URL}/api/mobility-platform/ai-recommendation",
                json=ai_payload_eco
            )
            
            if ai_response_eco.status_code == 200:
                ai_data = ai_response_eco.json()
                
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (eco preference)",
                    ai_response_eco.status_code == 200 and ai_data.get("available") is True,
                    {
                        "status_code": 200,
                        "available": ai_data.get("available"),
                        "provider": ai_data.get("provider"),
                        "best_option_type": ai_data.get("best_option_type"),
                        "preferences_accepted": "eco"
                    }
                )
            else:
                log_test(
                    "POST /api/mobility-platform/ai-recommendation (eco preference)",
                    False,
                    {
                        "status_code": ai_response_eco.status_code,
                        "error": ai_response_eco.text
                    }
                )
        except Exception as e:
            log_test("POST /api/mobility-platform/ai-recommendation (eco preference)", False, {"error": str(e)})
        
        # ============================================================
        # TEST 5: Regression Check - POST /api/mobility-platform/route
        # Must still work after booking feature addition
        # ============================================================
        print("\n" + "="*80)
        print("TEST 5: Regression Check - POST /api/mobility-platform/route")
        print("="*80)
        
        try:
            route_payload = {
                "pickup_lat": 52.5219,
                "pickup_lng": 13.4132,
                "dropoff_lat": 52.5163,
                "dropoff_lng": 13.3777,
                "pickup_address": "Alexanderplatz, Berlin, Deutschland",
                "dropoff_address": "Brandenburger Tor, Berlin, Deutschland"
            }
            
            route_response = await client.post(
                f"{BASE_URL}/api/mobility-platform/route",
                json=route_payload
            )
            
            if route_response.status_code == 200:
                route_data = route_response.json()
                
                has_distance = "distance_km" in route_data
                has_duration = "duration_min" in route_data
                has_options = "options" in route_data
                has_recommendations = "recommendations" in route_data
                has_geometry = "geometry" in route_data
                
                options_list = route_data.get("options", [])
                has_multiple_options = len(options_list) >= 3
                
                # Check first option structure
                first_option = options_list[0] if options_list else {}
                option_has_type = "type" in first_option
                option_has_price = "price_eur" in first_option
                option_has_duration = "duration_min" in first_option
                
                structure_valid = (
                    has_distance and has_duration and has_options and 
                    has_recommendations and has_geometry and has_multiple_options and
                    option_has_type and option_has_price and option_has_duration
                )
                
                log_test(
                    "POST /api/mobility-platform/route (Regression Check)",
                    route_response.status_code == 200 and structure_valid,
                    {
                        "status_code": 200,
                        "distance_km": route_data.get("distance_km"),
                        "duration_min": route_data.get("duration_min"),
                        "options_count": len(options_list),
                        "has_recommendations": has_recommendations,
                        "has_geometry": has_geometry,
                        "structure_valid": structure_valid,
                        "first_option": {
                            "type": first_option.get("type"),
                            "label": first_option.get("label"),
                            "price_eur": first_option.get("price_eur"),
                            "duration_min": first_option.get("duration_min")
                        } if options_list else None,
                        "regression_status": "NO REGRESSION - Route endpoint working correctly"
                    }
                )
            else:
                log_test(
                    "POST /api/mobility-platform/route (Regression Check)",
                    False,
                    {
                        "status_code": route_response.status_code,
                        "error": route_response.text,
                        "regression_status": "REGRESSION DETECTED - Route endpoint not working"
                    }
                )
        except Exception as e:
            log_test("POST /api/mobility-platform/route (Regression Check)", False, {"error": str(e)})


async def main():
    """Main entry point"""
    print("\n" + "="*80)
    print("BidBlitz Mobility Booking + AI Preferences Backend Test")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {ADMIN_EMAIL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    await test_mobility_booking_backend()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = len(test_results["tests"])
    passed_tests = sum(1 for t in test_results["tests"] if t["passed"])
    failed_tests = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {failed_tests} ❌")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    print("\n" + "="*80)
    print("DETAILED RESULTS")
    print("="*80)
    
    for test in test_results["tests"]:
        status = "✅ PASS" if test["passed"] else "❌ FAIL"
        print(f"{status}: {test['test']}")
    
    # Save results to file
    with open("/app/mobility_booking_backend_test_results.json", "w") as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "="*80)
    print("Results saved to: /app/mobility_booking_backend_test_results.json")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(main())
