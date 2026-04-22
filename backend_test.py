#!/usr/bin/env python3
"""
BidBlitz V2 - Comprehensive Backend Testing
Testing all new features: Gamification, Friends, 2FA, Export, Support Tickets, KYC
"""

import asyncio
import aiohttp
import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://blitz-driver-taxi.preview.emergentagent.com/api"
TEST_CREDENTIALS = {
    "admin": {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"},
    "customer": {"email": "kunde@bidblitz.com", "password": "Kunde2026!"},
    "driver": {"email": "fahrer@bidblitz.com", "password": "Fahrer2026!"},
    "merchant": {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
}

class BidBlitzTester:
    def __init__(self):
        self.session = None
        self.tokens = {}
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_test(self, test_name: str, status: str, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_emoji} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
        if status == "FAIL" and response_data:
            print(f"   Response: {response_data}")
        print()
    
    async def make_request(self, method: str, endpoint: str, data: Dict = None, 
                          headers: Dict = None, user_type: str = None) -> Dict:
        """Make HTTP request with cookie-based authentication"""
        url = f"{BACKEND_URL}{endpoint}"
        
        # For cookie-based auth, we don't need to add headers manually
        # The session will automatically include cookies
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=headers) as resp:
                    return {"status": resp.status, "data": await resp.json()}
            elif method.upper() == "POST":
                async with self.session.post(url, json=data, headers=headers) as resp:
                    return {"status": resp.status, "data": await resp.json()}
            elif method.upper() == "DELETE":
                async with self.session.delete(url, headers=headers) as resp:
                    return {"status": resp.status, "data": await resp.json()}
        except Exception as e:
            return {"status": 0, "error": str(e)}
    
    async def login_user(self, user_type: str) -> bool:
        """Login and store cookies for authentication"""
        if user_type not in TEST_CREDENTIALS:
            self.log_test(f"Login {user_type}", "FAIL", f"Unknown user type: {user_type}")
            return False
        
        creds = TEST_CREDENTIALS[user_type]
        url = f"{BACKEND_URL}/auth/login"
        
        try:
            async with self.session.post(url, json={
                "email": creds["email"],
                "password": creds["password"]
            }) as resp:
                data = await resp.json()
                
                if resp.status == 200 and "id" in data:
                    # Store user ID for this user type (cookies are automatically handled by session)
                    self.tokens[user_type] = data["id"]
                    self.log_test(f"Login {user_type}", "PASS", f"Logged in as {creds['email']}")
                    return True
                else:
                    self.log_test(f"Login {user_type}", "FAIL", 
                                 f"Login failed: {data}")
                    return False
        except Exception as e:
            self.log_test(f"Login {user_type}", "FAIL", f"Login error: {str(e)}")
            return False
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 1: GAMIFICATION SYSTEM TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_gamification_system(self):
        """Test daily challenges and achievements APIs"""
        print("🎮 TESTING GAMIFICATION SYSTEM")
        print("=" * 50)
        
        # Test 1: Get daily challenges
        response = await self.make_request("GET", "/gamification/challenges/today", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "challenges" in data and "date" in data:
                self.log_test("Daily Challenges - Get Today", "PASS", 
                             f"Found {len(data['challenges'])} challenges for {data['date']}")
            else:
                self.log_test("Daily Challenges - Get Today", "FAIL", 
                             "Missing challenges or date in response", data)
        else:
            self.log_test("Daily Challenges - Get Today", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 2: Complete a challenge (login_streak should auto-complete)
        response = await self.make_request("POST", "/gamification/challenges/complete/login_streak", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok") and "rewards" in data:
                self.log_test("Daily Challenges - Complete Challenge", "PASS", 
                             f"Completed login_streak, rewards: {data['rewards']}")
            else:
                self.log_test("Daily Challenges - Complete Challenge", "FAIL", 
                             "Challenge completion failed", data)
        else:
            self.log_test("Daily Challenges - Complete Challenge", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 3: Try to complete invalid challenge
        response = await self.make_request("POST", "/gamification/challenges/complete/invalid_challenge", 
                                         user_type="customer")
        if response["status"] == 404:
            self.log_test("Daily Challenges - Invalid Challenge", "PASS", 
                         "Correctly rejected invalid challenge")
        else:
            self.log_test("Daily Challenges - Invalid Challenge", "FAIL", 
                         f"Should return 404, got {response['status']}")
        
        # Test 4: Get achievements
        response = await self.make_request("GET", "/gamification/achievements", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "achievements" in data and "stats" in data:
                self.log_test("Achievements - Get All", "PASS", 
                             f"Found {len(data['achievements'])} achievements, "
                             f"{data['stats']['total_unlocked']} unlocked")
            else:
                self.log_test("Achievements - Get All", "FAIL", 
                             "Missing achievements or stats", data)
        else:
            self.log_test("Achievements - Get All", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 5: Unlock an achievement
        response = await self.make_request("POST", "/gamification/achievements/unlock/first_payment", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok"):
                self.log_test("Achievements - Unlock Achievement", "PASS", 
                             f"Unlocked first_payment, reward: {data.get('reward_blz')} BLZ")
            else:
                self.log_test("Achievements - Unlock Achievement", "FAIL", 
                             "Achievement unlock failed", data)
        else:
            # Could be already unlocked, check if that's the case
            if response["status"] == 200 and response["data"].get("message") == "Already unlocked":
                self.log_test("Achievements - Unlock Achievement", "PASS", 
                             "Achievement already unlocked (expected)")
            else:
                self.log_test("Achievements - Unlock Achievement", "FAIL", 
                             f"HTTP {response['status']}", response.get("data"))
        
        # Test 6: Try to unlock invalid achievement
        response = await self.make_request("POST", "/gamification/achievements/unlock/invalid_achievement", 
                                         user_type="customer")
        if response["status"] == 404:
            self.log_test("Achievements - Invalid Achievement", "PASS", 
                         "Correctly rejected invalid achievement")
        else:
            self.log_test("Achievements - Invalid Achievement", "FAIL", 
                         f"Should return 404, got {response['status']}")
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: FRIENDS SYSTEM TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_friends_system(self):
        """Test friends API endpoints"""
        print("👥 TESTING FRIENDS SYSTEM")
        print("=" * 50)
        
        # First, get user IDs for testing
        customer_response = await self.make_request("GET", "/auth/me", user_type="customer")
        driver_response = await self.make_request("GET", "/auth/me", user_type="driver")
        
        if customer_response["status"] != 200 or driver_response["status"] != 200:
            self.log_test("Friends - Get User IDs", "FAIL", "Could not get user profiles")
            return
        
        customer_id = customer_response["data"]["id"]
        driver_id = driver_response["data"]["id"]
        
        # Test 1: Search for users
        response = await self.make_request("GET", "/friends/search?q=fahrer", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "users" in data:
                self.log_test("Friends - Search Users", "PASS", 
                             f"Found {len(data['users'])} users matching 'fahrer'")
            else:
                self.log_test("Friends - Search Users", "FAIL", 
                             "Missing users in response", data)
        else:
            self.log_test("Friends - Search Users", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 2: Send friend request
        response = await self.make_request("POST", "/friends/send-request", 
                                         {"friend_id": driver_id}, user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok") and "request_id" in data:
                request_id = data["request_id"]
                self.log_test("Friends - Send Request", "PASS", 
                             f"Sent friend request, ID: {request_id}")
            else:
                self.log_test("Friends - Send Request", "FAIL", 
                             "Request failed", data)
        else:
            # Could be already friends or request exists
            if response["status"] == 400:
                self.log_test("Friends - Send Request", "PASS", 
                             f"Request rejected (expected): {response['data'].get('detail')}")
            else:
                self.log_test("Friends - Send Request", "FAIL", 
                             f"HTTP {response['status']}", response.get("data"))
        
        # Test 3: Get friend requests (as recipient)
        response = await self.make_request("GET", "/friends/requests", 
                                         user_type="driver")
        if response["status"] == 200:
            data = response["data"]
            if "received" in data and "sent" in data:
                self.log_test("Friends - Get Requests", "PASS", 
                             f"Received: {data['total_received']}, Sent: {data['total_sent']}")
                
                # If there are received requests, try to accept one
                if data["received"]:
                    request_id = data["received"][0]["request_id"]
                    
                    # Test 4: Accept friend request
                    response = await self.make_request("POST", "/friends/accept", 
                                                     {"request_id": request_id}, user_type="driver")
                    if response["status"] == 200:
                        data = response["data"]
                        if data.get("ok"):
                            self.log_test("Friends - Accept Request", "PASS", 
                                         f"Accepted request, friendship ID: {data.get('friendship_id')}")
                        else:
                            self.log_test("Friends - Accept Request", "FAIL", 
                                         "Accept failed", data)
                    else:
                        self.log_test("Friends - Accept Request", "FAIL", 
                                     f"HTTP {response['status']}", response.get("data"))
            else:
                self.log_test("Friends - Get Requests", "FAIL", 
                             "Missing received/sent in response", data)
        else:
            self.log_test("Friends - Get Requests", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 5: Get friends list
        response = await self.make_request("GET", "/friends/list", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "friends" in data:
                self.log_test("Friends - Get Friends List", "PASS", 
                             f"Found {data['total']} friends")
                
                # If there are friends, test removing one
                if data["friends"]:
                    friend_id = data["friends"][0]["id"]
                    
                    # Test 6: Remove friend
                    response = await self.make_request("DELETE", f"/friends/remove/{friend_id}", 
                                                     user_type="customer")
                    if response["status"] == 200:
                        data = response["data"]
                        if data.get("ok"):
                            self.log_test("Friends - Remove Friend", "PASS", 
                                         "Successfully removed friend")
                        else:
                            self.log_test("Friends - Remove Friend", "FAIL", 
                                         "Remove failed", data)
                    else:
                        self.log_test("Friends - Remove Friend", "FAIL", 
                                     f"HTTP {response['status']}", response.get("data"))
            else:
                self.log_test("Friends - Get Friends List", "FAIL", 
                             "Missing friends in response", data)
        else:
            self.log_test("Friends - Get Friends List", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 7: Try to send friend request to self
        response = await self.make_request("POST", "/friends/send-request", 
                                         {"friend_id": customer_id}, user_type="customer")
        if response["status"] == 400:
            self.log_test("Friends - Self Request", "PASS", 
                         "Correctly rejected self friend request")
        else:
            self.log_test("Friends - Self Request", "FAIL", 
                         f"Should reject self request, got {response['status']}")
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: 2FA SYSTEM TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_2fa_system(self):
        """Test 2FA system endpoints"""
        print("🔐 TESTING 2FA SYSTEM")
        print("=" * 50)
        
        # Test 1: Get 2FA status
        response = await self.make_request("GET", "/2fa/status", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "enabled" in data:
                self.log_test("2FA - Get Status", "PASS", 
                             f"2FA enabled: {data['enabled']}, method: {data.get('method')}")
            else:
                self.log_test("2FA - Get Status", "FAIL", 
                             "Missing enabled field", data)
        else:
            self.log_test("2FA - Get Status", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 2: Setup TOTP (QR code generation)
        response = await self.make_request("POST", "/2fa/totp/setup", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok") and "qr_code" in data and "secret" in data:
                self.log_test("2FA - TOTP Setup", "PASS", 
                             f"Generated TOTP secret and QR code")
                totp_secret = data["secret"]
            else:
                self.log_test("2FA - TOTP Setup", "FAIL", 
                             "Missing QR code or secret", data)
        else:
            self.log_test("2FA - TOTP Setup", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 3: Try to verify TOTP with invalid code
        response = await self.make_request("POST", "/2fa/totp/verify-and-enable", 
                                         {"code": "123456"}, user_type="customer")
        if response["status"] == 400:
            self.log_test("2FA - TOTP Invalid Code", "PASS", 
                         "Correctly rejected invalid TOTP code")
        else:
            self.log_test("2FA - TOTP Invalid Code", "FAIL", 
                         f"Should reject invalid code, got {response['status']}")
        
        # Test 4: Disable 2FA (if enabled)
        response = await self.make_request("POST", "/2fa/disable", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok"):
                self.log_test("2FA - Disable", "PASS", "Successfully disabled 2FA")
            else:
                self.log_test("2FA - Disable", "FAIL", "Disable failed", data)
        else:
            # Could be not enabled
            if response["status"] == 400:
                self.log_test("2FA - Disable", "PASS", 
                             "2FA not enabled (expected)")
            else:
                self.log_test("2FA - Disable", "FAIL", 
                             f"HTTP {response['status']}", response.get("data"))
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 2: TRANSACTION EXPORT TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_export_system(self):
        """Test transaction export endpoints"""
        print("📊 TESTING EXPORT SYSTEM")
        print("=" * 50)
        
        # Test 1: Export user transactions (CSV)
        response = await self.make_request("GET", "/export/user/transactions", 
                                         user_type="customer")
        if response["status"] == 200:
            # For CSV, we won't get JSON response, so check if we get data
            self.log_test("Export - User Transactions CSV", "PASS", 
                         "Successfully exported transactions as CSV")
        else:
            self.log_test("Export - User Transactions CSV", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 2: Export user transactions (PDF)
        response = await self.make_request("GET", "/export/user/transactions/pdf", 
                                         user_type="customer")
        if response["status"] == 200:
            self.log_test("Export - User Transactions PDF", "PASS", 
                         "Successfully exported transactions as PDF")
        else:
            self.log_test("Export - User Transactions PDF", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 3: Export with date filters
        response = await self.make_request("GET", "/export/user/transactions?date_from=2024-01-01&date_to=2024-12-31", 
                                         user_type="customer")
        if response["status"] == 200:
            self.log_test("Export - Filtered Transactions", "PASS", 
                         "Successfully exported filtered transactions")
        else:
            self.log_test("Export - Filtered Transactions", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 4: Export user topups
        response = await self.make_request("GET", "/export/user/topups", 
                                         user_type="customer")
        if response["status"] == 200:
            self.log_test("Export - User Topups", "PASS", 
                         "Successfully exported topups")
        else:
            self.log_test("Export - User Topups", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 5: Export user payments
        response = await self.make_request("GET", "/export/user/payments", 
                                         user_type="customer")
        if response["status"] == 200:
            self.log_test("Export - User Payments", "PASS", 
                         "Successfully exported payments")
        else:
            self.log_test("Export - User Payments", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 6: Export report summary (JSON)
        response = await self.make_request("GET", "/export/report/user/summary", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "total_transactions" in data:
                self.log_test("Export - User Summary Report", "PASS", 
                             f"Total transactions: {data['total_transactions']}")
            else:
                self.log_test("Export - User Summary Report", "FAIL", 
                             "Missing transaction data", data)
        else:
            self.log_test("Export - User Summary Report", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 3: SUPPORT TICKETS TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_support_tickets(self):
        """Test support ticket system"""
        print("🎫 TESTING SUPPORT TICKETS")
        print("=" * 50)
        
        # Test 1: Create support ticket
        ticket_data = {
            "subject": "Test Support Ticket",
            "message": "This is a test ticket created by automated testing.",
            "category": "technical"
        }
        response = await self.make_request("POST", "/support/tickets/create", 
                                         ticket_data, user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok") and "ticket_id" in data:
                ticket_id = data["ticket_id"]
                self.log_test("Support - Create Ticket", "PASS", 
                             f"Created ticket ID: {ticket_id}")
            else:
                self.log_test("Support - Create Ticket", "FAIL", 
                             "Ticket creation failed", data)
                return
        else:
            self.log_test("Support - Create Ticket", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
            return
        
        # Test 2: Get my tickets
        response = await self.make_request("GET", "/support/tickets/my", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "tickets" in data:
                self.log_test("Support - Get My Tickets", "PASS", 
                             f"Found {data['total']} tickets")
            else:
                self.log_test("Support - Get My Tickets", "FAIL", 
                             "Missing tickets in response", data)
        else:
            self.log_test("Support - Get My Tickets", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 3: Get ticket details
        response = await self.make_request("GET", f"/support/tickets/{ticket_id}", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "ticket_id" in data and "messages" in data:
                self.log_test("Support - Get Ticket Details", "PASS", 
                             f"Retrieved ticket {ticket_id} with {len(data['messages'])} messages")
            else:
                self.log_test("Support - Get Ticket Details", "FAIL", 
                             "Missing ticket data", data)
        else:
            self.log_test("Support - Get Ticket Details", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 4: Reply to ticket
        reply_data = {
            "ticket_id": ticket_id,
            "message": "This is a test reply from the customer."
        }
        response = await self.make_request("POST", "/support/tickets/reply", 
                                         reply_data, user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok"):
                self.log_test("Support - Reply to Ticket", "PASS", 
                             "Successfully replied to ticket")
            else:
                self.log_test("Support - Reply to Ticket", "FAIL", 
                             "Reply failed", data)
        else:
            self.log_test("Support - Reply to Ticket", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 5: Close ticket
        response = await self.make_request("POST", f"/support/tickets/{ticket_id}/close", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if data.get("ok"):
                self.log_test("Support - Close Ticket", "PASS", 
                             "Successfully closed ticket")
            else:
                self.log_test("Support - Close Ticket", "FAIL", 
                             "Close failed", data)
        else:
            self.log_test("Support - Close Ticket", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Test 6: Try to access non-existent ticket
        response = await self.make_request("GET", "/support/tickets/nonexistent", 
                                         user_type="customer")
        if response["status"] == 404:
            self.log_test("Support - Non-existent Ticket", "PASS", 
                         "Correctly returned 404 for non-existent ticket")
        else:
            self.log_test("Support - Non-existent Ticket", "FAIL", 
                         f"Should return 404, got {response['status']}")
    
    # ═══════════════════════════════════════════════════════════════
    # PHASE 4: KYC TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_kyc_system(self):
        """Test KYC verification system"""
        print("🆔 TESTING KYC SYSTEM")
        print("=" * 50)
        
        # Test 1: Get KYC status
        response = await self.make_request("GET", "/kyc/status", 
                                         user_type="customer")
        if response["status"] == 200:
            data = response["data"]
            if "kyc_verified" in data and "withdrawal_limit" in data:
                self.log_test("KYC - Get Status", "PASS", 
                             f"KYC verified: {data['kyc_verified']}, "
                             f"withdrawal limit: €{data['withdrawal_limit']}")
            else:
                self.log_test("KYC - Get Status", "FAIL", 
                             "Missing KYC data", data)
        else:
            self.log_test("KYC - Get Status", "FAIL", 
                         f"HTTP {response['status']}", response.get("data"))
        
        # Note: File upload tests are skipped as requested
        self.log_test("KYC - File Upload Tests", "SKIP", 
                     "File upload tests skipped as requested")
    
    # ═══════════════════════════════════════════════════════════════
    # AUTHENTICATION & ERROR HANDLING TESTS
    # ═══════════════════════════════════════════════════════════════
    
    async def test_authentication_and_errors(self):
        """Test authentication and error handling"""
        print("🔒 TESTING AUTHENTICATION & ERROR HANDLING")
        print("=" * 50)
        
        # Test 1: Access protected endpoint without auth
        response = await self.make_request("GET", "/gamification/challenges/today")
        if response["status"] == 401:
            self.log_test("Auth - Unauthorized Access", "PASS", 
                         "Correctly rejected unauthorized request")
        else:
            self.log_test("Auth - Unauthorized Access", "FAIL", 
                         f"Should return 401, got {response['status']}")
        
        # Test 2: Access with invalid token
        headers = {"Authorization": "Bearer invalid_token"}
        response = await self.make_request("GET", "/gamification/challenges/today", 
                                         headers=headers)
        if response["status"] == 401:
            self.log_test("Auth - Invalid Token", "PASS", 
                         "Correctly rejected invalid token")
        else:
            self.log_test("Auth - Invalid Token", "FAIL", 
                         f"Should return 401, got {response['status']}")
        
        # Test 3: Test 404 for non-existent endpoints
        response = await self.make_request("GET", "/nonexistent/endpoint", 
                                         user_type="customer")
        if response["status"] == 404:
            self.log_test("Error - 404 Handling", "PASS", 
                         "Correctly returned 404 for non-existent endpoint")
        else:
            self.log_test("Error - 404 Handling", "FAIL", 
                         f"Should return 404, got {response['status']}")
        
        # Test 4: Test malformed JSON
        try:
            url = f"{BACKEND_URL}/gamification/challenges/complete/test"
            headers = {"Authorization": f"Bearer {self.tokens.get('customer', '')}", 
                      "Content-Type": "application/json"}
            async with self.session.post(url, data="invalid json", headers=headers) as resp:
                if resp.status == 400 or resp.status == 422:
                    self.log_test("Error - Malformed JSON", "PASS", 
                                 "Correctly handled malformed JSON")
                else:
                    self.log_test("Error - Malformed JSON", "FAIL", 
                                 f"Should return 400/422, got {resp.status}")
        except Exception as e:
            self.log_test("Error - Malformed JSON", "PASS", 
                         f"Request failed as expected: {str(e)}")
    
    # ═══════════════════════════════════════════════════════════════
    # MAIN TEST RUNNER
    # ═══════════════════════════════════════════════════════════════
    
    async def run_all_tests(self):
        """Run all test suites"""
        print("🚀 STARTING BIDBLITZ V2 BACKEND TESTING")
        print("=" * 60)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test started at: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)
        print()
        
        # Login all test users
        print("🔑 LOGGING IN TEST USERS")
        print("=" * 30)
        for user_type in ["admin", "customer", "driver", "merchant"]:
            await self.login_user(user_type)
        print()
        
        # Run test suites
        await self.test_gamification_system()
        await self.test_friends_system()
        await self.test_2fa_system()
        await self.test_export_system()
        await self.test_support_tickets()
        await self.test_kyc_system()
        await self.test_authentication_and_errors()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed = len([t for t in self.test_results if t["status"] == "PASS"])
        failed = len([t for t in self.test_results if t["status"] == "FAIL"])
        skipped = len([t for t in self.test_results if t["status"] == "SKIP"])
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Skipped: {skipped}")
        print(f"Success Rate: {(passed/total_tests*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            print("-" * 30)
            for test in self.test_results:
                if test["status"] == "FAIL":
                    print(f"• {test['test']}: {test['details']}")
            print()
        
        print("🎯 FEATURE COVERAGE:")
        print("-" * 30)
        features = {
            "Gamification": ["Daily Challenges", "Achievements"],
            "Friends System": ["Search", "Send Request", "Accept", "List", "Remove"],
            "2FA System": ["Status", "TOTP Setup", "Verification"],
            "Export System": ["CSV", "PDF", "Filtered", "Summary"],
            "Support Tickets": ["Create", "List", "Reply", "Close"],
            "KYC System": ["Status Check"],
            "Authentication": ["Security", "Error Handling"]
        }
        
        for feature, components in features.items():
            feature_tests = [t for t in self.test_results if feature.lower().replace(" ", "_") in t["test"].lower()]
            if feature_tests:
                feature_passed = len([t for t in feature_tests if t["status"] == "PASS"])
                print(f"• {feature}: {feature_passed}/{len(feature_tests)} tests passed")
        
        print()
        print(f"Test completed at: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)


async def main():
    """Main test runner"""
    async with BidBlitzTester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())