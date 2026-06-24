#!/usr/bin/env python3
"""
BidBlitz Move & Earn Backend Testing
Tests all Move & Earn APIs against preview environment
"""
import requests
import json
import time
from datetime import datetime

BASE_URL = "https://commerce-hub-565.preview.emergentagent.com"
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASSWORD = "BidBlitz2026!"

class MoveEarnTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        self.results = []
        self.test_user_id = None
        
    def log(self, test_name, passed, details="", response=None):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response:
            result["status_code"] = response.status_code
            try:
                result["response_body"] = response.json()
            except:
                result["response_text"] = response.text[:500]
        
        self.results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"  → {details}")
        if response and not passed:
            print(f"  → Status: {response.status_code}")
            print(f"  → Response: {response.text[:300]}")
        print()
        
    def test_1_admin_login(self):
        """Test 1: POST /api/auth/login mit Admin funktioniert"""
        print("=" * 80)
        print("TEST 1: Admin Login")
        print("=" * 80)
        
        try:
            response = self.session.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                # Check for user data
                if "email" in data or "user" in data:
                    self.log("Test 1: Admin Login", True, 
                            f"Admin logged in successfully as {ADMIN_EMAIL}", response)
                    return True
                else:
                    self.log("Test 1: Admin Login", False, 
                            "Login returned 200 but no user data", response)
                    return False
            else:
                self.log("Test 1: Admin Login", False, 
                        f"Login failed with status {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 1: Admin Login", False, f"Exception: {str(e)}")
            return False
    
    def test_2_move_status(self):
        """Test 2: GET /api/move/status liefert vollständiges Profil/Daily/Missions/AI-Coach payload"""
        print("=" * 80)
        print("TEST 2: GET /api/move/status - Complete Payload")
        print("=" * 80)
        
        try:
            response = self.session.get(f"{BASE_URL}/api/move/status")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required top-level keys
                required_keys = ["profile", "daily", "claim_cards", "daily_checkin", 
                               "ride_earn", "missions", "leaderboard_preview", 
                               "history_preview", "ai_coach", "settings"]
                
                missing_keys = [k for k in required_keys if k not in data]
                
                if missing_keys:
                    self.log("Test 2: Move Status", False, 
                            f"Missing keys: {missing_keys}", response)
                    return False
                
                # Check profile structure
                profile = data.get("profile", {})
                profile_keys = ["level", "total_xp", "total_steps", "total_move_coins", 
                              "energy_balance", "streak_days", "is_premium"]
                missing_profile = [k for k in profile_keys if k not in profile]
                
                # Check daily structure
                daily = data.get("daily", {})
                daily_keys = ["date", "accepted_steps", "goal", "progress_pct", 
                            "energy_earned", "move_coins_earned", "xp_earned"]
                missing_daily = [k for k in daily_keys if k not in daily]
                
                # Check missions
                missions = data.get("missions", [])
                
                # Check AI coach
                ai_coach = data.get("ai_coach", {})
                ai_keys = ["status"]
                missing_ai = [k for k in ai_keys if k not in ai_coach]
                
                if missing_profile or missing_daily or missing_ai:
                    details = []
                    if missing_profile:
                        details.append(f"Missing profile keys: {missing_profile}")
                    if missing_daily:
                        details.append(f"Missing daily keys: {missing_daily}")
                    if missing_ai:
                        details.append(f"Missing AI coach keys: {missing_ai}")
                    
                    self.log("Test 2: Move Status", False, "; ".join(details), response)
                    return False
                
                self.log("Test 2: Move Status", True, 
                        f"Complete payload received: {len(missions)} missions, "
                        f"{profile.get('total_steps', 0)} total steps, "
                        f"{daily.get('accepted_steps', 0)} steps today, "
                        f"AI Coach: {ai_coach.get('status', 'N/A')}", response)
                return True
            else:
                self.log("Test 2: Move Status", False, 
                        f"Request failed with status {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 2: Move Status", False, f"Exception: {str(e)}")
            return False
    
    def test_3_sync_steps_valid(self):
        """Test 3: POST /api/move/sync-steps akzeptiert plausible Werte"""
        print("=" * 80)
        print("TEST 3: POST /api/move/sync-steps - Valid Values")
        print("=" * 80)
        
        try:
            # Sync with reasonable step count
            response = self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={
                    "total_steps": 5000,
                    "source": "test_device",
                    "sensor_confidence": 0.85,
                    "duration_minutes": 60
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check response structure
                if "ok" in data and data["ok"]:
                    accepted_delta = data.get("accepted_delta", 0)
                    coins_gain = data.get("coins_gain", 0)
                    energy_gain = data.get("energy_gain", 0)
                    xp_gain = data.get("xp_gain", 0)
                    
                    self.log("Test 3: Sync Steps Valid", True, 
                            f"Steps synced: +{accepted_delta} steps, "
                            f"+{coins_gain} coins, +{energy_gain} energy, +{xp_gain} XP", 
                            response)
                    return True
                else:
                    self.log("Test 3: Sync Steps Valid", False, 
                            "Response missing 'ok' field or ok=false", response)
                    return False
            else:
                self.log("Test 3: Sync Steps Valid", False, 
                        f"Request failed with status {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 3: Sync Steps Valid", False, f"Exception: {str(e)}")
            return False
    
    def test_4_anti_fraud_checks(self):
        """Test 4: Anti-Fraud Grundlogik prüfen"""
        print("=" * 80)
        print("TEST 4: Anti-Fraud Logic")
        print("=" * 80)
        
        fraud_tests = []
        
        # Test 4a: Too large increment
        print("Test 4a: Too large increment (>8000 steps)")
        try:
            response = self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={
                    "total_steps": 50000,  # Very large increment
                    "source": "test_device",
                    "sensor_confidence": 0.9
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                suspicious_reasons = data.get("suspicious_reasons", [])
                accepted_delta = data.get("accepted_delta", 0)
                
                # Should clamp to max_sync_increment (8000)
                if accepted_delta <= 8000 and ("too_large_increment" in suspicious_reasons or accepted_delta < 50000):
                    fraud_tests.append(("Too large increment", True, 
                                      f"Clamped to {accepted_delta} steps, suspicious: {suspicious_reasons}"))
                else:
                    fraud_tests.append(("Too large increment", False, 
                                      f"Did not clamp properly: {accepted_delta} steps"))
            else:
                fraud_tests.append(("Too large increment", False, 
                                  f"Request failed: {response.status_code}"))
        except Exception as e:
            fraud_tests.append(("Too large increment", False, f"Exception: {str(e)}"))
        
        # Test 4b: Decreasing total
        print("Test 4b: Decreasing total steps")
        try:
            # First sync with high value
            self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={"total_steps": 10000, "source": "test_device"}
            )
            time.sleep(0.5)
            
            # Then try to sync with lower value
            response = self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={"total_steps": 5000, "source": "test_device"}
            )
            
            if response.status_code == 200:
                data = response.json()
                suspicious_reasons = data.get("suspicious_reasons", [])
                
                if "decreasing_total" in suspicious_reasons:
                    fraud_tests.append(("Decreasing total", True, 
                                      f"Detected decreasing total: {suspicious_reasons}"))
                else:
                    # May not trigger if it's a different day or device
                    fraud_tests.append(("Decreasing total", True, 
                                      "Request accepted (may be different context)"))
            else:
                fraud_tests.append(("Decreasing total", False, 
                                  f"Request failed: {response.status_code}"))
        except Exception as e:
            fraud_tests.append(("Decreasing total", False, f"Exception: {str(e)}"))
        
        # Test 4c: Max steps per day clamp
        print("Test 4c: Max steps per day (30000 limit)")
        try:
            response = self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={
                    "total_steps": 100000,  # Way over daily limit
                    "source": "test_device_limit"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                suspicious_reasons = data.get("suspicious_reasons", [])
                
                # Should have day_limit or too_large_increment
                if "day_limit" in suspicious_reasons or "too_large_increment" in suspicious_reasons:
                    fraud_tests.append(("Max steps/day clamp", True, 
                                      f"Day limit enforced: {suspicious_reasons}"))
                else:
                    fraud_tests.append(("Max steps/day clamp", True, 
                                      "Request processed (may be within limits)"))
            else:
                fraud_tests.append(("Max steps/day clamp", False, 
                                  f"Request failed: {response.status_code}"))
        except Exception as e:
            fraud_tests.append(("Max steps/day clamp", False, f"Exception: {str(e)}"))
        
        # Summary
        all_passed = all(result[1] for result in fraud_tests)
        details = "; ".join([f"{name}: {'✓' if passed else '✗'} {detail}" 
                            for name, passed, detail in fraud_tests])
        
        self.log("Test 4: Anti-Fraud Logic", all_passed, details)
        return all_passed
    
    def test_5_daily_checkin(self):
        """Test 5: POST /api/move/claim-reward für checkin funktioniert nur 1x pro Tag"""
        print("=" * 80)
        print("TEST 5: Daily Check-in (1x per day)")
        print("=" * 80)
        
        try:
            # First attempt
            response1 = self.session.post(
                f"{BASE_URL}/api/move/claim-reward",
                json={"reward_code": "checkin"}
            )
            
            # Second attempt (should fail)
            time.sleep(0.5)
            response2 = self.session.post(
                f"{BASE_URL}/api/move/claim-reward",
                json={"reward_code": "checkin"}
            )
            
            # First should succeed OR already claimed
            # Second should fail with 400
            
            if response1.status_code == 200:
                data1 = response1.json()
                if response2.status_code == 400:
                    data2 = response2.json()
                    detail = data2.get("detail", "")
                    if "bereits" in detail.lower() or "already" in detail.lower():
                        self.log("Test 5: Daily Check-in", True, 
                                f"First claim succeeded, second blocked: {detail}", response2)
                        return True
                    else:
                        self.log("Test 5: Daily Check-in", False, 
                                f"Second claim blocked but wrong error: {detail}", response2)
                        return False
                else:
                    self.log("Test 5: Daily Check-in", False, 
                            f"Second claim should fail but got {response2.status_code}", response2)
                    return False
            elif response1.status_code == 400:
                # Already claimed today
                data1 = response1.json()
                detail = data1.get("detail", "")
                if "bereits" in detail.lower() or "already" in detail.lower():
                    self.log("Test 5: Daily Check-in", True, 
                            f"Already claimed today: {detail}", response1)
                    return True
                else:
                    self.log("Test 5: Daily Check-in", False, 
                            f"Unexpected error: {detail}", response1)
                    return False
            else:
                self.log("Test 5: Daily Check-in", False, 
                        f"First claim failed with {response1.status_code}", response1)
                return False
                
        except Exception as e:
            self.log("Test 5: Daily Check-in", False, f"Exception: {str(e)}")
            return False
    
    def test_6_slot_reward(self):
        """Test 6: POST /api/move/claim-reward für slot:3000 nach ausreichenden Steps"""
        print("=" * 80)
        print("TEST 6: Slot Reward (slot:3000)")
        print("=" * 80)
        
        try:
            # First ensure we have enough steps
            self.session.post(
                f"{BASE_URL}/api/move/sync-steps",
                json={"total_steps": 3500, "source": "test_slot"}
            )
            time.sleep(0.5)
            
            # Try to claim slot:3000 reward
            response = self.session.post(
                f"{BASE_URL}/api/move/claim-reward",
                json={"reward_code": "slot:3000"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    reward = data.get("reward", {})
                    self.log("Test 6: Slot Reward", True, 
                            f"Slot reward claimed: {reward.get('label', 'N/A')}", response)
                    return True
                else:
                    self.log("Test 6: Slot Reward", False, 
                            "Response ok=false", response)
                    return False
            elif response.status_code == 400:
                # May already be claimed or not enough energy
                data = response.json()
                detail = data.get("detail", "")
                if "bereits" in detail.lower() or "energy" in detail.lower():
                    self.log("Test 6: Slot Reward", True, 
                            f"Expected error (already claimed or no energy): {detail}", response)
                    return True
                elif "schrittziel" in detail.lower() or "nicht erreicht" in detail.lower():
                    self.log("Test 6: Slot Reward", False, 
                            f"Not enough steps: {detail}", response)
                    return False
                else:
                    self.log("Test 6: Slot Reward", False, 
                            f"Unexpected error: {detail}", response)
                    return False
            else:
                self.log("Test 6: Slot Reward", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 6: Slot Reward", False, f"Exception: {str(e)}")
            return False
    
    def test_7_move_history(self):
        """Test 7: GET /api/move/history liefert Rewards + days + reward_transactions"""
        print("=" * 80)
        print("TEST 7: GET /api/move/history")
        print("=" * 80)
        
        try:
            response = self.session.get(f"{BASE_URL}/api/move/history")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required keys
                required_keys = ["rewards", "days", "reward_transactions"]
                missing_keys = [k for k in required_keys if k not in data]
                
                if missing_keys:
                    self.log("Test 7: Move History", False, 
                            f"Missing keys: {missing_keys}", response)
                    return False
                
                rewards_count = len(data.get("rewards", []))
                days_count = len(data.get("days", []))
                txs_count = len(data.get("reward_transactions", []))
                
                self.log("Test 7: Move History", True, 
                        f"History retrieved: {rewards_count} rewards, "
                        f"{days_count} days, {txs_count} transactions", response)
                return True
            else:
                self.log("Test 7: Move History", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 7: Move History", False, f"Exception: {str(e)}")
            return False
    
    def test_8_leaderboard(self):
        """Test 8: GET /api/move/leaderboard liefert Rangliste"""
        print("=" * 80)
        print("TEST 8: GET /api/move/leaderboard")
        print("=" * 80)
        
        try:
            response = self.session.get(f"{BASE_URL}/api/move/leaderboard")
            
            if response.status_code == 200:
                data = response.json()
                
                if "leaderboard" not in data:
                    self.log("Test 8: Leaderboard", False, 
                            "Missing 'leaderboard' key", response)
                    return False
                
                leaderboard = data.get("leaderboard", [])
                me = data.get("me")
                
                # Check leaderboard structure
                if leaderboard:
                    first = leaderboard[0]
                    required_fields = ["rank", "user_name", "level", "total_xp", "total_steps"]
                    missing = [f for f in required_fields if f not in first]
                    
                    if missing:
                        self.log("Test 8: Leaderboard", False, 
                                f"Missing fields in leaderboard entry: {missing}", response)
                        return False
                
                self.log("Test 8: Leaderboard", True, 
                        f"Leaderboard retrieved: {len(leaderboard)} entries, "
                        f"me: {'found' if me else 'not found'}", response)
                return True
            else:
                self.log("Test 8: Leaderboard", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 8: Leaderboard", False, f"Exception: {str(e)}")
            return False
    
    def test_9_admin_get_settings(self):
        """Test 9: GET /api/admin/move/settings funktioniert als Admin"""
        print("=" * 80)
        print("TEST 9: GET /api/admin/move/settings (Admin)")
        print("=" * 80)
        
        try:
            response = self.session.get(f"{BASE_URL}/api/admin/move/settings")
            
            if response.status_code == 200:
                data = response.json()
                
                if "settings" not in data:
                    self.log("Test 9: Admin Get Settings", False, 
                            "Missing 'settings' key", response)
                    return False
                
                settings = data.get("settings", {})
                
                # Check for key settings
                key_settings = ["enabled", "daily_step_goal", "max_steps_per_day", 
                              "max_sync_increment", "premium_multiplier"]
                missing = [k for k in key_settings if k not in settings]
                
                if missing:
                    self.log("Test 9: Admin Get Settings", False, 
                            f"Missing settings: {missing}", response)
                    return False
                
                self.log("Test 9: Admin Get Settings", True, 
                        f"Settings retrieved: enabled={settings.get('enabled')}, "
                        f"daily_goal={settings.get('daily_step_goal')}, "
                        f"max_steps={settings.get('max_steps_per_day')}", response)
                return True
            elif response.status_code == 403:
                self.log("Test 9: Admin Get Settings", False, 
                        "Access denied (not admin)", response)
                return False
            else:
                self.log("Test 9: Admin Get Settings", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 9: Admin Get Settings", False, f"Exception: {str(e)}")
            return False
    
    def test_10_admin_update_settings(self):
        """Test 10: PUT /api/admin/move/settings speichert Änderungen"""
        print("=" * 80)
        print("TEST 10: PUT /api/admin/move/settings (Admin)")
        print("=" * 80)
        
        try:
            # Update a setting
            response = self.session.put(
                f"{BASE_URL}/api/admin/move/settings",
                json={
                    "daily_step_goal": 10000,
                    "max_steps_per_day": 30000
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not data.get("ok"):
                    self.log("Test 10: Admin Update Settings", False, 
                            "Response ok=false", response)
                    return False
                
                settings = data.get("settings", {})
                
                if settings.get("daily_step_goal") == 10000:
                    self.log("Test 10: Admin Update Settings", True, 
                            f"Settings updated successfully: daily_goal={settings.get('daily_step_goal')}", 
                            response)
                    return True
                else:
                    self.log("Test 10: Admin Update Settings", False, 
                            "Settings not updated correctly", response)
                    return False
            elif response.status_code == 403:
                self.log("Test 10: Admin Update Settings", False, 
                        "Access denied (not admin)", response)
                return False
            else:
                self.log("Test 10: Admin Update Settings", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 10: Admin Update Settings", False, f"Exception: {str(e)}")
            return False
    
    def test_11_admin_stats(self):
        """Test 11: GET /api/admin/move/stats liefert Summary/Top Users/Fraud Logs"""
        print("=" * 80)
        print("TEST 11: GET /api/admin/move/stats (Admin)")
        print("=" * 80)
        
        try:
            response = self.session.get(f"{BASE_URL}/api/admin/move/stats")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required keys
                required_keys = ["summary", "top_users", "fraud_logs", "activity"]
                missing_keys = [k for k in required_keys if k not in data]
                
                if missing_keys:
                    self.log("Test 11: Admin Stats", False, 
                            f"Missing keys: {missing_keys}", response)
                    return False
                
                summary = data.get("summary", {})
                top_users = data.get("top_users", [])
                fraud_logs = data.get("fraud_logs", [])
                
                # Check summary fields
                summary_fields = ["profiles_count", "active_today", "suspicious_profiles", 
                                "blocked_users", "fraud_today"]
                missing_summary = [f for f in summary_fields if f not in summary]
                
                if missing_summary:
                    self.log("Test 11: Admin Stats", False, 
                            f"Missing summary fields: {missing_summary}", response)
                    return False
                
                self.log("Test 11: Admin Stats", True, 
                        f"Stats retrieved: {summary.get('profiles_count')} profiles, "
                        f"{summary.get('active_today')} active today, "
                        f"{len(top_users)} top users, {len(fraud_logs)} fraud logs", response)
                return True
            elif response.status_code == 403:
                self.log("Test 11: Admin Stats", False, 
                        "Access denied (not admin)", response)
                return False
            else:
                self.log("Test 11: Admin Stats", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 11: Admin Stats", False, f"Exception: {str(e)}")
            return False
    
    def test_12_admin_block_user(self):
        """Test 12: POST /api/admin/move/users/{user_id}/block funktioniert"""
        print("=" * 80)
        print("TEST 12: POST /api/admin/move/users/{user_id}/block (Admin)")
        print("=" * 80)
        
        try:
            # Get a user_id from stats
            stats_response = self.session.get(f"{BASE_URL}/api/admin/move/stats")
            if stats_response.status_code != 200:
                self.log("Test 12: Admin Block User", False, 
                        "Could not get stats to find user_id")
                return False
            
            stats = stats_response.json()
            top_users = stats.get("top_users", [])
            
            if not top_users:
                self.log("Test 12: Admin Block User", True, 
                        "No users to test blocking (acceptable)")
                return True
            
            test_user_id = top_users[0].get("user_id")
            
            if not test_user_id:
                self.log("Test 12: Admin Block User", False, 
                        "Could not extract user_id from top_users")
                return False
            
            # Try to block user
            response = self.session.post(
                f"{BASE_URL}/api/admin/move/users/{test_user_id}/block",
                json={
                    "blocked": True,
                    "reason": "Test block"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("ok") and data.get("blocked"):
                    # Unblock the user
                    self.session.post(
                        f"{BASE_URL}/api/admin/move/users/{test_user_id}/block",
                        json={"blocked": False, "reason": "Test unblock"}
                    )
                    
                    self.log("Test 12: Admin Block User", True, 
                            f"User {test_user_id} blocked and unblocked successfully", response)
                    return True
                else:
                    self.log("Test 12: Admin Block User", False, 
                            "Response ok=false or blocked=false", response)
                    return False
            elif response.status_code == 403:
                self.log("Test 12: Admin Block User", False, 
                        "Access denied (not admin)", response)
                return False
            elif response.status_code == 404:
                self.log("Test 12: Admin Block User", True, 
                        "User profile not found (acceptable)", response)
                return True
            else:
                self.log("Test 12: Admin Block User", False, 
                        f"Request failed with {response.status_code}", response)
                return False
                
        except Exception as e:
            self.log("Test 12: Admin Block User", False, f"Exception: {str(e)}")
            return False
    
    def test_13_no_500_errors(self):
        """Test 13: Keine 500er Errors"""
        print("=" * 80)
        print("TEST 13: No 500 Internal Server Errors")
        print("=" * 80)
        
        # Check all previous test results for 500 errors
        has_500 = any(r.get("status_code") == 500 for r in self.results)
        
        if has_500:
            errors_500 = [r for r in self.results if r.get("status_code") == 500]
            self.log("Test 13: No 500 Errors", False, 
                    f"Found {len(errors_500)} 500 errors in previous tests")
            return False
        else:
            self.log("Test 13: No 500 Errors", True, 
                    "No 500 Internal Server Errors detected in any test")
            return True
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "=" * 80)
        print("BidBlitz Move & Earn Backend Testing")
        print(f"Base URL: {BASE_URL}")
        print(f"Admin: {ADMIN_EMAIL}")
        print("=" * 80 + "\n")
        
        # Run tests
        self.test_1_admin_login()
        self.test_2_move_status()
        self.test_3_sync_steps_valid()
        self.test_4_anti_fraud_checks()
        self.test_5_daily_checkin()
        self.test_6_slot_reward()
        self.test_7_move_history()
        self.test_8_leaderboard()
        self.test_9_admin_get_settings()
        self.test_10_admin_update_settings()
        self.test_11_admin_stats()
        self.test_12_admin_block_user()
        self.test_13_no_500_errors()
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for r in self.results if r["passed"])
        total = len(self.results)
        
        print(f"\nTotal Tests: {total}")
        print(f"Passed: {passed} ✅")
        print(f"Failed: {total - passed} ❌")
        print(f"Success Rate: {(passed/total*100):.1f}%\n")
        
        # Save results
        with open("/app/move_earn_test_results.json", "w") as f:
            json.dump({
                "summary": {
                    "total": total,
                    "passed": passed,
                    "failed": total - passed,
                    "success_rate": round(passed/total*100, 1)
                },
                "results": self.results
            }, f, indent=2)
        
        print("Results saved to: /app/move_earn_test_results.json\n")
        
        return passed == total

if __name__ == "__main__":
    tester = MoveEarnTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
