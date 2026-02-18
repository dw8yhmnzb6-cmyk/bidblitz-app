"""
Test Security API Endpoints for BidBlitz Pay
- Security Settings (GET/PUT)
- Biometric Credentials (GET/POST/DELETE)
- Transaction Verification (Fraud Detection)
- Activity Logging
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "Admin123!"
PARTNER_EMAIL = "wise-test@partner.com"
PARTNER_PASSWORD = "Test123!"


class TestSecurityAPI:
    """Security API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    # ==================== Security Settings Tests ====================
    
    def test_get_security_settings(self):
        """Test GET /api/security/settings - Get user's security settings"""
        response = self.session.get(f"{BASE_URL}/api/security/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "user_id" in data or "biometric_enabled" in data, "Response should contain security settings"
        
        # Check default settings structure
        expected_fields = ["biometric_enabled", "transaction_notifications", "login_notifications"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Security settings retrieved: biometric_enabled={data.get('biometric_enabled')}, "
              f"transaction_notifications={data.get('transaction_notifications')}")
    
    def test_update_security_settings_transaction_notifications(self):
        """Test PUT /api/security/settings - Update transaction notifications"""
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/security/settings")
        assert get_response.status_code == 200
        current_settings = get_response.json()
        
        # Toggle transaction_notifications
        new_value = not current_settings.get("transaction_notifications", True)
        
        response = self.session.put(
            f"{BASE_URL}/api/security/settings",
            params={"transaction_notifications": new_value}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should be successful"
        
        # Verify the change persisted
        verify_response = self.session.get(f"{BASE_URL}/api/security/settings")
        assert verify_response.status_code == 200
        updated_settings = verify_response.json()
        assert updated_settings.get("transaction_notifications") == new_value, "Setting should be updated"
        
        print(f"✓ Transaction notifications updated to: {new_value}")
    
    def test_update_security_settings_login_notifications(self):
        """Test PUT /api/security/settings - Update login notifications"""
        # Toggle login_notifications
        response = self.session.put(
            f"{BASE_URL}/api/security/settings",
            params={"login_notifications": True}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should be successful"
        
        print("✓ Login notifications setting updated")
    
    def test_update_security_settings_max_transaction_amount(self):
        """Test PUT /api/security/settings - Update max transaction amount"""
        new_max = 2000.0
        
        response = self.session.put(
            f"{BASE_URL}/api/security/settings",
            params={"max_transaction_amount": new_max}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the change
        verify_response = self.session.get(f"{BASE_URL}/api/security/settings")
        assert verify_response.status_code == 200
        updated_settings = verify_response.json()
        assert updated_settings.get("max_transaction_amount") == new_max, "Max transaction amount should be updated"
        
        print(f"✓ Max transaction amount updated to: €{new_max}")
    
    # ==================== Biometric Credentials Tests ====================
    
    def test_get_biometric_credentials(self):
        """Test GET /api/security/biometric-credentials - Get user's biometric credentials"""
        response = self.session.get(f"{BASE_URL}/api/security/biometric-credentials")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "credentials" in data, "Response should contain credentials array"
        assert isinstance(data["credentials"], list), "Credentials should be a list"
        
        print(f"✓ Biometric credentials retrieved: {len(data['credentials'])} credentials found")
    
    def test_register_biometric_credential(self):
        """Test POST /api/security/register-biometric - Register a new biometric credential"""
        test_credential_id = f"test_cred_{uuid.uuid4().hex[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/security/register-biometric",
            params={
                "credential_id": test_credential_id,
                "public_key": "test_public_key_base64_encoded",
                "device_name": "Test Device - Playwright",
                "auth_type": "fingerprint"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Registration should be successful"
        assert "credential_id" in data, "Response should contain credential_id"
        
        # Store for cleanup
        self.test_credential_id = data.get("credential_id")
        
        print(f"✓ Biometric credential registered: {data.get('credential_id')}")
        
        return data.get("credential_id")
    
    def test_delete_biometric_credential(self):
        """Test DELETE /api/security/biometric-credentials/{credential_id} - Remove a credential"""
        # First register a credential to delete
        test_credential_id = f"test_delete_{uuid.uuid4().hex[:8]}"
        
        register_response = self.session.post(
            f"{BASE_URL}/api/security/register-biometric",
            params={
                "credential_id": test_credential_id,
                "public_key": "test_public_key_to_delete",
                "device_name": "Test Device - To Delete",
                "auth_type": "passkey"
            }
        )
        
        assert register_response.status_code == 200
        credential_id = register_response.json().get("credential_id")
        
        # Now delete it
        delete_response = self.session.delete(
            f"{BASE_URL}/api/security/biometric-credentials/{credential_id}"
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert data.get("success") == True, "Deletion should be successful"
        
        print(f"✓ Biometric credential deleted: {credential_id}")
    
    # ==================== Transaction Verification (Fraud Detection) Tests ====================
    
    def test_verify_transaction_normal(self):
        """Test POST /api/security/verify-transaction - Normal transaction should be allowed"""
        response = self.session.post(
            f"{BASE_URL}/api/security/verify-transaction",
            params={
                "amount": 50.0,
                "transaction_type": "payment"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "allowed" in data, "Response should contain 'allowed' field"
        assert "risk_score" in data, "Response should contain 'risk_score' field"
        assert "action" in data, "Response should contain 'action' field"
        
        # Normal small transaction should be allowed
        assert data.get("allowed") == True, "Normal transaction should be allowed"
        assert data.get("risk_score") < 40, "Risk score should be low for normal transaction"
        
        print(f"✓ Normal transaction verified: allowed={data.get('allowed')}, risk_score={data.get('risk_score')}")
    
    def test_verify_transaction_high_amount(self):
        """Test POST /api/security/verify-transaction - High amount transaction triggers fraud check"""
        response = self.session.post(
            f"{BASE_URL}/api/security/verify-transaction",
            params={
                "amount": 6000.0,  # Above max_amount_per_transaction (5000)
                "transaction_type": "payment"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "risk_score" in data, "Response should contain 'risk_score' field"
        
        # High amount should increase risk score
        assert data.get("risk_score") >= 30, "High amount should increase risk score"
        
        print(f"✓ High amount transaction verified: risk_score={data.get('risk_score')}, action={data.get('action')}")
    
    def test_verify_transaction_with_device_id(self):
        """Test POST /api/security/verify-transaction - With device ID"""
        response = self.session.post(
            f"{BASE_URL}/api/security/verify-transaction",
            params={
                "amount": 100.0,
                "transaction_type": "bid_purchase",
                "device_id": "test_device_12345"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "allowed" in data, "Response should contain 'allowed' field"
        
        print(f"✓ Transaction with device ID verified: allowed={data.get('allowed')}")
    
    # ==================== Activity Logging Tests ====================
    
    def test_log_security_activity(self):
        """Test POST /api/security/log-activity - Log a security activity"""
        response = self.session.post(
            f"{BASE_URL}/api/security/log-activity",
            params={
                "activity_type": "test_login_attempt"
            },
            json={
                "details": {"source": "pytest", "test": True}
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Activity logging should be successful"
        
        print("✓ Security activity logged successfully")
    
    def test_get_activity_log(self):
        """Test GET /api/security/activity-log - Get user's security activity log"""
        response = self.session.get(
            f"{BASE_URL}/api/security/activity-log",
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "activities" in data, "Response should contain 'activities' field"
        assert isinstance(data["activities"], list), "Activities should be a list"
        
        print(f"✓ Activity log retrieved: {len(data['activities'])} activities found")
    
    # ==================== Fraud Alerts Tests (Admin) ====================
    
    def test_get_fraud_alerts(self):
        """Test GET /api/security/fraud-alerts - Get pending fraud alerts"""
        response = self.session.get(f"{BASE_URL}/api/security/fraud-alerts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "alerts" in data, "Response should contain 'alerts' field"
        assert "total" in data, "Response should contain 'total' field"
        
        print(f"✓ Fraud alerts retrieved: {data.get('total')} pending alerts")
    
    # ==================== Report Suspicious Activity Tests ====================
    
    def test_report_suspicious_activity(self):
        """Test POST /api/security/report-suspicious - Report suspicious activity"""
        response = self.session.post(
            f"{BASE_URL}/api/security/report-suspicious",
            params={
                "activity_type": "unusual_login",
                "description": "Test report from pytest - suspicious login attempt detected"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Report should be successful"
        assert "report_id" in data, "Response should contain report_id"
        
        print(f"✓ Suspicious activity reported: report_id={data.get('report_id')}")


class TestSecurityAPIWithPartnerAccount:
    """Test Security API with partner account to ensure it works for different user types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with partner authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with partner account
        response = self.session.post(f"{BASE_URL}/api/partner/login", json={
            "email": PARTNER_EMAIL,
            "password": PARTNER_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Partner authentication failed: {response.status_code}")
    
    def test_partner_get_security_settings(self):
        """Test that partner can access security settings"""
        response = self.session.get(f"{BASE_URL}/api/security/settings")
        
        # Partner might not have access to security settings (depends on implementation)
        # Accept either 200 (success) or 401/403 (not authorized)
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print("✓ Partner can access security settings")
        else:
            print(f"✓ Partner access to security settings: {response.status_code} (expected for partner accounts)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
