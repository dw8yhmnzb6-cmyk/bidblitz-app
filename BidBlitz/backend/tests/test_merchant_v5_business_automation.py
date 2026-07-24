"""
Merchant Platform V5 - Business Automation API Tests
Tests for:
- Login redirect fix (URL should change to / after successful login)
- Business Automation Dashboard GET
- Business Automation Settings POST
- Business Automation Run endpoints (procurement, operations, revenue, full)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"


class TestMerchantV5BusinessAutomation:
    """Business Automation API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.login_data = login_response.json()
        yield
        # Cleanup - logout
        try:
            self.session.post(f"{BASE_URL}/api/auth/logout")
        except:
            pass
    
    def test_login_returns_user_data(self):
        """Test that login returns user data with role"""
        assert "user" in self.login_data or "email" in self.login_data
        print(f"Login successful, user data: {self.login_data.get('user', {}).get('email', self.login_data.get('email'))}")
    
    def test_get_business_automation_dashboard(self):
        """GET /api/merchant-portal/v5/business-automation returns structured data"""
        response = self.session.get(f"{BASE_URL}/api/merchant-portal/v5/business-automation")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "settings" in data, "Missing 'settings' in response"
        assert "overview" in data, "Missing 'overview' in response"
        assert "procurement" in data, "Missing 'procurement' in response"
        assert "operations" in data, "Missing 'operations' in response"
        assert "revenue" in data, "Missing 'revenue' in response"
        assert "history" in data, "Missing 'history' in response"
        
        # Verify settings structure
        settings = data["settings"]
        assert "procurement_enabled" in settings
        assert "operations_enabled" in settings
        assert "revenue_enabled" in settings
        assert "reorder_days_cover_threshold" in settings
        assert "flash_sale_discount_pct" in settings
        assert "flash_sale_duration_minutes" in settings
        assert "late_shift_grace_minutes" in settings
        
        # Verify overview structure
        overview = data["overview"]
        assert "procurement_actions" in overview
        assert "operations_actions" in overview
        assert "revenue_actions" in overview
        assert "open_automation_tasks" in overview
        
        print(f"Business Automation Dashboard: overview={overview}")
        print(f"Settings: {settings}")
    
    def test_update_business_automation_settings(self):
        """POST /api/merchant-portal/v5/business-automation/settings saves values"""
        # Update settings
        update_payload = {
            "procurement_enabled": True,
            "operations_enabled": True,
            "revenue_enabled": True,
            "reorder_days_cover_threshold": 21,
            "flash_sale_discount_pct": 20,
            "flash_sale_duration_minutes": 240,
            "late_shift_grace_minutes": 10
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/merchant-portal/v5/business-automation/settings",
            json=update_payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Expected ok=True in response"
        assert "settings" in data, "Missing 'settings' in response"
        
        # Verify settings were updated
        settings = data["settings"]
        assert settings.get("reorder_days_cover_threshold") == 21
        assert settings.get("flash_sale_discount_pct") == 20
        assert settings.get("flash_sale_duration_minutes") == 240
        assert settings.get("late_shift_grace_minutes") == 10
        
        print(f"Settings updated successfully: {settings}")
        
        # Verify persistence by fetching again
        get_response = self.session.get(f"{BASE_URL}/api/merchant-portal/v5/business-automation")
        assert get_response.status_code == 200
        fetched_settings = get_response.json().get("settings", {})
        assert fetched_settings.get("reorder_days_cover_threshold") == 21
        print("Settings persisted correctly")
    
    def test_run_procurement_automation(self):
        """POST /api/merchant-portal/v5/business-automation/run/procurement works"""
        response = self.session.post(
            f"{BASE_URL}/api/merchant-portal/v5/business-automation/run/procurement",
            json={"max_purchase_orders": 4}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Expected ok=True in response"
        assert "run" in data, "Missing 'run' in response"
        assert "purchase_orders" in data, "Missing 'purchase_orders' in response"
        
        run = data["run"]
        assert run.get("run_type") == "procurement"
        assert run.get("status") in ["completed", "skipped"], f"Unexpected status: {run.get('status')}"
        
        print(f"Procurement run: status={run.get('status')}, summary={run.get('summary')}")
        print(f"Purchase orders created: {len(data.get('purchase_orders', []))}")
    
    def test_run_operations_automation(self):
        """POST /api/merchant-portal/v5/business-automation/run/operations works"""
        response = self.session.post(
            f"{BASE_URL}/api/merchant-portal/v5/business-automation/run/operations",
            json={"assign_late_staff_tasks": True, "convert_alerts_to_tasks": True}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Expected ok=True in response"
        assert "run" in data, "Missing 'run' in response"
        assert "tasks" in data, "Missing 'tasks' in response"
        
        run = data["run"]
        assert run.get("run_type") == "operations"
        assert run.get("status") in ["completed", "skipped"], f"Unexpected status: {run.get('status')}"
        
        print(f"Operations run: status={run.get('status')}, summary={run.get('summary')}")
        print(f"Tasks created: {len(data.get('tasks', []))}")
    
    def test_run_revenue_automation(self):
        """POST /api/merchant-portal/v5/business-automation/run/revenue works"""
        response = self.session.post(
            f"{BASE_URL}/api/merchant-portal/v5/business-automation/run/revenue",
            json={"limit": 3}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Expected ok=True in response"
        assert "run" in data, "Missing 'run' in response"
        assert "flash_sales" in data, "Missing 'flash_sales' in response"
        
        run = data["run"]
        assert run.get("run_type") == "revenue"
        assert run.get("status") in ["completed", "skipped"], f"Unexpected status: {run.get('status')}"
        
        print(f"Revenue run: status={run.get('status')}, summary={run.get('summary')}")
        print(f"Flash sales created: {len(data.get('flash_sales', []))}")
    
    def test_run_full_automation(self):
        """POST /api/merchant-portal/v5/business-automation/run/full works without 500 error"""
        response = self.session.post(f"{BASE_URL}/api/merchant-portal/v5/business-automation/run/full")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("ok") == True, "Expected ok=True in response"
        assert "summary" in data, "Missing 'summary' in response"
        assert "run" in data, "Missing 'run' in response"
        assert "procurement" in data, "Missing 'procurement' in response"
        assert "operations" in data, "Missing 'operations' in response"
        assert "revenue" in data, "Missing 'revenue' in response"
        
        summary = data["summary"]
        assert "purchase_orders_created" in summary
        assert "tasks_created" in summary
        assert "flash_sales_created" in summary
        
        run = data["run"]
        assert run.get("run_type") == "full"
        assert run.get("status") == "completed"
        
        print(f"Full automation run completed: {summary}")
        print(f"Run details: {run.get('summary')}")
    
    def test_automation_history_updated_after_run(self):
        """Verify automation history is updated after a run"""
        # Run full automation
        self.session.post(f"{BASE_URL}/api/merchant-portal/v5/business-automation/run/full")
        
        # Get dashboard and check history
        response = self.session.get(f"{BASE_URL}/api/merchant-portal/v5/business-automation")
        assert response.status_code == 200
        
        data = response.json()
        history = data.get("history", [])
        
        # Should have at least one entry
        assert len(history) > 0, "Expected at least one history entry after run"
        
        # Most recent should be a full run
        latest = history[0]
        assert "run_id" in latest
        assert "run_type" in latest
        assert "status" in latest
        assert "created_at" in latest
        
        print(f"History has {len(history)} entries")
        print(f"Latest run: type={latest.get('run_type')}, status={latest.get('status')}")


class TestLoginRedirect:
    """Test that login doesn't get stuck on /login"""
    
    def test_login_success_returns_user(self):
        """Login should return user data for redirect handling"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Should return user data that frontend uses to determine redirect
        assert "user" in data or "email" in data or "role" in data
        print(f"Login response contains user data for redirect: {list(data.keys())}")
        
        # Verify we can access authenticated endpoints
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, "Should be able to access /me after login"
        print("Auth session established correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
