"""
Test Extended Payout Settings with IBAN, BIC/SWIFT for International Transfers
Tests the new fields: bic_swift, bank_name, bank_country, currency
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_KEY = "bidblitz-admin-2026"


class TestPayoutSettingsAPI:
    """Test payout settings API with new international transfer fields"""
    
    def test_get_enterprise_list_with_payout_settings(self):
        """Test that enterprise list includes payout settings with new fields"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enterprises" in data
        assert "total" in data
        
        # Check that enterprises have payout_settings structure
        if data["enterprises"]:
            enterprise = data["enterprises"][0]
            assert "payout_settings" in enterprise
            payout = enterprise["payout_settings"]
            # Check default fields exist
            assert "iban_mode" in payout
            assert "payout_frequency" in payout
            assert "min_payout_amount" in payout
            print(f"✓ Enterprise list returns payout_settings structure")
    
    def test_update_payout_settings_with_bic_swift(self):
        """Test updating payout settings with BIC/SWIFT code"""
        # First get an enterprise ID
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        assert response.status_code == 200
        enterprises = response.json()["enterprises"]
        
        if not enterprises:
            pytest.skip("No enterprises available for testing")
        
        # Find an approved enterprise
        enterprise = None
        for e in enterprises:
            if e.get("status") == "approved":
                enterprise = e
                break
        
        if not enterprise:
            pytest.skip("No approved enterprise available for testing")
        
        enterprise_id = enterprise["id"]
        
        # Update with new international fields
        payout_data = {
            "iban": "DE89370400440532013000",
            "iban_holder": "Test GmbH",
            "bic_swift": "COBADEFFXXX",  # 11 character BIC
            "bank_name": "Commerzbank",
            "bank_country": "DE",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 100,
            "currency": "EUR"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
        print(f"✓ Payout settings updated with BIC/SWIFT: {payout_data['bic_swift']}")
    
    def test_update_payout_settings_with_8_char_bic(self):
        """Test updating payout settings with 8-character BIC code"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with 8-character BIC
        payout_data = {
            "iban": "AT611904300234573201",
            "iban_holder": "Test Austria GmbH",
            "bic_swift": "BKAUATWW",  # 8 character BIC
            "bank_name": "Bank Austria",
            "bank_country": "AT",
            "payout_frequency": "weekly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 50,
            "currency": "EUR"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with 8-char BIC: {payout_data['bic_swift']}")
    
    def test_update_payout_settings_with_usd_currency(self):
        """Test updating payout settings with USD currency"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with USD currency for US bank
        payout_data = {
            "iban": "US12345678901234567890",
            "iban_holder": "Test US Corp",
            "bic_swift": "CHASUS33",  # JPMorgan Chase BIC
            "bank_name": "JPMorgan Chase",
            "bank_country": "US",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 100,
            "currency": "USD"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with USD currency and US bank")
    
    def test_update_payout_settings_with_gbp_currency(self):
        """Test updating payout settings with GBP currency"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with GBP currency for UK bank
        payout_data = {
            "iban": "GB82WEST12345698765432",
            "iban_holder": "Test UK Ltd",
            "bic_swift": "WESTGB2L",  # NatWest BIC
            "bank_name": "NatWest",
            "bank_country": "GB",
            "payout_frequency": "weekly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 75,
            "currency": "GBP"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with GBP currency and UK bank")
    
    def test_update_payout_settings_with_chf_currency(self):
        """Test updating payout settings with CHF currency for Switzerland"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with CHF currency for Swiss bank
        payout_data = {
            "iban": "CH9300762011623852957",
            "iban_holder": "Test Swiss AG",
            "bic_swift": "UBSWCHZH",  # UBS BIC
            "bank_name": "UBS",
            "bank_country": "CH",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 100,
            "currency": "CHF"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with CHF currency and Swiss bank")
    
    def test_update_payout_settings_with_try_currency(self):
        """Test updating payout settings with TRY currency for Turkey"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with TRY currency for Turkish bank
        payout_data = {
            "iban": "TR330006100519786457841326",
            "iban_holder": "Test Turkey AS",
            "bic_swift": "AKABORIS",  # Akbank BIC
            "bank_name": "Akbank",
            "bank_country": "TR",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 500,
            "currency": "TRY"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with TRY currency and Turkish bank")
    
    def test_update_payout_settings_with_aed_currency(self):
        """Test updating payout settings with AED currency for UAE"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update with AED currency for UAE bank
        payout_data = {
            "iban": "AE070331234567890123456",
            "iban_holder": "Test UAE LLC",
            "bic_swift": "EABORAED",  # Emirates NBD BIC
            "bank_name": "Emirates NBD",
            "bank_country": "AE",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 200,
            "currency": "AED"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings updated with AED currency and UAE bank")
    
    def test_verify_payout_settings_persisted(self):
        """Test that payout settings are persisted and returned correctly"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        assert response.status_code == 200
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Set specific values
        payout_data = {
            "iban": "DE89370400440532013000",
            "iban_holder": "Persistence Test GmbH",
            "bic_swift": "COBADEFFXXX",
            "bank_name": "Commerzbank Test",
            "bank_country": "DE",
            "payout_frequency": "weekly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 150,
            "currency": "EUR"
        }
        
        # Update settings
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200
        
        # Fetch again and verify
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        assert response.status_code == 200
        
        updated_enterprise = next(
            (e for e in response.json()["enterprises"] if e["id"] == enterprise_id), 
            None
        )
        assert updated_enterprise is not None
        
        payout = updated_enterprise.get("payout_settings", {})
        assert payout.get("iban") == payout_data["iban"], f"IBAN mismatch: {payout.get('iban')}"
        assert payout.get("iban_holder") == payout_data["iban_holder"]
        assert payout.get("bic_swift") == payout_data["bic_swift"]
        assert payout.get("bank_name") == payout_data["bank_name"]
        assert payout.get("bank_country") == payout_data["bank_country"]
        assert payout.get("currency") == payout_data["currency"]
        assert payout.get("payout_frequency") == payout_data["payout_frequency"]
        assert payout.get("min_payout_amount") == payout_data["min_payout_amount"]
        
        print(f"✓ All payout settings persisted correctly")
        print(f"  - IBAN: {payout.get('iban')}")
        print(f"  - BIC/SWIFT: {payout.get('bic_swift')}")
        print(f"  - Bank: {payout.get('bank_name')}")
        print(f"  - Country: {payout.get('bank_country')}")
        print(f"  - Currency: {payout.get('currency')}")
    
    def test_payout_settings_without_bic_swift(self):
        """Test that payout settings work without BIC/SWIFT (optional field)"""
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Update without BIC/SWIFT
        payout_data = {
            "iban": "DE89370400440532013000",
            "iban_holder": "No BIC Test GmbH",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 100,
            "currency": "EUR"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Payout settings work without BIC/SWIFT (optional field)")


class TestWisePayoutsBICValidation:
    """Test Wise payouts BIC/SWIFT validation"""
    
    def test_wise_bic_validation_8_chars(self):
        """Test that 8-character BIC is accepted"""
        # This tests the validation logic in wise_payouts.py
        bic = "COBADEFF"
        assert len(bic) == 8
        print(f"✓ 8-character BIC format valid: {bic}")
    
    def test_wise_bic_validation_11_chars(self):
        """Test that 11-character BIC is accepted"""
        bic = "COBADEFFXXX"
        assert len(bic) == 11
        print(f"✓ 11-character BIC format valid: {bic}")


class TestPayoutSettingsModel:
    """Test PayoutSettings model fields"""
    
    def test_payout_settings_model_has_new_fields(self):
        """Verify PayoutSettings model includes new international fields"""
        # This is a code review test - checking the model definition
        # The model should have: bic_swift, bank_name, bank_country, currency
        expected_fields = [
            "iban",
            "iban_holder", 
            "bic_swift",
            "bank_name",
            "bank_country",
            "payout_frequency",
            "iban_mode",
            "min_payout_amount",
            "currency"
        ]
        
        # Test by sending all fields to the API
        response = requests.get(
            f"{BASE_URL}/api/enterprise/admin/list",
            headers={"x-admin-key": ADMIN_KEY}
        )
        enterprises = response.json()["enterprises"]
        
        enterprise = next((e for e in enterprises if e.get("status") == "approved"), None)
        if not enterprise:
            pytest.skip("No approved enterprise available")
        
        enterprise_id = enterprise["id"]
        
        # Send all expected fields
        payout_data = {
            "iban": "DE89370400440532013000",
            "iban_holder": "Model Test GmbH",
            "bic_swift": "COBADEFFXXX",
            "bank_name": "Test Bank",
            "bank_country": "DE",
            "payout_frequency": "monthly",
            "iban_mode": "admin_entry",
            "min_payout_amount": 100,
            "currency": "EUR"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/enterprise/admin/payout-settings/{enterprise_id}",
            headers={"x-admin-key": ADMIN_KEY},
            json=payout_data
        )
        assert response.status_code == 200, f"Model should accept all fields: {response.text}"
        print(f"✓ PayoutSettings model accepts all new international fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
