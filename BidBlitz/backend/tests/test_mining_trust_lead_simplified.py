"""
Mining Trust Lead Form - Simplified API Tests
Tests for the simplified lead form with quick topic selection.
Iteration 234: Fewer required fields, quick-selection topics.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMiningTrustLeadSimplified:
    """Tests for simplified mining trust lead form API"""
    
    def test_lead_with_topic_and_message(self):
        """Test lead creation with topic and message (full payload)"""
        payload = {
            "name": "TEST_Full_Lead",
            "email": f"test.full.{int(time.time())}@example.com",
            "topic": "Investment",
            "company": "Test Company",
            "message": "I want to invest in mining infrastructure"
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "lead" in data
        assert data["lead"]["name"] == "TEST_Full_Lead"
        assert data["lead"]["topic"] == "Investment"
        assert data["lead"]["company"] == "Test Company"
        assert data["lead"]["message"] == "I want to invest in mining infrastructure"
        assert data["lead"]["status"] == "new"
        assert "lead_id" in data["lead"]
        print(f"✅ Full lead created: {data['lead']['lead_id']}")
    
    def test_lead_minimal_payload_name_email_only(self):
        """Test lead creation with minimal payload (name + email only)"""
        payload = {
            "name": "TEST_Minimal_Lead",
            "email": f"test.minimal.{int(time.time())}@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["lead"]["name"] == "TEST_Minimal_Lead"
        assert data["lead"]["topic"] == ""  # Empty topic is allowed
        assert data["lead"]["company"] == ""  # Empty company is allowed
        assert data["lead"]["message"] == ""  # Empty message is allowed
        print(f"✅ Minimal lead created: {data['lead']['lead_id']}")
    
    def test_lead_with_topic_only_no_company(self):
        """Test lead creation with topic but no company (company is optional)"""
        payload = {
            "name": "TEST_Topic_Lead",
            "email": f"test.topic.{int(time.time())}@example.com",
            "topic": "Partnerschaft",
            "message": "Partnerschaft – bitte mehr Informationen senden."
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data["lead"]["topic"] == "Partnerschaft"
        assert data["lead"]["company"] == ""  # Company not provided
        assert "Partnerschaft" in data["lead"]["message"]
        print(f"✅ Topic-only lead created: {data['lead']['lead_id']}")
    
    def test_lead_all_quick_topics(self):
        """Test lead creation with all quick topic options"""
        topics = ["Investment", "Partnerschaft", "Mining Infos", "Standortbesuch"]
        
        for topic in topics:
            payload = {
                "name": f"TEST_{topic.replace(' ', '_')}_Lead",
                "email": f"test.{topic.lower().replace(' ', '')}.{int(time.time())}@example.com",
                "topic": topic,
                "message": f"{topic} – bitte mehr Informationen senden."
            }
            response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
            
            assert response.status_code == 200
            data = response.json()
            assert data["ok"] is True
            assert data["lead"]["topic"] == topic
            print(f"✅ Topic '{topic}' lead created: {data['lead']['lead_id']}")
    
    def test_lead_validation_missing_name(self):
        """Test lead validation - name is required"""
        payload = {
            "email": "test@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 422  # Validation error
        print("✅ Validation correctly rejects missing name")
    
    def test_lead_validation_missing_email(self):
        """Test lead validation - email is required"""
        payload = {
            "name": "Test User"
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 422  # Validation error
        print("✅ Validation correctly rejects missing email")
    
    def test_lead_validation_short_name(self):
        """Test lead validation - name must be at least 2 characters"""
        payload = {
            "name": "A",  # Too short
            "email": "test@example.com"
        }
        response = requests.post(f"{BASE_URL}/api/mining/trust/lead", json=payload)
        
        assert response.status_code == 422  # Validation error
        print("✅ Validation correctly rejects short name")


class TestMiningTrustPublicRegression:
    """Regression tests for public mining trust endpoint"""
    
    def test_public_endpoint_returns_proof_metrics(self):
        """Test public endpoint returns proof metrics"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "proof_metrics" in data
        assert "hashrate_cluster_phs" in data["proof_metrics"]
        assert "uptime_percent" in data["proof_metrics"]
        assert "cooling_status" in data["proof_metrics"]
        assert "monitoring" in data["proof_metrics"]
        assert "locations" in data["proof_metrics"]
        print(f"✅ Proof metrics: {data['proof_metrics']['hashrate_cluster_phs']} PH/s")
    
    def test_public_endpoint_returns_network_stats(self):
        """Test public endpoint returns network stats"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "network" in data
        assert "active_miners" in data["network"]
        assert "wallets" in data["network"]
        assert "registered_hashrate_ths" in data["network"]
        assert "registered_hashrate_phs" in data["network"]
        print(f"✅ Network stats: {data['network']['active_miners']} active miners")
    
    def test_public_endpoint_returns_videos(self):
        """Test public endpoint returns videos array"""
        response = requests.get(f"{BASE_URL}/api/mining/trust/public")
        
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        assert isinstance(data["videos"], list)
        print(f"✅ Videos array returned: {len(data['videos'])} videos")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
