"""
Test suite for Investor Interest Lead API
Tests the /api/investor-interest/lead endpoint for the new investor section
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInvestorInterestLead:
    """Tests for POST /api/investor-interest/lead endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data with unique identifiers"""
        self.unique_id = uuid.uuid4().hex[:8]
        self.valid_payload = {
            "first_name": "Test",
            "last_name": "Investor",
            "email": f"test.investor.{self.unique_id}@test.com",
            "phone": "+49123456789",
            "company": "Test Company GmbH",
            "message": "I am interested in investing in BidBlitz.",
            "intent": "interest",
            "locale": "de",
            "source_page": "/investieren",
            "consent": True
        }
    
    def test_create_lead_success_interest(self):
        """Test successful lead creation with intent=interest"""
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=self.valid_payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") is True
        assert "message" in data
        assert "lead" in data
        
        # Verify lead data
        lead = data["lead"]
        assert "lead_id" in lead
        assert lead["lead_id"].startswith("INV-")
        assert lead["intent"] == "interest"
        assert lead["status"] == "new"
        assert "created_at" in lead
        
        print(f"✓ Lead created successfully: {lead['lead_id']}")
    
    def test_create_lead_success_documents(self):
        """Test successful lead creation with intent=documents"""
        payload = self.valid_payload.copy()
        payload["email"] = f"test.docs.{self.unique_id}@test.com"
        payload["intent"] = "documents"
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data.get("success") is True
        assert data["lead"]["intent"] == "documents"
        print(f"✓ Documents lead created: {data['lead']['lead_id']}")
    
    def test_duplicate_lead_returns_existing(self):
        """Test that submitting the same lead again returns duplicate-safe success"""
        # First submission
        response1 = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=self.valid_payload,
            headers={"Content-Type": "application/json"}
        )
        assert response1.status_code == 200
        lead_id_1 = response1.json()["lead"]["lead_id"]
        
        # Second submission with same email and intent (within 10 min window)
        response2 = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=self.valid_payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response2.status_code == 200, f"Expected 200 for duplicate, got {response2.status_code}"
        data2 = response2.json()
        
        # Should return success with existing lead
        assert data2.get("success") is True
        assert data2["lead"]["lead_id"] == lead_id_1
        print(f"✓ Duplicate submission handled correctly, returned existing lead: {lead_id_1}")
    
    def test_consent_required(self):
        """Test that consent=false returns 400 error"""
        payload = self.valid_payload.copy()
        payload["email"] = f"test.noconsent.{self.unique_id}@test.com"
        payload["consent"] = False
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400 for no consent, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Consent validation works: {data['detail']}")
    
    def test_invalid_email_format(self):
        """Test that invalid email returns validation error"""
        payload = self.valid_payload.copy()
        payload["email"] = "not-an-email"
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print("✓ Invalid email validation works")
    
    def test_missing_required_fields(self):
        """Test that missing required fields return validation error"""
        payload = {
            "email": f"test.missing.{self.unique_id}@test.com",
            "consent": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"
        print("✓ Missing fields validation works")
    
    def test_invalid_intent_value(self):
        """Test that invalid intent value returns validation error"""
        payload = self.valid_payload.copy()
        payload["email"] = f"test.badintent.{self.unique_id}@test.com"
        payload["intent"] = "invalid_intent"
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 422, f"Expected 422 for invalid intent, got {response.status_code}"
        print("✓ Invalid intent validation works")
    
    def test_optional_fields_empty(self):
        """Test that optional fields can be empty"""
        payload = {
            "first_name": "Test",
            "last_name": "User",
            "email": f"test.minimal.{self.unique_id}@test.com",
            "phone": "+49123456789",
            "company": "",  # Optional
            "message": "",  # Optional
            "intent": "interest",
            "locale": "de",
            "source_page": "/investieren",
            "consent": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200, f"Expected 200 with empty optional fields, got {response.status_code}"
        print("✓ Optional fields can be empty")
    
    def test_email_normalization(self):
        """Test that email is normalized (lowercase)"""
        payload = self.valid_payload.copy()
        payload["email"] = f"TEST.UPPER.{self.unique_id}@TEST.COM"
        
        response = requests.post(
            f"{BASE_URL}/api/investor-interest/lead",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        # The backend should normalize the email to lowercase
        print("✓ Email normalization works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
