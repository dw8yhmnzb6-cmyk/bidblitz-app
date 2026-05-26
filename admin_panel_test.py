#!/usr/bin/env python3
"""
BidBlitz V2 - Comprehensive Admin Panel Testing
Tests all 17 admin panels systematically and reports which work and which are broken.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://floorplan-wizard-8.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

class AdminPanelTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ Working" if success else "❌ Broken"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        
    def login_admin(self):
        """Login as admin"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            if response.status_code == 200:
                data = response.json()
                # Handle direct user response or nested user object
                user = data if 'role' in data else data.get('user', {})
                if user.get('role') == 'admin':
                    self.log_test("Admin Login", True, f"Logged in as {user.get('name', 'Admin')}")
                    return True
                else:
                    self.log_test("Admin Login", False, f"User role is {user.get('role')}, not admin")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_panel(self, panel_name, endpoint, expected_fields=None):
        """Test a single admin panel endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}{endpoint}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for expected fields if provided
                if expected_fields:
                    missing_fields = [field for field in expected_fields if field not in data]
                    if missing_fields:
                        self.log_test(panel_name, False, f"Missing fields: {missing_fields}")
                        return False
                
                self.log_test(panel_name, True, f"GET {endpoint} - Status 200")
                return True
                
            elif response.status_code == 404:
                self.log_test(panel_name, False, f"404 Not Found - Endpoint {endpoint} does not exist")
                return False
            elif response.status_code == 403:
                self.log_test(panel_name, False, f"403 Forbidden - Admin access denied")
                return False
            else:
                self.log_test(panel_name, False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test(panel_name, False, f"Exception: {str(e)}")
            return False
    
    def test_main_admin_panel(self):
        """Test Main Admin Panel (/admin)"""
        return self.test_admin_panel(
            "Main Admin Panel (/admin)", 
            "/admin/overview",
            ["total_users", "total_merchants", "payment_volume"]
        )
    
    def test_admin_monitoring(self):
        """Test Admin Monitoring (/admin/monitoring)"""
        return self.test_admin_panel(
            "Admin Monitoring (/admin/monitoring)", 
            "/admin/monitoring/health",
            ["status", "database", "system"]
        )
    
    def test_admin_merchants(self):
        """Test Admin Merchants (/admin/merchants)"""
        return self.test_admin_panel(
            "Admin Merchants (/admin/merchants)", 
            "/admin/merchants",
            ["merchants", "total"]
        )
    
    def test_admin_legal(self):
        """Test Admin Legal (/admin/legal)"""
        return self.test_admin_panel(
            "Admin Legal (/admin/legal)", 
            "/admin/legal/all",
            ["documents"]
        )
    
    def test_admin_wallet(self):
        """Test Admin Wallet (/admin/wallet)"""
        return self.test_admin_panel(
            "Admin Wallet (/admin/wallet)", 
            "/admin/wallet/users",
            ["users", "count"]
        )
    
    def test_admin_smm(self):
        """Test Admin SMM (/admin/smm)"""
        return self.test_admin_panel(
            "Admin SMM (/admin/smm)", 
            "/smm/admin/orders",
            ["orders"]
        )
    
    def test_admin_manage(self):
        """Test Admin Manage (/admin/manage)"""
        return self.test_admin_panel(
            "Admin Manage (/admin/manage)", 
            "/admin/system-health",
            ["status", "modules"]
        )
    
    def test_admin_taxi(self):
        """Test Admin Taxi (/admin/taxi)"""
        return self.test_admin_panel(
            "Admin Taxi (/admin/taxi)", 
            "/admin/taxi/overview",
            ["drivers", "rides"]
        )
    
    def test_admin_revenue(self):
        """Test Admin Revenue (/admin/revenue)"""
        return self.test_admin_panel(
            "Admin Revenue (/admin/revenue)", 
            "/sponsor/tiers",
            ["tiers"]
        )
    
    def test_admin_customers(self):
        """Test Admin Customers (/admin/customers)"""
        return self.test_admin_panel(
            "Admin Customers (/admin/customers)", 
            "/admin/users",
            ["users", "total"]
        )
    
    def test_admin_payments(self):
        """Test Admin Payments (/admin/payments)"""
        return self.test_admin_panel(
            "Admin Payments (/admin/payments)", 
            "/admin/transactions",
            ["transactions", "total"]
        )
    
    def test_admin_modules(self):
        """Test Admin Modules (/admin/modules)"""
        return self.test_admin_panel(
            "Admin Modules (/admin/modules)", 
            "/admin/feature-flags",
            ["flags"]
        )
    
    def test_admin_support(self):
        """Test Admin Support (/admin/support)"""
        return self.test_admin_panel(
            "Admin Support (/admin/support)", 
            "/support/admin/tickets",
            ["tickets"]
        )
    
    def test_admin_credits(self):
        """Test Admin Credits (/admin/credits)"""
        return self.test_admin_panel(
            "Admin Credits (/admin/credits)", 
            "/admin/wallet/transactions",
            ["transactions"]
        )
    
    def test_admin_auction_images(self):
        """Test Admin Auction Images (/admin/auction-images)"""
        return self.test_admin_panel(
            "Admin Auction Images (/admin/auction-images)", 
            "/admin/auction-images/list",
            ["auctions"]
        )
    
    def test_admin_email_marketing(self):
        """Test Admin Email Marketing (/admin/email-marketing)"""
        return self.test_admin_panel(
            "Admin Email Marketing (/admin/email-marketing)", 
            "/email-marketing/campaigns",
            ["campaigns"]
        )
    
    def test_admin_directory(self):
        """Test Admin Directory (/admin/directory) - NEW"""
        return self.test_admin_panel(
            "Admin Directory (/admin/directory)", 
            "/directory/admin/agents",
            ["agents"]
        )
    
    def test_directory_stats(self):
        """Test Directory Stats endpoint"""
        return self.test_admin_panel(
            "Directory Stats", 
            "/directory/stats",
            ["total_listings"]
        )
    
    def run_all_tests(self):
        """Run all admin panel tests"""
        print("🧪 Starting BidBlitz V2 Admin Panel Testing")
        print("=" * 60)
        
        # Login as admin first
        if not self.login_admin():
            print("❌ Cannot proceed without admin login")
            return False
        
        print("\n📋 Testing All Admin Panels:")
        print("-" * 40)
        
        # Test all 17 admin panels
        self.test_main_admin_panel()
        self.test_admin_monitoring()
        self.test_admin_merchants()
        self.test_admin_legal()
        self.test_admin_wallet()
        self.test_admin_smm()
        self.test_admin_manage()
        self.test_admin_taxi()
        self.test_admin_revenue()
        self.test_admin_customers()
        self.test_admin_payments()
        self.test_admin_modules()
        self.test_admin_support()
        self.test_admin_credits()
        self.test_admin_auction_images()
        self.test_admin_email_marketing()
        self.test_admin_directory()
        
        # Test additional directory endpoints
        print("\n📋 Testing Directory Backend Endpoints:")
        print("-" * 40)
        self.test_directory_stats()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 ADMIN PANEL TEST SUMMARY")
        print("=" * 60)
        
        working_panels = [result for result in self.test_results if result["success"]]
        broken_panels = [result for result in self.test_results if not result["success"]]
        
        print(f"\n✅ WORKING PANELS ({len(working_panels)}):")
        for result in working_panels:
            print(f"  ✅ {result['test']}")
        
        if broken_panels:
            print(f"\n❌ BROKEN PANELS ({len(broken_panels)}):")
            for result in broken_panels:
                print(f"  ❌ {result['test']} - {result['details']}")
        
        total = len(self.test_results)
        passed = len(working_panels)
        
        print(f"\n📈 STATISTICS:")
        print(f"  Total Panels Tested: {total}")
        print(f"  Working: {passed}")
        print(f"  Broken: {total - passed}")
        print(f"  Success Rate: {(passed/total)*100:.1f}%")
        
        return passed == total

def main():
    """Main test runner"""
    tester = AdminPanelTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All admin panels are working!")
        sys.exit(0)
    else:
        print("\n💥 Some admin panels are broken!")
        sys.exit(1)

if __name__ == "__main__":
    main()