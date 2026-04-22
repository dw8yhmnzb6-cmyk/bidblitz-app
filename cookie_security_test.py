#!/usr/bin/env python3
"""
BidBlitz Live Server - Detailed Cookie Security Test
Testing cookie security attributes for production login
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone

# Configuration for Live Server
LIVE_BACKEND_URL = "https://bidblitz.ae/api"
LIVE_CREDENTIALS = {
    "email": "admin@bidblitz.ae",
    "password": "BidBlitz2026!"
}

async def test_cookie_security():
    """Test cookie security attributes in detail"""
    print("🍪 DETAILED COOKIE SECURITY TEST")
    print("=" * 50)
    
    connector = aiohttp.TCPConnector(ssl=True)
    timeout = aiohttp.ClientTimeout(total=30)
    
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        login_url = f"{LIVE_BACKEND_URL}/auth/login"
        
        try:
            async with session.post(login_url, json=LIVE_CREDENTIALS) as resp:
                print(f"Response Status: {resp.status}")
                print(f"Response Headers:")
                for name, value in resp.headers.items():
                    if 'cookie' in name.lower() or 'set-cookie' in name.lower():
                        print(f"  {name}: {value}")
                
                print(f"\nCookies in Response:")
                for cookie in resp.cookies:
                    print(f"  Cookie: {cookie}")
                    print(f"    Name: {getattr(cookie, 'key', getattr(cookie, 'name', 'unknown'))}")
                    print(f"    Value: {getattr(cookie, 'value', 'unknown')}")
                    print(f"    Domain: {getattr(cookie, 'domain', 'unknown')}")
                    print(f"    Path: {getattr(cookie, 'path', 'unknown')}")
                    print(f"    Secure: {getattr(cookie, 'secure', 'unknown')}")
                    print(f"    HttpOnly: {getattr(cookie, 'httponly', 'unknown')}")
                    print(f"    SameSite: {getattr(cookie, 'samesite', 'unknown')}")
                    print(f"    Max-Age: {getattr(cookie, 'max_age', 'unknown')}")
                    print(f"    Expires: {getattr(cookie, 'expires', 'unknown')}")
                    print()
                
                # Check raw Set-Cookie headers
                set_cookie_headers = resp.headers.getall('Set-Cookie', [])
                print(f"Raw Set-Cookie Headers ({len(set_cookie_headers)}):")
                for i, header in enumerate(set_cookie_headers):
                    print(f"  {i+1}: {header}")
                print()
                
                # Parse response data
                try:
                    data = await resp.json()
                    print(f"Response Data Keys: {list(data.keys())}")
                    print(f"User Role: {data.get('role', 'unknown')}")
                    print(f"User Email: {data.get('email', 'unknown')}")
                except Exception as e:
                    print(f"Could not parse response JSON: {e}")
                
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_cookie_security())