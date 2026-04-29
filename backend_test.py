#!/usr/bin/env python3
"""
BidBlitz V2 - KYC System Backend Testing
Tests KYC endpoints and gating functionality for wallet and auctions.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://super-app-preview-3.preview.emergentagent.com/api"
TEST_USER_EMAIL = "kunde@bidblitz.com"
TEST_USER_PASSWORD = "Kunde2026!"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

class KYCTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def login_user(self, email, password):
        """Login and return session cookies"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": email,
                "password": password
            })
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(f"Login {email}", True, f"Logged in as {data.get('user', {}).get('name', 'User')}")
                return True
            else:
                self.log_test(f"Login {email}", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test(f"Login {email}", False, f"Exception: {str(e)}")
            return False
    
    def test_kyc_status_endpoint(self):
        """Test GET /api/kyc/status endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/kyc/status")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["kyc_verified", "kyc_status", "can_use_features"]
                
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    self.log_test("KYC Status Endpoint", False, f"Missing fields: {missing_fields}")
                    return False
                    
                # Check can_use_features structure
                features = data.get("can_use_features", {})
                expected_features = ["wallet_topup", "wallet_send", "place_bids", "browse"]
                missing_features = [f for f in expected_features if f not in features]
                
                if missing_features:
                    self.log_test("KYC Status Endpoint", False, f"Missing features: {missing_features}")
                    return False
                    
                self.log_test("KYC Status Endpoint", True, 
                             f"Status: {data['kyc_status']}, Verified: {data['kyc_verified']}")
                return data
                
            else:
                self.log_test("KYC Status Endpoint", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("KYC Status Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_kyc_submit_endpoint_validation(self):
        """Test KYC submit endpoint validation (without actual file upload)"""
        try:
            # Test without files - should return validation error
            response = self.session.post(f"{BASE_URL}/kyc/submit")
            
            if response.status_code == 422:  # Validation error expected
                self.log_test("KYC Submit Validation", True, "Correctly rejects empty submission")
                return True
            else:
                self.log_test("KYC Submit Validation", False, 
                             f"Expected 422, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("KYC Submit Validation", False, f"Exception: {str(e)}")
            return False
    
    def test_wallet_kyc_gating(self):
        """Test wallet endpoints require KYC verification"""
        # Test topup endpoint
        try:
            response = self.session.post(f"{BASE_URL}/wallet/topup", json={
                "amount": 10.0,
                "payment_method": "test"
            })
            
            if response.status_code == 403:
                data = response.json()
                if "kyc_required" in str(data.get("detail", {})):
                    self.log_test("Wallet Topup KYC Gating", True, "Correctly blocks topup without KYC")
                else:
                    self.log_test("Wallet Topup KYC Gating", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Wallet Topup KYC Gating", False, 
                             f"Expected 403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Wallet Topup KYC Gating", False, f"Exception: {str(e)}")
            return False
        
        # Test send money endpoint
        try:
            response = self.session.post(f"{BASE_URL}/wallet/send", json={
                "recipient_email": "test@example.com",
                "amount": 5.0,
                "note": "Test transfer"
            })
            
            if response.status_code == 403:
                data = response.json()
                if "kyc_required" in str(data.get("detail", {})):
                    self.log_test("Wallet Send KYC Gating", True, "Correctly blocks send without KYC")
                    return True
                else:
                    self.log_test("Wallet Send KYC Gating", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Wallet Send KYC Gating", False, 
                             f"Expected 403, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Wallet Send KYC Gating", False, f"Exception: {str(e)}")
            return False
    
    def test_auction_kyc_gating(self):
        """Test auction bidding requires KYC verification"""
        try:
            # First get an active auction
            response = self.session.get(f"{BASE_URL}/auctions/active")
            
            if response.status_code != 200:
                self.log_test("Auction KYC Gating", False, "Could not fetch active auctions")
                return False
                
            auctions = response.json().get("auctions", [])
            if not auctions:
                self.log_test("Auction KYC Gating", False, "No active auctions found")
                return False
                
            auction_id = auctions[0]["auction_id"]
            
            # Try to place a bid
            response = self.session.post(f"{BASE_URL}/auctions/bid", json={
                "auction_id": auction_id
            })
            
            if response.status_code == 403:
                data = response.json()
                if "kyc_required" in str(data.get("detail", {})):
                    self.log_test("Auction Bidding KYC Gating", True, "Correctly blocks bidding without KYC")
                    return True
                else:
                    self.log_test("Auction Bidding KYC Gating", False, f"Wrong error message: {data}")
                    return False
            else:
                self.log_test("Auction Bidding KYC Gating", False, 
                             f"Expected 403, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Auction Bidding KYC Gating", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_kyc_endpoints(self):
        """Test admin KYC management endpoints"""
        # Login as admin
        if not self.login_user(ADMIN_EMAIL, ADMIN_PASSWORD):
            self.log_test("Admin KYC Endpoints", False, "Could not login as admin")
            return False
            
        try:
            # Test admin list endpoint
            response = self.session.get(f"{BASE_URL}/kyc/admin/list")
            
            if response.status_code == 200:
                data = response.json()
                if "reviews" in data:
                    self.log_test("Admin KYC List", True, f"Found {len(data['reviews'])} KYC reviews")
                else:
                    self.log_test("Admin KYC List", False, "Missing 'reviews' field")
                    return False
            else:
                self.log_test("Admin KYC List", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Admin KYC Endpoints", False, f"Exception: {str(e)}")
            return False
            
        return True
    
    def test_authentication_required(self):
        """Test that KYC endpoints require authentication"""
        # Create a new session without login
        unauth_session = requests.Session()
        
        try:
            response = unauth_session.get(f"{BASE_URL}/kyc/status")
            
            if response.status_code == 401:
                self.log_test("KYC Authentication Required", True, "Correctly requires authentication")
                return True
            else:
                self.log_test("KYC Authentication Required", False, 
                             f"Expected 401, got {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("KYC Authentication Required", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all KYC tests"""
        print("🧪 Starting KYC System Backend Tests")
        print("=" * 50)
        
        # Test authentication requirement
        self.test_authentication_required()
        
        # Login as test user
        if not self.login_user(TEST_USER_EMAIL, TEST_USER_PASSWORD):
            print("❌ Cannot proceed without user login")
            return False
        
        # Test KYC endpoints
        kyc_status = self.test_kyc_status_endpoint()
        self.test_kyc_submit_endpoint_validation()
        
        # Test KYC gating
        self.test_wallet_kyc_gating()
        self.test_auction_kyc_gating()
        
        # Test admin endpoints
        self.test_admin_kyc_endpoints()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Test Summary")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

def main():
    """Main test runner"""
    tester = KYCTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All KYC tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some KYC tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()