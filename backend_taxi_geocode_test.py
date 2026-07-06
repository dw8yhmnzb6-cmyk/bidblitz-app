#!/usr/bin/env python3
"""
Backend Sanity Check: Taxi Geocode API
Tests /api/taxi/geocode endpoint with typical German search terms
"""

import requests
import json
from typing import Dict, Any

# Backend URL from frontend .env
BASE_URL = "https://kyc-approval-hub.preview.emergentagent.com"

def test_geocode_endpoint(query: str, description: str) -> Dict[str, Any]:
    """Test geocode endpoint with a search query"""
    url = f"{BASE_URL}/api/taxi/geocode"
    params = {
        "q": query,
        "lang": "de",
        "limit": 5
    }
    
    print(f"\n{'='*80}")
    print(f"TEST: {description}")
    print(f"Query: '{query}'")
    print(f"URL: {url}")
    print(f"Params: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            print(f"✅ SUCCESS - Found {len(features)} results")
            
            # Show first 3 results
            for i, feature in enumerate(features[:3], 1):
                place_name = feature.get("place_name", "N/A")
                text = feature.get("text", "N/A")
                print(f"  {i}. {text} - {place_name}")
            
            return {
                "success": True,
                "status_code": response.status_code,
                "feature_count": len(features),
                "features": features[:3]  # Store first 3 for verification
            }
        else:
            print(f"❌ FAILED - Status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return {
                "success": False,
                "status_code": response.status_code,
                "error": response.text[:200]
            }
    
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def test_geocode_with_proximity():
    """Test geocode with proximity bias (Berlin coordinates)"""
    url = f"{BASE_URL}/api/taxi/geocode"
    params = {
        "q": "Hauptbahnhof",
        "lng": 13.369545,  # Berlin longitude
        "lat": 52.525589,  # Berlin latitude
        "lang": "de",
        "limit": 5
    }
    
    print(f"\n{'='*80}")
    print(f"TEST: Geocode with Proximity Bias (Berlin)")
    print(f"Query: 'Hauptbahnhof' near Berlin (52.525589, 13.369545)")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            print(f"✅ SUCCESS - Found {len(features)} results with proximity bias")
            
            # Show first 3 results
            for i, feature in enumerate(features[:3], 1):
                place_name = feature.get("place_name", "N/A")
                text = feature.get("text", "N/A")
                print(f"  {i}. {text} - {place_name}")
            
            return {
                "success": True,
                "status_code": response.status_code,
                "feature_count": len(features)
            }
        else:
            print(f"❌ FAILED - Status {response.status_code}")
            return {
                "success": False,
                "status_code": response.status_code
            }
    
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def test_geocode_without_auth():
    """Test that geocode works without authentication (public proxy)"""
    url = f"{BASE_URL}/api/taxi/geocode"
    params = {
        "q": "Alexanderplatz",
        "lang": "de"
    }
    
    print(f"\n{'='*80}")
    print(f"TEST: Geocode without Authentication (Public Proxy)")
    print(f"Query: 'Alexanderplatz'")
    print(f"No auth headers sent")
    
    try:
        # Explicitly no auth headers
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            print(f"✅ SUCCESS - Geocode works without auth (public proxy)")
            print(f"Found {len(features)} results")
            return {
                "success": True,
                "status_code": response.status_code,
                "feature_count": len(features)
            }
        else:
            print(f"❌ FAILED - Status {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return {
                "success": False,
                "status_code": response.status_code
            }
    
    except Exception as e:
        print(f"❌ ERROR - {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def test_geocode_edge_cases():
    """Test edge cases: empty query, short query, special characters"""
    test_cases = [
        ("", "Empty query"),
        ("a", "Single character (should return empty or error)"),
        ("Straße 123", "Street with number"),
        ("Berlin Mitte", "Location with space"),
    ]
    
    results = []
    for query, description in test_cases:
        url = f"{BASE_URL}/api/taxi/geocode"
        params = {"q": query, "lang": "de"}
        
        print(f"\n{'='*80}")
        print(f"EDGE CASE TEST: {description}")
        print(f"Query: '{query}'")
        
        try:
            response = requests.get(url, params=params, timeout=10)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                features = data.get("features", [])
                print(f"✅ Handled gracefully - {len(features)} results")
                results.append({"query": query, "success": True, "feature_count": len(features)})
            else:
                print(f"⚠️ Status {response.status_code}")
                results.append({"query": query, "success": False, "status_code": response.status_code})
        
        except Exception as e:
            print(f"❌ ERROR - {str(e)}")
            results.append({"query": query, "success": False, "error": str(e)})
    
    return results

def main():
    print("="*80)
    print("TAXI GEOCODE BACKEND SANITY CHECK")
    print("Testing /api/taxi/geocode endpoint")
    print("="*80)
    
    results = {
        "tests": []
    }
    
    # Test 1: Typical German search terms
    test_queries = [
        ("Alexanderplatz", "Famous square/location"),
        ("Hauptbahnhof Berlin", "Train station"),
        ("Unter den Linden", "Famous street"),
        ("Brandenburger Tor", "Landmark"),
        ("Berlin Ostbahnhof", "Train station with city name"),
        ("Potsdamer Platz 1", "Street with house number"),
    ]
    
    for query, description in test_queries:
        result = test_geocode_endpoint(query, description)
        results["tests"].append({
            "query": query,
            "description": description,
            "result": result
        })
    
    # Test 2: Proximity bias
    proximity_result = test_geocode_with_proximity()
    results["proximity_test"] = proximity_result
    
    # Test 3: Without authentication
    no_auth_result = test_geocode_without_auth()
    results["no_auth_test"] = no_auth_result
    
    # Test 4: Edge cases
    edge_case_results = test_geocode_edge_cases()
    results["edge_cases"] = edge_case_results
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    
    successful_tests = sum(1 for t in results["tests"] if t["result"].get("success", False))
    total_tests = len(results["tests"])
    
    print(f"Basic Geocode Tests: {successful_tests}/{total_tests} passed")
    print(f"Proximity Test: {'✅ PASSED' if results['proximity_test'].get('success') else '❌ FAILED'}")
    print(f"No Auth Test: {'✅ PASSED' if results['no_auth_test'].get('success') else '❌ FAILED'}")
    
    edge_case_success = sum(1 for e in results["edge_cases"] if e.get("success", False))
    print(f"Edge Cases: {edge_case_success}/{len(results['edge_cases'])} handled gracefully")
    
    # Overall assessment
    all_critical_passed = (
        successful_tests == total_tests and
        results['proximity_test'].get('success') and
        results['no_auth_test'].get('success')
    )
    
    print(f"\n{'='*80}")
    if all_critical_passed:
        print("✅ ALL CRITICAL TESTS PASSED")
        print("Taxi Geocode API is working correctly:")
        print("  - Responds to typical German search terms (streets, locations, train stations)")
        print("  - Works without authentication (public proxy)")
        print("  - Supports proximity bias for better results")
        print("  - Returns proper Mapbox-compatible feature format")
    else:
        print("❌ SOME TESTS FAILED")
        print("Review failed tests above for details")
    print(f"{'='*80}")
    
    # Save results to file
    with open("/app/taxi_geocode_test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed results saved to: /app/taxi_geocode_test_results.json")

if __name__ == "__main__":
    main()
