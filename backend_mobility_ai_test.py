#!/usr/bin/env python3
"""
BidBlitz Mobility AI Integration Backend Testing
Tests the new AI recommendation endpoint and regression checks for existing endpoints
External Preview URL: https://game-center-hub-1.preview.emergentagent.com
"""

import json
import requests
from datetime import datetime

BASE_URL = "https://game-center-hub-1.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

test_results = {
    "test_suite": "BidBlitz Mobility AI Integration Backend",
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
    test_results["tests"].append(result)
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    print(f"Details: {json.dumps(details, indent=2, ensure_ascii=False)}")
    return passed

def login_admin():
    """Login as admin and return session"""
    print(f"\n{'='*80}")
    print("LOGGING IN AS ADMIN")
    print(f"{'='*80}")
    
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200:
        print(f"✅ Admin login successful: {ADMIN_EMAIL}")
        return session
    else:
        print(f"❌ Admin login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def test_ai_recommendation_with_realistic_data(session):
    """
    TEST 1: POST /api/mobility-platform/ai-recommendation with realistic route data
    Should return valid AI response with available=true, provider, model, headline, summary, best_option_type
    """
    print(f"\n{'='*80}")
    print("TEST 1: AI Recommendation with Realistic Route Data")
    print(f"{'='*80}")
    
    # Realistic route data: Berlin Alexanderplatz to Brandenburg Gate (2.5 km)
    payload = {
        "pickup_address": "Alexanderplatz, Berlin, Deutschland",
        "dropoff_address": "Brandenburger Tor, Berlin, Deutschland",
        "distance_km": 2.5,
        "duration_min": 8,
        "options": [
            {
                "type": "taxi",
                "label": "Taxi",
                "icon": "car-front",
                "price_eur": 5.28,
                "duration_min": 8,
                "distance_km": 2.5,
                "wallet_only": False,
                "eco_score": 55,
                "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
            },
            {
                "type": "scooter",
                "label": "E-Scooter",
                "icon": "zap",
                "price_eur": 1.18,
                "duration_min": 10,
                "distance_km": 2.5,
                "wallet_only": True,
                "eco_score": 86,
                "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
            },
            {
                "type": "bike",
                "label": "Fahrrad",
                "icon": "bike",
                "price_eur": 0.84,
                "duration_min": 12,
                "distance_km": 2.5,
                "wallet_only": True,
                "eco_score": 96,
                "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
            },
            {
                "type": "car_rental",
                "label": "Mietwagen",
                "icon": "car",
                "price_eur": 9.70,
                "duration_min": 8,
                "distance_km": 2.5,
                "wallet_only": False,
                "eco_score": 48,
                "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
            },
            {
                "type": "vip",
                "label": "VIP Chauffeur",
                "icon": "crown",
                "price_eur": 16.16,
                "duration_min": 7,
                "distance_km": 2.5,
                "wallet_only": False,
                "eco_score": 28,
                "payment_methods": ["wallet", "nfc", "qr", "apple_pay", "google_pay"]
            }
        ],
        "recommendations": {
            "cheapest": {"type": "bike", "label": "Fahrrad", "reason": "Günstigste Option"},
            "fastest": {"type": "vip", "label": "VIP Chauffeur", "reason": "Schnellste Ankunft"},
            "balance": {"type": "scooter", "label": "E-Scooter", "reason": "Beste Balance aus Preis und Zeit"},
            "eco": {"type": "bike", "label": "Fahrrad", "reason": "Niedrigste Emissionen"}
        }
    }
    
    response = session.post(
        f"{BASE_URL}/api/mobility-platform/ai-recommendation",
        json=payload
    )
    
    details = {
        "status_code": response.status_code,
        "request_payload": payload
    }
    
    if response.status_code == 200:
        data = response.json()
        details["response"] = data
        
        # Check required fields
        required_fields = ["available", "provider", "model", "headline", "summary", "best_option_type"]
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            details["error"] = f"Missing required fields: {missing_fields}"
            return log_test("AI Recommendation with Realistic Data", False, details)
        
        # Check if AI is available
        if not data.get("available"):
            details["warning"] = "AI returned available=false"
            details["ai_error"] = data.get("error", "No error message")
            return log_test("AI Recommendation with Realistic Data", False, details)
        
        # Validate response structure
        checks = {
            "available_is_true": data.get("available") == True,
            "has_provider": data.get("provider") is not None,
            "has_model": data.get("model") is not None,
            "has_headline": bool(data.get("headline")),
            "has_summary": bool(data.get("summary")),
            "has_best_option_type": data.get("best_option_type") is not None,
            "provider_in_fallback_chain": data.get("provider") in ["openai", "gemini", "anthropic"],
            "best_option_valid": data.get("best_option_type") in ["taxi", "scooter", "bike", "car_rental", "airport_shuttle", "vip"]
        }
        details["validation_checks"] = checks
        
        all_passed = all(checks.values())
        return log_test("AI Recommendation with Realistic Data", all_passed, details)
    else:
        details["error"] = response.text
        return log_test("AI Recommendation with Realistic Data", False, details)

def test_ai_recommendation_empty_options(session):
    """
    TEST 2: POST /api/mobility-platform/ai-recommendation with empty options array
    Should return 400 error
    """
    print(f"\n{'='*80}")
    print("TEST 2: AI Recommendation with Empty Options Array")
    print(f"{'='*80}")
    
    payload = {
        "pickup_address": "Alexanderplatz, Berlin, Deutschland",
        "dropoff_address": "Brandenburger Tor, Berlin, Deutschland",
        "distance_km": 2.5,
        "duration_min": 8,
        "options": []  # Empty options array
    }
    
    response = session.post(
        f"{BASE_URL}/api/mobility-platform/ai-recommendation",
        json=payload
    )
    
    details = {
        "status_code": response.status_code,
        "request_payload": payload
    }
    
    if response.status_code == 400:
        details["response"] = response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
        details["validation"] = "Correctly returns 400 for empty options array"
        return log_test("AI Recommendation with Empty Options", True, details)
    else:
        details["error"] = f"Expected 400, got {response.status_code}"
        details["response"] = response.text
        return log_test("AI Recommendation with Empty Options", False, details)

def test_search_endpoint_regression(session):
    """
    TEST 3: GET /api/mobility-platform/search regression check
    Should still work after AI integration
    """
    print(f"\n{'='*80}")
    print("TEST 3: Search Endpoint Regression Check")
    print(f"{'='*80}")
    
    response = session.get(
        f"{BASE_URL}/api/mobility-platform/search",
        params={"q": "Alexanderplatz Berlin", "lang": "de", "limit": 5}
    )
    
    details = {
        "status_code": response.status_code,
        "query": "Alexanderplatz Berlin"
    }
    
    if response.status_code == 200:
        data = response.json()
        details["response"] = data
        details["results_count"] = len(data.get("results", []))
        
        checks = {
            "has_results_key": "results" in data,
            "results_is_list": isinstance(data.get("results"), list),
            "has_results": len(data.get("results", [])) > 0
        }
        details["validation_checks"] = checks
        
        all_passed = all(checks.values())
        return log_test("Search Endpoint Regression", all_passed, details)
    else:
        details["error"] = response.text
        return log_test("Search Endpoint Regression", False, details)

def test_route_endpoint_regression(session):
    """
    TEST 4: POST /api/mobility-platform/route regression check
    Should still work after AI integration
    """
    print(f"\n{'='*80}")
    print("TEST 4: Route Endpoint Regression Check")
    print(f"{'='*80}")
    
    # Berlin Alexanderplatz to Brandenburg Gate
    payload = {
        "pickup_lat": 52.5219,
        "pickup_lng": 13.4132,
        "dropoff_lat": 52.5163,
        "dropoff_lng": 13.3777,
        "pickup_address": "Alexanderplatz, Berlin",
        "dropoff_address": "Brandenburger Tor, Berlin"
    }
    
    response = session.post(
        f"{BASE_URL}/api/mobility-platform/route",
        json=payload
    )
    
    details = {
        "status_code": response.status_code,
        "request_payload": payload
    }
    
    if response.status_code == 200:
        data = response.json()
        details["response"] = {
            "distance_km": data.get("distance_km"),
            "duration_min": data.get("duration_min"),
            "options_count": len(data.get("options", [])),
            "has_recommendations": "recommendations" in data
        }
        
        checks = {
            "has_distance": "distance_km" in data,
            "has_duration": "duration_min" in data,
            "has_options": "options" in data and len(data.get("options", [])) > 0,
            "has_recommendations": "recommendations" in data,
            "has_geometry": "geometry" in data,
            "has_pickup": "pickup" in data,
            "has_dropoff": "dropoff" in data
        }
        details["validation_checks"] = checks
        
        all_passed = all(checks.values())
        return log_test("Route Endpoint Regression", all_passed, details)
    else:
        details["error"] = response.text
        return log_test("Route Endpoint Regression", False, details)

def test_nearby_endpoint_regression(session):
    """
    TEST 5: GET /api/mobility-platform/nearby regression check
    Should still work after AI integration
    """
    print(f"\n{'='*80}")
    print("TEST 5: Nearby Endpoint Regression Check")
    print(f"{'='*80}")
    
    # Berlin Alexanderplatz coordinates
    response = session.get(
        f"{BASE_URL}/api/mobility-platform/nearby",
        params={"lat": 52.5219, "lng": 13.4132, "radius": 5.0}
    )
    
    details = {
        "status_code": response.status_code,
        "query": "lat=52.5219, lng=13.4132, radius=5.0"
    }
    
    if response.status_code == 200:
        data = response.json()
        details["response"] = {
            "center": data.get("center"),
            "radius_km": data.get("radius_km"),
            "counts": data.get("counts"),
            "markers_count": len(data.get("markers", [])),
            "available_modes_count": len(data.get("available_modes", []))
        }
        
        checks = {
            "has_center": "center" in data,
            "has_radius": "radius_km" in data,
            "has_counts": "counts" in data,
            "has_markers": "markers" in data,
            "has_available_modes": "available_modes" in data,
            "available_modes_is_list": isinstance(data.get("available_modes"), list)
        }
        details["validation_checks"] = checks
        
        all_passed = all(checks.values())
        return log_test("Nearby Endpoint Regression", all_passed, details)
    else:
        details["error"] = response.text
        return log_test("Nearby Endpoint Regression", False, details)

def test_fallback_chain_configuration():
    """
    TEST 6: Verify fallback chain configuration
    Check that AI_MODEL_FALLBACKS is properly configured in backend code
    """
    print(f"\n{'='*80}")
    print("TEST 6: Fallback Chain Configuration Check")
    print(f"{'='*80}")
    
    # Read the backend code to verify fallback chain
    try:
        with open("/app/backend/routes/mobility_platform.py", "r") as f:
            code = f.read()
        
        # Check for AI_MODEL_FALLBACKS definition
        if "AI_MODEL_FALLBACKS" in code:
            # Extract the fallback chain
            import re
            match = re.search(r'AI_MODEL_FALLBACKS\s*=\s*\[(.*?)\]', code, re.DOTALL)
            if match:
                fallback_str = match.group(1)
                details = {
                    "fallback_chain_found": True,
                    "fallback_definition": fallback_str.strip(),
                    "expected_providers": ["openai", "gemini", "anthropic"],
                    "expected_models": ["gpt-5.2", "gemini-3-flash-preview", "claude-sonnet-4-5-20250929"]
                }
                
                # Check if all expected providers are present
                checks = {
                    "has_openai": "openai" in fallback_str,
                    "has_gemini": "gemini" in fallback_str,
                    "has_anthropic": "anthropic" in fallback_str,
                    "has_gpt_5_2": "gpt-5.2" in fallback_str,
                    "has_gemini_3_flash": "gemini-3-flash-preview" in fallback_str,
                    "has_claude_sonnet": "claude-sonnet-4-5" in fallback_str
                }
                details["validation_checks"] = checks
                
                all_passed = all(checks.values())
                return log_test("Fallback Chain Configuration", all_passed, details)
            else:
                details = {"error": "AI_MODEL_FALLBACKS found but could not parse"}
                return log_test("Fallback Chain Configuration", False, details)
        else:
            details = {"error": "AI_MODEL_FALLBACKS not found in code"}
            return log_test("Fallback Chain Configuration", False, details)
    except Exception as e:
        details = {"error": f"Failed to read backend code: {str(e)}"}
        return log_test("Fallback Chain Configuration", False, details)

def main():
    """Run all tests"""
    print(f"\n{'='*80}")
    print("BIDBLITZ MOBILITY AI INTEGRATION BACKEND TESTING")
    print(f"{'='*80}")
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Login
    session = login_admin()
    if not session:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Run tests
    results = []
    results.append(test_ai_recommendation_with_realistic_data(session))
    results.append(test_ai_recommendation_empty_options(session))
    results.append(test_search_endpoint_regression(session))
    results.append(test_route_endpoint_regression(session))
    results.append(test_nearby_endpoint_regression(session))
    results.append(test_fallback_chain_configuration())
    
    # Summary
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}")
    
    passed = sum(results)
    total = len(results)
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    test_results["summary"] = {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "success_rate": f"{success_rate:.1f}%"
    }
    
    # Save results to file
    output_file = "/app/mobility_ai_backend_test_results.json"
    with open(output_file, "w") as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Test results saved to: {output_file}")
    
    # Print individual test results
    print(f"\n{'='*80}")
    print("INDIVIDUAL TEST RESULTS")
    print(f"{'='*80}")
    for i, test in enumerate(test_results["tests"], 1):
        status = "✅ PASSED" if test["passed"] else "❌ FAILED"
        print(f"{i}. {status}: {test['test']}")
    
    if passed == total:
        print(f"\n{'='*80}")
        print("🎉 ALL TESTS PASSED! MOBILITY AI INTEGRATION IS WORKING CORRECTLY!")
        print(f"{'='*80}")
    else:
        print(f"\n{'='*80}")
        print("⚠️  SOME TESTS FAILED. PLEASE REVIEW THE RESULTS ABOVE.")
        print(f"{'='*80}")

if __name__ == "__main__":
    main()
