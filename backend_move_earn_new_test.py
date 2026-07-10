#!/usr/bin/env python3
"""
BidBlitz Move & Earn Backend Testing - New AI Coach & Scoring Flows
Testing against external preview API: https://swipe-match-chat-8.preview.emergentagent.com

German Review Request:
Teste die neuen Move-&-Earn-Backend-Flows der BidBlitz-App gegen die externe Preview-API.

Zugang:
- Admin/Driver-E2E Account: admin@bidblitz.ae / BidBlitz2026!
- REACT_APP_BACKEND_URL aus /app/frontend/.env verwenden

Bitte per curl/API testen:
1) POST /api/auth/login mit admin@bidblitz.ae / BidBlitz2026!
2) GET /api/move/status mit Session-Cookie
   - Erwartet: daily.scoring vorhanden oder nach Sync vorhanden; ai_coach mit headline/summary/next_hint/action_plan
3) POST /api/move/sync-steps mit Body ähnlich:
   {
     "total_steps": 7600,
     "source": "device_test_backend",
     "device_fingerprint": "move-backend-test-device",
     "sensor_confidence": 0.91,
     "gps_distance_km": 1.92,
     "duration_minutes": 24,
     "gps_points": 32,
     "route_variance_score": 0.81,
     "activity_type": "walking",
     "background_tracking_minutes": 20
   }
   - Erwartet: accepted_delta > 0, scoring.trust_score/gps_score/sensor_score/behavior_score vorhanden
4) GET /api/move/coach-session
   - Erwartet: coach mit headline, summary, next_hint, action_plan[3], trust_score_today, coach_source
5) POST /api/move/coach-session mit {"focus":"score_explanation"}
   - Erwartet: ok=true, coach vorhanden

Wichtig:
- Keine CORS-Preflight-Infrastrukturwarnungen als App-Bug melden.
- Falls Status vor erstem Sync keine scoring-Daten hat, ist das okay; dann nach Sync nochmal prüfen.
- Fokus auf Response-Verträge, HTTP-Status, Datenkonsistenz und keine 500er.
"""

import json
import os
import random
import sys
from datetime import datetime

import requests

# Read REACT_APP_BACKEND_URL from frontend/.env
BACKEND_URL = None
try:
    with open("/app/frontend/.env", "r") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BACKEND_URL = line.split("=", 1)[1].strip()
                break
except Exception as e:
    print(f"❌ ERROR: Could not read REACT_APP_BACKEND_URL from /app/frontend/.env: {e}")
    sys.exit(1)

