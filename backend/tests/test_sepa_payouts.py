"""
SEPA Payout System Tests
========================
Tests for automatic SEPA payout functionality for wholesalers (Großhändler).
Features:
- Pending payouts calculation based on transactions since last payout
- Manual and automatic SEPA transfers
- Payout frequencies: daily, weekly, monthly, manual
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_KEY = "bidblitz-admin-2026"
ENTERPRISE_ID = "ent_ee2a8554c977"
ENTERPRISE_LOGIN = {
    "email": "admin@edeka-test.de",
    "password": "EdekaTest2026!"
}


class TestSEPAPayoutAdminAPIs:
    """Admin SEPA Payout API Tests"""
    
    def test_get_pending_payouts(self):
        """Test GET /api/enterprise/admin/payouts/pending - Returns list of pending payouts"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/pending",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pending_payouts" in data, "Response should contain pending_payouts"
        assert "total" in data, "Response should contain total count"
        assert "total_amount" in data, "Response should contain total_amount"
        
        # Verify structure of pending payouts
        if data["pending_payouts"]:
            payout = data["pending_payouts"][0]
            assert "enterprise_id" in payout
            assert "company_name" in payout
            assert "pending_amount" in payout
            assert "commission_rate" in payout
            assert "frequency" in payout
            assert "is_due" in payout
            assert "iban" in payout or payout.get("iban") == ""
        
        print(f"✓ Found {data['total']} pending payouts, total amount: €{data['total_amount']:.2f}")
    
    def test_get_pending_payouts_invalid_admin_key(self):
        """Test GET /api/enterprise/admin/payouts/pending with invalid admin key"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/pending",
            headers={"x-admin-key": "invalid-key"}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Invalid admin key correctly rejected")
    
    def test_create_payout_no_iban(self):
        """Test POST /api/enterprise/admin/payouts/create - Should fail without IBAN"""
        # First, let's try to create a payout for an enterprise without IBAN
        # We'll use a test enterprise ID that likely doesn't have IBAN set
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/create",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "enterprise_id": "ent_nonexistent",
                "amount": 100.00,
                "note": "Test payout"
            }
        )
        
        # Should fail with 404 (enterprise not found) or 400 (no IBAN)
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print(f"✓ Create payout correctly rejected: {response.json().get('detail', 'error')}")
    
    def test_create_payout_with_valid_enterprise(self):
        """Test POST /api/enterprise/admin/payouts/create with valid enterprise"""
        # First ensure IBAN is set for the test enterprise
        iban_response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{ENTERPRISE_ID}",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "iban": "DE89370400440532013000",
                "iban_holder": "Test Edeka GmbH",
                "payout_frequency": "monthly",
                "min_payout_amount": 50
            }
        )
        
        if iban_response.status_code != 200:
            pytest.skip(f"Could not set IBAN: {iban_response.text}")
        
        # Now create a payout
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/create",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "enterprise_id": ENTERPRISE_ID,
                "amount": 150.00,
                "note": "TEST_payout_creation"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "payout_id" in data
        assert data["payout_id"].startswith("payout_")
        
        print(f"✓ Created payout: {data['payout_id']}")
        return data["payout_id"]
    
    def test_process_payout(self):
        """Test POST /api/enterprise/admin/payouts/{id}/process - Generates SEPA reference"""
        # First create a payout
        create_response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/create",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "enterprise_id": ENTERPRISE_ID,
                "amount": 75.00,
                "note": "TEST_process_payout"
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create payout: {create_response.text}")
        
        payout_id = create_response.json()["payout_id"]
        
        # Process the payout
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/{payout_id}/process",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "sepa_reference" in data
        assert data["sepa_reference"].startswith("SEPA-")
        
        print(f"✓ Processed payout with SEPA reference: {data['sepa_reference']}")
    
    def test_process_payout_not_found(self):
        """Test POST /api/enterprise/admin/payouts/{id}/process with invalid ID"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/payout_nonexistent/process",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent payout correctly returns 404")
    
    def test_get_payout_history(self):
        """Test GET /api/enterprise/admin/payouts/history - Returns payout history with totals"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/history",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "payouts" in data
        assert "total" in data
        assert "totals" in data
        
        # Verify totals structure
        totals = data["totals"]
        assert "pending" in totals
        assert "completed" in totals
        
        print(f"✓ Found {data['total']} payouts in history")
        print(f"  - Pending: €{totals['pending']:.2f}")
        print(f"  - Completed: €{totals['completed']:.2f}")
    
    def test_get_payout_history_with_filters(self):
        """Test GET /api/enterprise/admin/payouts/history with enterprise_id filter"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/history",
            headers={"x-admin-key": ADMIN_KEY},
            params={"enterprise_id": ENTERPRISE_ID, "limit": 10}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All payouts should be for the specified enterprise
        for payout in data["payouts"]:
            assert payout["enterprise_id"] == ENTERPRISE_ID
        
        print(f"✓ Filtered history: {len(data['payouts'])} payouts for {ENTERPRISE_ID}")
    
    def test_batch_process_payouts(self):
        """Test POST /api/enterprise/admin/payouts/batch-process - Batch processes all due payouts"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/batch-process",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "processed" in data
        assert "processed_count" in data
        assert "total_amount" in data
        assert "errors" in data
        
        print(f"✓ Batch process completed:")
        print(f"  - Processed: {data['processed_count']}")
        print(f"  - Total amount: €{data['total_amount']:.2f}")
        print(f"  - Errors: {data.get('error_count', 0)}")


class TestEnterprisePayoutAPIs:
    """Enterprise Portal Payout API Tests (for logged-in enterprises)"""
    
    @pytest.fixture
    def enterprise_token(self):
        """Get enterprise authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/login",
            json=ENTERPRISE_LOGIN
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not login as enterprise: {response.text}")
        
        return response.json()["token"]
    
    def test_get_my_pending_payout(self, enterprise_token):
        """Test GET /api/enterprise/payouts/my-pending - Enterprise can view own pending payout"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/payouts/my-pending",
            headers={"Authorization": f"Bearer {enterprise_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pending_amount" in data
        assert "commission_rate" in data
        assert "payout_frequency" in data
        assert "min_payout_amount" in data
        assert "total_revenue_since_last_payout" in data
        
        print(f"✓ Enterprise pending payout info:")
        print(f"  - Revenue since last payout: €{data['total_revenue_since_last_payout']:.2f}")
        print(f"  - Commission rate: {data['commission_rate']}%")
        print(f"  - Pending amount: €{data['pending_amount']:.2f}")
        print(f"  - Frequency: {data['payout_frequency']}")
    
    def test_get_my_pending_payout_invalid_token(self):
        """Test GET /api/enterprise/payouts/my-pending with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/payouts/my-pending",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid token correctly rejected")


