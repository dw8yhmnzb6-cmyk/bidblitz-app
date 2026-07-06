#!/usr/bin/env python3
"""
Backend Sanity Check: Auction Image Fix
Tests that auction endpoints return non-empty image_url after resolver fix
"""

import requests
import json
import sys

BASE_URL = "https://kyc-approval-hub.preview.emergentagent.com"

def test_active_auctions():
    """Test 1: GET /api/auctions/active returns auctions with non-empty image_url"""
    print("\n" + "="*70)
    print("TEST 1: GET /api/auctions/active")
    print("="*70)
    
    try:
        response = requests.get(f"{BASE_URL}/api/auctions/active", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 500:
            print("❌ FAIL: 500 Internal Server Error")
            print(f"Response: {response.text[:500]}")
            return False
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        auctions = data.get("auctions", [])
        
        print(f"Total auctions returned: {len(auctions)}")
        
        if len(auctions) == 0:
            print("⚠️  WARNING: No auctions returned (empty list)")
            return True  # Not a failure, just no data
        
        # Check first 5 auctions for non-empty image_url
        check_count = min(5, len(auctions))
        print(f"\nChecking first {check_count} auctions for image_url:")
        
        all_have_images = True
        for i, auction in enumerate(auctions[:check_count]):
            title = auction.get("title", "N/A")
            image_url = auction.get("image_url", "")
            auction_id = auction.get("auction_id", "N/A")
            
            has_image = bool(image_url and image_url.strip())
            status = "✅" if has_image else "❌"
            
            print(f"  {i+1}. {status} {title[:50]}")
            print(f"     ID: {auction_id}")
            print(f"     image_url: {image_url[:80] if image_url else '(empty)'}")
            
            if not has_image:
                all_have_images = False
        
        if all_have_images:
            print(f"\n✅ PASS: All {check_count} auctions have non-empty image_url")
            return True
        else:
            print(f"\n❌ FAIL: Some auctions have empty image_url")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        return False


def test_list_auctions():
    """Test 2: GET /api/auctions/list returns auctions with non-empty image_url"""
    print("\n" + "="*70)
    print("TEST 2: GET /api/auctions/list")
    print("="*70)
    
    try:
        response = requests.get(f"{BASE_URL}/api/auctions/list", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 500:
            print("❌ FAIL: 500 Internal Server Error")
            print(f"Response: {response.text[:500]}")
            return False
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        auctions = data.get("auctions", [])
        
        print(f"Total auctions returned: {len(auctions)}")
        
        if len(auctions) == 0:
            print("⚠️  WARNING: No auctions returned (empty list)")
            return True  # Not a failure, just no data
        
        # Check first 5 auctions for non-empty image_url
        check_count = min(5, len(auctions))
        print(f"\nChecking first {check_count} auctions for image_url:")
        
        all_have_images = True
        for i, auction in enumerate(auctions[:check_count]):
            title = auction.get("title", "N/A")
            image_url = auction.get("image_url", "")
            auction_id = auction.get("auction_id", "N/A")
            
            has_image = bool(image_url and image_url.strip())
            status = "✅" if has_image else "❌"
            
            print(f"  {i+1}. {status} {title[:50]}")
            print(f"     ID: {auction_id}")
            print(f"     image_url: {image_url[:80] if image_url else '(empty)'}")
            
            if not has_image:
                all_have_images = False
        
        if all_have_images:
            print(f"\n✅ PASS: All {check_count} auctions have non-empty image_url")
            return True
        else:
            print(f"\n❌ FAIL: Some auctions have empty image_url")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        return False


def test_feed_endpoint():
    """Test 3: GET /api/auctions/feed (alias for /list) - no 500 errors"""
    print("\n" + "="*70)
    print("TEST 3: GET /api/auctions/feed (no 500 errors)")
    print("="*70)
    
    try:
        response = requests.get(f"{BASE_URL}/api/auctions/feed", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 500:
            print("❌ FAIL: 500 Internal Server Error")
            print(f"Response: {response.text[:500]}")
            return False
        
        if response.status_code == 200:
            data = response.json()
            auctions = data.get("auctions", [])
            print(f"Total auctions returned: {len(auctions)}")
            print("✅ PASS: No 500 error, endpoint working")
            return True
        else:
            print(f"⚠️  WARNING: Got {response.status_code} (not 500, but not 200 either)")
            return True  # Not a 500, so resolver didn't crash
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        return False


def main():
    print("\n" + "="*70)
    print("BACKEND SANITY CHECK: Auction Image Fix")
    print("Testing: resolve_product_image() function in /api/auctions routes")
    print("="*70)
    
    results = {
        "test_1_active": test_active_auctions(),
        "test_2_list": test_list_auctions(),
        "test_3_feed_no_500": test_feed_endpoint(),
    }
    
    print("\n" + "="*70)
    print("FINAL RESULTS")
    print("="*70)
    
    print(f"Test 1 (GET /api/auctions/active): {'✅ PASS' if results['test_1_active'] else '❌ FAIL'}")
    print(f"Test 2 (GET /api/auctions/list): {'✅ PASS' if results['test_2_list'] else '❌ FAIL'}")
    print(f"Test 3 (GET /api/auctions/feed - no 500): {'✅ PASS' if results['test_3_feed_no_500'] else '❌ FAIL'}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*70)
    if all_passed:
        print("✅ ALL TESTS PASSED - Auction image resolver working correctly")
        print("="*70)
        return 0
    else:
        print("❌ SOME TESTS FAILED - See details above")
        print("="*70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