if not BACKEND_URL:
    print("❌ ERROR: REACT_APP_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

print(f"🌐 Backend URL: {BACKEND_URL}")
print(f"📅 Test Date: {datetime.now().isoformat()}")
print("=" * 80)

# Test credentials from review request
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"

# Session for maintaining cookies
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

test_results = []


def log_test(test_name: str, passed: bool, details: str):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    print(f"   {details}")
    test_results.append({"test": test_name, "passed": passed, "details": details})


def check_response_keys(data: dict, required_keys: list, context: str) -> tuple[bool, str]:
    """Check if all required keys are present in response"""
    missing = [k for k in required_keys if k not in data]
    if missing:
        return False, f"{context}: Missing keys: {missing}"
    return True, f"{context}: All required keys present: {required_keys}"


# ============================================================================
# TEST 1: POST /api/auth/login with admin@bidblitz.ae / BidBlitz2026!
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: POST /api/auth/login with admin@bidblitz.ae / BidBlitz2026!")
print("=" * 80)

try:
    login_url = f"{BACKEND_URL}/api/auth/login"
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    resp = session.post(login_url, json=login_payload, timeout=15)
    
    if resp.status_code == 200:
        data = resp.json()
        # Check if we have user data
        if "email" in data and data["email"] == ADMIN_EMAIL:
            # Check if cookies are set
            cookies = session.cookies.get_dict()
            if "access_token" in cookies or "refresh_token" in cookies:
                log_test(
                    "Admin Login",
                    True,
                    f"Login successful with {ADMIN_EMAIL}, status: {resp.status_code}, cookies set: {list(cookies.keys())}"
                )
            else:
                log_test(
                    "Admin Login",
                    False,
                    f"Login returned 200 but no session cookies set. Response: {json.dumps(data, indent=2)[:200]}"
                )
        else:
            log_test(
                "Admin Login",
                False,
                f"Login returned 200 but unexpected response structure. Response: {json.dumps(data, indent=2)[:200]}"
            )
    else:
        log_test(
            "Admin Login",
            False,
            f"Login failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("Admin Login", False, f"Exception during login: {str(e)}")
    print("\n❌ CRITICAL: Cannot proceed without successful login. Exiting.")
    sys.exit(1)


# ============================================================================
# TEST 2: GET /api/move/status - Check for daily.scoring and ai_coach
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: GET /api/move/status - Check for daily.scoring and ai_coach")
print("=" * 80)

status_before_sync = None
scoring_before_sync = None

try:
    status_url = f"{BACKEND_URL}/api/move/status"
    resp = session.get(status_url, timeout=15)
    
    if resp.status_code == 200:
        status_before_sync = resp.json()
        
        # Check for required top-level keys
        required_keys = ["profile", "daily", "ai_coach"]
        has_keys, msg = check_response_keys(status_before_sync, required_keys, "Status response")
        
        if not has_keys:
            log_test("GET /api/move/status - Structure", False, msg)
        else:
            # Check daily.scoring
            daily = status_before_sync.get("daily", {})
            scoring_before_sync = daily.get("scoring")
            
            # Check ai_coach
            ai_coach = status_before_sync.get("ai_coach", {})
            ai_coach_keys = ["headline", "summary", "next_hint", "action_plan"]
            
            scoring_msg = ""
            if scoring_before_sync:
                scoring_keys = ["trust_score", "gps_score", "sensor_score", "behavior_score"]
                has_scoring_keys = all(k in scoring_before_sync for k in scoring_keys)
                if has_scoring_keys:
                    scoring_msg = f"daily.scoring present with all keys: trust_score={scoring_before_sync.get('trust_score')}, gps_score={scoring_before_sync.get('gps_score')}, sensor_score={scoring_before_sync.get('sensor_score')}, behavior_score={scoring_before_sync.get('behavior_score')}"
                else:
                    scoring_msg = f"daily.scoring present but missing some keys. Keys found: {list(scoring_before_sync.keys())}"
            else:
                scoring_msg = "daily.scoring NOT present (okay before first sync, will check after sync)"
            
            ai_coach_msg = ""
            has_ai_coach_keys = all(k in ai_coach for k in ai_coach_keys)
            if has_ai_coach_keys:
                action_plan = ai_coach.get("action_plan", [])
                ai_coach_msg = f"ai_coach present with all keys: headline='{ai_coach.get('headline')[:50]}...', summary length={len(ai_coach.get('summary', ''))}, next_hint length={len(ai_coach.get('next_hint', ''))}, action_plan items={len(action_plan)}"
            else:
                ai_coach_msg = f"ai_coach present but missing some keys. Keys found: {list(ai_coach.keys())}"
            
            details = f"Status: {resp.status_code}. {scoring_msg}. {ai_coach_msg}"
            
            # Pass if either scoring is present OR ai_coach has all keys (scoring might come after sync)
            passed = has_ai_coach_keys or (scoring_before_sync is not None)
            log_test("GET /api/move/status - Structure", passed, details)
    else:
        log_test(
            "GET /api/move/status - Structure",
            False,
            f"Status request failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("GET /api/move/status - Structure", False, f"Exception during status request: {str(e)}")


# ============================================================================
# TEST 3: POST /api/move/sync-steps - Check for accepted_delta > 0 and scoring
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: POST /api/move/sync-steps - Check for accepted_delta > 0 and scoring")
print("=" * 80)

sync_response = None

try:
    sync_url = f"{BACKEND_URL}/api/move/sync-steps"
    
    # Generate realistic sync data as per review request
    base_steps = random.randint(5000, 10000)
    sync_payload = {
        "total_steps": base_steps,
        "source": "device_test_backend",
        "device_fingerprint": "move-backend-test-device",
        "sensor_confidence": round(random.uniform(0.85, 0.95), 2),
        "gps_distance_km": round(random.uniform(1.5, 3.0), 2),
        "duration_minutes": random.randint(20, 40),
        "gps_points": random.randint(25, 50),
        "route_variance_score": round(random.uniform(0.75, 0.90), 2),
        "activity_type": "walking",
        "background_tracking_minutes": random.randint(15, 30)
    }
    
    print(f"   Syncing with payload: {json.dumps(sync_payload, indent=2)}")
    
    resp = session.post(sync_url, json=sync_payload, timeout=15)
    
    if resp.status_code == 200:
        sync_response = resp.json()
        
        # Check for accepted_delta
        accepted_delta = sync_response.get("accepted_delta", 0)
        
        # Check for scoring in response
        scoring = sync_response.get("scoring", {})
        scoring_keys = ["trust_score", "gps_score", "sensor_score", "behavior_score"]
        has_scoring = all(k in scoring for k in scoring_keys)
        
        if accepted_delta > 0 and has_scoring:
            log_test(
                "POST /api/move/sync-steps - Response",
                True,
                f"Sync successful: accepted_delta={accepted_delta}, scoring present with trust_score={scoring.get('trust_score')}, gps_score={scoring.get('gps_score')}, sensor_score={scoring.get('sensor_score')}, behavior_score={scoring.get('behavior_score')}"
            )
        elif accepted_delta > 0:
            log_test(
                "POST /api/move/sync-steps - Response",
                False,
                f"Sync successful with accepted_delta={accepted_delta} but scoring missing or incomplete. Scoring keys found: {list(scoring.keys())}"
            )
        else:
            # Check if it's a rate limit or other expected error
            if "suspicious_reasons" in sync_response or "message" in sync_response:
                log_test(
                    "POST /api/move/sync-steps - Response",
                    False,
                    f"Sync returned accepted_delta=0. Possible fraud detection or rate limit. Response: {json.dumps(sync_response, indent=2)[:300]}"
                )
            else:
                log_test(
                    "POST /api/move/sync-steps - Response",
                    False,
                    f"Sync returned accepted_delta=0. Response: {json.dumps(sync_response, indent=2)[:300]}"
                )
    elif resp.status_code == 429:
        log_test(
            "POST /api/move/sync-steps - Response",
            False,
            f"Sync rate limited (429). This is expected behavior if user already synced today. Response: {resp.text[:200]}"
        )
    else:
        log_test(
            "POST /api/move/sync-steps - Response",
            False,
            f"Sync failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("POST /api/move/sync-steps - Response", False, f"Exception during sync: {str(e)}")


# ============================================================================
# TEST 3b: GET /api/move/status AFTER sync - Verify scoring is now present
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3b: GET /api/move/status AFTER sync - Verify scoring is now present")
print("=" * 80)

try:
    status_url = f"{BACKEND_URL}/api/move/status"
    resp = session.get(status_url, timeout=15)
    
    if resp.status_code == 200:
        status_after_sync = resp.json()
        
        # Check daily.scoring after sync
        daily = status_after_sync.get("daily", {})
        scoring_after_sync = daily.get("scoring")
        
        if scoring_after_sync:
            scoring_keys = ["trust_score", "gps_score", "sensor_score", "behavior_score"]
            has_all_keys = all(k in scoring_after_sync for k in scoring_keys)
            
            if has_all_keys:
                log_test(
                    "GET /api/move/status AFTER sync - Scoring",
                    True,
                    f"daily.scoring present after sync with all keys: trust_score={scoring_after_sync.get('trust_score')}, gps_score={scoring_after_sync.get('gps_score')}, sensor_score={scoring_after_sync.get('sensor_score')}, behavior_score={scoring_after_sync.get('behavior_score')}"
                )
            else:
                log_test(
                    "GET /api/move/status AFTER sync - Scoring",
                    False,
                    f"daily.scoring present but missing some keys. Keys found: {list(scoring_after_sync.keys())}"
                )
        else:
            # If sync was rate limited or returned 0 delta, scoring might still not be present
            log_test(
                "GET /api/move/status AFTER sync - Scoring",
                False,
                f"daily.scoring still NOT present after sync. This might be expected if sync was rate limited or returned 0 delta."
            )
    else:
        log_test(
            "GET /api/move/status AFTER sync - Scoring",
            False,
            f"Status request failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("GET /api/move/status AFTER sync - Scoring", False, f"Exception during status request: {str(e)}")


# ============================================================================
# TEST 4: GET /api/move/coach-session - Check for coach with all required fields
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: GET /api/move/coach-session - Check for coach with all required fields")
print("=" * 80)

try:
    coach_url = f"{BACKEND_URL}/api/move/coach-session"
    resp = session.get(coach_url, timeout=15)
    
    if resp.status_code == 200:
        coach_data = resp.json()
        
        # Check for coach object
        coach = coach_data.get("coach", {})
        
        if not coach:
            log_test(
                "GET /api/move/coach-session - Structure",
                False,
                "Response missing 'coach' object"
            )
        else:
            # Check for required keys
            required_keys = ["headline", "summary", "next_hint", "action_plan", "trust_score_today", "coach_source"]
            missing_keys = [k for k in required_keys if k not in coach]
            
            if missing_keys:
                log_test(
                    "GET /api/move/coach-session - Structure",
                    False,
                    f"Coach object missing keys: {missing_keys}. Keys found: {list(coach.keys())}"
                )
            else:
                # Check action_plan has at least 3 items
                action_plan = coach.get("action_plan", [])
                action_plan_count = len(action_plan) if isinstance(action_plan, list) else 0
                
                if action_plan_count >= 3:
                    log_test(
                        "GET /api/move/coach-session - Structure",
                        True,
                        f"Coach session retrieved successfully: headline='{coach.get('headline')[:50]}...', summary length={len(coach.get('summary', ''))}, next_hint length={len(coach.get('next_hint', ''))}, action_plan items={action_plan_count}, trust_score_today={coach.get('trust_score_today')}, coach_source='{coach.get('coach_source')}'"
                    )
                else:
                    log_test(
                        "GET /api/move/coach-session - Structure",
                        False,
                        f"Coach session retrieved but action_plan has only {action_plan_count} items (expected >= 3). action_plan: {action_plan}"
                    )
    else:
        log_test(
            "GET /api/move/coach-session - Structure",
            False,
            f"Coach session request failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("GET /api/move/coach-session - Structure", False, f"Exception during coach session request: {str(e)}")


# ============================================================================
# TEST 5: POST /api/move/coach-session with {"focus":"score_explanation"}
# ============================================================================
print("\n" + "=" * 80)
print("TEST 5: POST /api/move/coach-session with {\"focus\":\"score_explanation\"}")
print("=" * 80)

try:
    coach_url = f"{BACKEND_URL}/api/move/coach-session"
    coach_payload = {"focus": "score_explanation"}
    
    resp = session.post(coach_url, json=coach_payload, timeout=15)
    
    if resp.status_code == 200:
        coach_data = resp.json()
        
        # Check for ok=true
        ok = coach_data.get("ok")
        
        # Check for coach object
        coach = coach_data.get("coach", {})
        
        if ok and coach:
            # Check if focus was applied
            focus = coach.get("focus")
            
            log_test(
                "POST /api/move/coach-session - Focus",
                True,
                f"Coach session refresh successful: ok={ok}, coach present with {len(coach)} keys, focus='{focus}'"
            )
        elif coach:
            log_test(
                "POST /api/move/coach-session - Focus",
                False,
                f"Coach session returned coach but ok={ok} (expected True). Response: {json.dumps(coach_data, indent=2)[:300]}"
            )
        else:
            log_test(
                "POST /api/move/coach-session - Focus",
                False,
                f"Coach session returned ok={ok} but coach object missing. Response: {json.dumps(coach_data, indent=2)[:300]}"
            )
    else:
        log_test(
            "POST /api/move/coach-session - Focus",
            False,
            f"Coach session refresh failed with status {resp.status_code}. Response: {resp.text[:200]}"
        )
except Exception as e:
    log_test("POST /api/move/coach-session - Focus", False, f"Exception during coach session refresh: {str(e)}")


# ============================================================================
# TEST 6: No 500 errors - Verify all endpoints returned proper status codes
# ============================================================================
print("\n" + "=" * 80)
print("TEST 6: No 500 errors - Verify all endpoints returned proper status codes")
print("=" * 80)

# Check if any test encountered a 500 error
has_500_error = any("500" in result["details"] for result in test_results)

if has_500_error:
    log_test(
        "No 500 Errors",
        False,
        "One or more endpoints returned 500 Internal Server Error. Check test details above."
    )
else:
    log_test(
        "No 500 Errors",
        True,
        "All endpoints returned proper HTTP status codes (no 500 errors detected)"
    )


# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)

passed_count = sum(1 for r in test_results if r["passed"])
total_count = len(test_results)
success_rate = (passed_count / total_count * 100) if total_count > 0 else 0

print(f"\n✅ Passed: {passed_count}/{total_count} ({success_rate:.0f}%)")
print(f"❌ Failed: {total_count - passed_count}/{total_count}")

print("\nDetailed Results:")
for i, result in enumerate(test_results, 1):
    status = "✅" if result["passed"] else "❌"
    print(f"{i}. {status} {result['test']}")

# Save results to JSON
results_file = "/app/move_earn_new_test_results.json"
with open(results_file, "w") as f:
    json.dump({
        "test_date": datetime.now().isoformat(),
        "backend_url": BACKEND_URL,
        "credentials": f"{ADMIN_EMAIL} / {ADMIN_PASSWORD}",
        "total_tests": total_count,
        "passed": passed_count,
        "failed": total_count - passed_count,
        "success_rate": f"{success_rate:.0f}%",
        "results": test_results
    }, f, indent=2)

print(f"\n📄 Test results saved to: {results_file}")

# Exit with appropriate code
sys.exit(0 if passed_count == total_count else 1)