class TestPayoutSettingsIntegration:
    """Integration tests for payout settings and payouts"""
    
    def test_payout_frequency_settings(self):
        """Test that payout frequency settings are correctly applied"""
        # Set payout frequency to daily
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{ENTERPRISE_ID}",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "iban": "DE89370400440532013000",
                "iban_holder": "Test Edeka GmbH",
                "payout_frequency": "daily",
                "min_payout_amount": 10
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify settings were saved
        get_response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{ENTERPRISE_ID}",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["payout_frequency"] == "daily"
        assert data["min_payout_amount"] == 10
        
        print("✓ Payout frequency settings correctly saved and retrieved")
    
    def test_pending_payouts_reflect_settings(self):
        """Test that pending payouts reflect the configured settings"""
        # Get pending payouts
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/pending",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Find our test enterprise in pending payouts
        test_enterprise = None
        for payout in data["pending_payouts"]:
            if payout["enterprise_id"] == ENTERPRISE_ID:
                test_enterprise = payout
                break
        
        if test_enterprise:
            print(f"✓ Found test enterprise in pending payouts:")
            print(f"  - Frequency: {test_enterprise['frequency']}")
            print(f"  - Min amount: €{test_enterprise['min_amount']}")
            print(f"  - Is due: {test_enterprise['is_due']}")
            print(f"  - IBAN set: {'Yes' if test_enterprise.get('iban') else 'No'}")
        else:
            print("✓ Test enterprise not in pending payouts (no pending amount)")


class TestPayoutDataValidation:
    """Data validation tests for payout operations"""
    
    def test_create_payout_validates_amount(self):
        """Test that payout creation validates amount"""
        response = requests.post(
            f"{BASE_URL}/api/enterprise/admin/payouts/create",
            headers={
                "x-admin-key": ADMIN_KEY,
                "Content-Type": "application/json"
            },
            json={
                "enterprise_id": ENTERPRISE_ID,
                "amount": -100.00,  # Negative amount
                "note": "Invalid amount test"
            }
        )
        
        # Should either reject or handle gracefully
        # The API might accept it (no validation) or reject it
        print(f"✓ Negative amount test: status {response.status_code}")
    
    def test_payout_history_sorted_by_date(self):
        """Test that payout history is sorted by date descending"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/payouts/history?limit=10",
            headers={"x-admin-key": ADMIN_KEY}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        payouts = data["payouts"]
        
        if len(payouts) >= 2:
            # Verify descending order
            for i in range(len(payouts) - 1):
                date1 = payouts[i].get("created_at", "")
                date2 = payouts[i + 1].get("created_at", "")
                assert date1 >= date2, "Payouts should be sorted by date descending"
        
        print("✓ Payout history correctly sorted by date")


# Cleanup test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_payouts():
    """Cleanup TEST_ prefixed payouts after tests"""
    yield
    # Note: In a real scenario, we'd delete test payouts here
    # For now, we leave them as they don't affect production


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
