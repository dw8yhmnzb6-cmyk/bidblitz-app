#!/usr/bin/env python3
"""
BidBlitz Live Server Login System Test
Testing the production login system at https://bidblitz.ae
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configuration for Live Server
LIVE_BACKEND_URL = "https://bidblitz.ae/api"
LIVE_CREDENTIALS = {
    "email": "admin@bidblitz.ae",
    "password": "BidBlitz2026!"
}

class BidBlitzLiveTester:
    def __init__(self):
        self.session = None
        self.test_results = []
        self.auth_cookie = None
        
    async def __aenter__(self):
        # Create session with proper settings for production
        connector = aiohttp.TCPConnector(ssl=True)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': 'BidBlitz-Test-Client/1.0'
            }
        )
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
    
    async def test_login_endpoint(self):
        """Test the login endpoint directly"""
        print("🔐 TESTING LOGIN ENDPOINT")
        print("=" * 50)
        
        login_url = f"{LIVE_BACKEND_URL}/auth/login"
        
        try:
            async with self.session.post(login_url, json=LIVE_CREDENTIALS) as resp:
                # Check response code
                if resp.status == 200:
                    self.log_test("Login - Response Code", "PASS", f"Got 200 OK")
                else:
                    self.log_test("Login - Response Code", "FAIL", 
                                 f"Expected 200, got {resp.status}")
                    return False
                
                # Check if cookie is set
                cookies = resp.cookies
                if cookies:
                    try:
                        cookie_names = []
                        for cookie in cookies:
                            if hasattr(cookie, 'key'):
                                cookie_names.append(cookie.key)
                            elif hasattr(cookie, 'name'):
                                cookie_names.append(cookie.name)
                            else:
                                cookie_names.append(str(cookie))
                        
                        self.log_test("Login - Cookie Set", "PASS", 
                                     f"Cookies set: {cookie_names}")
                        
                        # Check for secure and SameSite attributes
                        for cookie in cookies:
                            cookie_name = getattr(cookie, 'key', getattr(cookie, 'name', str(cookie)))
                            if cookie_name in ['session', 'auth', 'token'] or 'session' in str(cookie_name).lower():
                                secure = getattr(cookie, 'secure', False)
                                samesite = getattr(cookie, 'samesite', None)
                                self.log_test("Login - Cookie Security", "PASS" if secure else "WARN",
                                             f"Cookie {cookie_name}: Secure={secure}, SameSite={samesite}")
                    except Exception as e:
                        self.log_test("Login - Cookie Set", "PASS", 
                                     f"Cookies set but parsing failed: {str(e)}")
                else:
                    self.log_test("Login - Cookie Set", "FAIL", "No cookies set in response")
                
                # Check response body contains user data
                try:
                    data = await resp.json()
                    if "id" in data or "user" in data or "email" in data:
                        self.log_test("Login - User Data", "PASS", 
                                     f"Response contains user data: {list(data.keys())}")
                        return True
                    else:
                        self.log_test("Login - User Data", "FAIL", 
                                     f"No user data in response: {data}")
                        return False
                except Exception as e:
                    self.log_test("Login - User Data", "FAIL", 
                                 f"Could not parse JSON response: {str(e)}")
                    return False
                    
        except Exception as e:
            self.log_test("Login - Connection", "FAIL", f"Connection error: {str(e)}")
            return False
    
    async def test_auth_me_endpoint(self):
        """Test the auth/me endpoint with cookies from login"""
        print("👤 TESTING AUTH/ME ENDPOINT")
        print("=" * 50)
        
        # First login to get cookies
        login_url = f"{LIVE_BACKEND_URL}/auth/login"
        try:
            async with self.session.post(login_url, json=LIVE_CREDENTIALS) as resp:
                if resp.status != 200:
                    self.log_test("Auth/Me - Login Required", "FAIL", 
                                 f"Could not login first, got {resp.status}")
                    return False
        except Exception as e:
            self.log_test("Auth/Me - Login Required", "FAIL", 
                         f"Login failed: {str(e)}")
            return False
        
        # Now test auth/me endpoint
        me_url = f"{LIVE_BACKEND_URL}/auth/me"
        try:
            async with self.session.get(me_url) as resp:
                if resp.status == 200:
                    self.log_test("Auth/Me - Response Code", "PASS", "Got 200 OK")
                    
                    try:
                        data = await resp.json()
                        if "id" in data or "email" in data or "user" in data:
                            self.log_test("Auth/Me - User Data", "PASS", 
                                         f"Retrieved user data: {list(data.keys())}")
                            return True
                        else:
                            self.log_test("Auth/Me - User Data", "FAIL", 
                                         f"No user data in response: {data}")
                            return False
                    except Exception as e:
                        self.log_test("Auth/Me - User Data", "FAIL", 
                                     f"Could not parse JSON: {str(e)}")
                        return False
                else:
                    self.log_test("Auth/Me - Response Code", "FAIL", 
                                 f"Expected 200, got {resp.status}")
                    return False
                    
        except Exception as e:
            self.log_test("Auth/Me - Connection", "FAIL", f"Connection error: {str(e)}")
            return False
    
    async def test_cors_headers(self):
        """Test CORS headers on auth endpoints"""
        print("🌐 TESTING CORS HEADERS")
        print("=" * 50)
        
        # Test CORS on login endpoint
        login_url = f"{LIVE_BACKEND_URL}/auth/login"
        
        # First test OPTIONS request
        try:
            headers = {
                'Origin': 'https://bidblitz.ae',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
            
            async with self.session.options(login_url, headers=headers) as resp:
                cors_headers = {
                    'Access-Control-Allow-Origin': resp.headers.get('Access-Control-Allow-Origin'),
                    'Access-Control-Allow-Credentials': resp.headers.get('Access-Control-Allow-Credentials'),
                    'Access-Control-Allow-Methods': resp.headers.get('Access-Control-Allow-Methods'),
                    'Access-Control-Allow-Headers': resp.headers.get('Access-Control-Allow-Headers')
                }
                
                # Check Access-Control-Allow-Origin
                if cors_headers['Access-Control-Allow-Origin']:
                    if cors_headers['Access-Control-Allow-Origin'] in ['*', 'https://bidblitz.ae']:
                        self.log_test("CORS - Allow-Origin", "PASS", 
                                     f"Origin: {cors_headers['Access-Control-Allow-Origin']}")
                    else:
                        self.log_test("CORS - Allow-Origin", "FAIL", 
                                     f"Unexpected origin: {cors_headers['Access-Control-Allow-Origin']}")
                else:
                    self.log_test("CORS - Allow-Origin", "FAIL", "No Access-Control-Allow-Origin header")
                
                # Check Access-Control-Allow-Credentials
                if cors_headers['Access-Control-Allow-Credentials']:
                    if cors_headers['Access-Control-Allow-Credentials'].lower() == 'true':
                        self.log_test("CORS - Allow-Credentials", "PASS", "Credentials allowed")
                    else:
                        self.log_test("CORS - Allow-Credentials", "FAIL", 
                                     f"Credentials not allowed: {cors_headers['Access-Control-Allow-Credentials']}")
                else:
                    self.log_test("CORS - Allow-Credentials", "FAIL", "No Access-Control-Allow-Credentials header")
                
                self.log_test("CORS - Headers Summary", "INFO", 
                             f"All CORS headers: {cors_headers}")
                
        except Exception as e:
            self.log_test("CORS - OPTIONS Request", "FAIL", f"OPTIONS request failed: {str(e)}")
        
        # Test CORS on actual POST request
        try:
            headers = {'Origin': 'https://bidblitz.ae'}
            async with self.session.post(login_url, json=LIVE_CREDENTIALS, headers=headers) as resp:
                cors_origin = resp.headers.get('Access-Control-Allow-Origin')
                cors_credentials = resp.headers.get('Access-Control-Allow-Credentials')
                
                if cors_origin:
                    self.log_test("CORS - POST Allow-Origin", "PASS", f"Origin: {cors_origin}")
                else:
                    self.log_test("CORS - POST Allow-Origin", "FAIL", "No CORS origin header in POST response")
                
                if cors_credentials and cors_credentials.lower() == 'true':
                    self.log_test("CORS - POST Allow-Credentials", "PASS", "Credentials allowed in POST")
                else:
                    self.log_test("CORS - POST Allow-Credentials", "FAIL", 
                                 f"Credentials not properly set in POST: {cors_credentials}")
                    
        except Exception as e:
            self.log_test("CORS - POST Request", "FAIL", f"POST request failed: {str(e)}")
    
    async def test_backend_verification(self):
        """Verify the live site uses its own backend"""
        print("🔍 TESTING BACKEND VERIFICATION")
        print("=" * 50)
        
        # Test that we're hitting the correct backend
        try:
            # Test a simple endpoint to verify we're on the right server
            health_url = f"{LIVE_BACKEND_URL}/health"
            async with self.session.get(health_url) as resp:
                if resp.status in [200, 404]:  # 404 is fine if health endpoint doesn't exist
                    self.log_test("Backend - Server Reachable", "PASS", 
                                 f"bidblitz.ae/api/* is reachable (status: {resp.status})")
                else:
                    self.log_test("Backend - Server Reachable", "FAIL", 
                                 f"Unexpected status: {resp.status}")
        except Exception as e:
            self.log_test("Backend - Server Reachable", "FAIL", f"Cannot reach bidblitz.ae/api: {str(e)}")
        
        # Verify we're not accidentally hitting preview server
        try:
            preview_url = "https://bidblitz-staff.preview.emergentagent.com/api/auth/login"
            async with self.session.post(preview_url, json=LIVE_CREDENTIALS) as resp:
                # This should fail or return different response than live server
                if resp.status == 200:
                    self.log_test("Backend - Not Preview Server", "WARN", 
                                 "Preview server also accepts live credentials - verify we're testing the right server")
                else:
                    self.log_test("Backend - Not Preview Server", "PASS", 
                                 f"Preview server returns {resp.status} for live credentials")
        except Exception as e:
            self.log_test("Backend - Not Preview Server", "PASS", 
                         f"Preview server not accessible: {str(e)}")
    
    async def run_all_tests(self):
        """Run all test suites for live server"""
        print("🚀 STARTING BIDBLITZ LIVE SERVER LOGIN TESTING")
        print("=" * 60)
        print(f"Live Backend URL: {LIVE_BACKEND_URL}")
        print(f"Test Credentials: {LIVE_CREDENTIALS['email']}")
        print(f"Test started at: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)
        print()
        
        # Run test suites in order
        await self.test_backend_verification()
        await self.test_login_endpoint()
        await self.test_auth_me_endpoint()
        await self.test_cors_headers()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test results summary"""
        print("📊 LIVE SERVER TEST RESULTS SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed = len([t for t in self.test_results if t["status"] == "PASS"])
        failed = len([t for t in self.test_results if t["status"] == "FAIL"])
        warnings = len([t for t in self.test_results if t["status"] == "WARN"])
        info = len([t for t in self.test_results if t["status"] == "INFO"])
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️ Warnings: {warnings}")
        print(f"ℹ️ Info: {info}")
        if total_tests > 0:
            print(f"Success Rate: {(passed/total_tests*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            print("-" * 30)
            for test in self.test_results:
                if test["status"] == "FAIL":
                    print(f"• {test['test']}: {test['details']}")
            print()
        
        if warnings > 0:
            print("⚠️ WARNINGS:")
            print("-" * 30)
            for test in self.test_results:
                if test["status"] == "WARN":
                    print(f"• {test['test']}: {test['details']}")
            print()
        
        print("🎯 TEST COVERAGE:")
        print("-" * 30)
        print("• Login Endpoint: Response code, cookies, user data")
        print("• Auth/Me Endpoint: Authentication with cookies")
        print("• CORS Headers: Allow-Origin, Allow-Credentials")
        print("• Backend Verification: Correct server usage")
        
        print()
        print(f"Test completed at: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)


async def main():
    """Main test runner for live server"""
    async with BidBlitzLiveTester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())