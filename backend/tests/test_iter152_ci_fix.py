"""
Iteration 152 - CI/CD Bug Fix Verification Tests
Tests the GitHub workflow fix for emergentintegrations==0.2.0 filtering
and verifies taxi customer flow remains functional
"""
import pytest
import requests
import os
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCIWorkflowFix:
    """Verify CI workflow filtering logic for emergentintegrations"""
    
    def test_requirements_contains_emergentintegrations(self):
        """requirements.txt should still contain emergentintegrations (filtered in CI only)"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'emergentintegrations==0.2.0' in content, "emergentintegrations should be in requirements.txt"
    
    def test_ci_workflow_filtering_logic(self):
        """Simulate CI workflow filtering - should remove emergentintegrations"""
        req_path = Path('/app/backend/requirements.txt')
        filtered = []
        for line in req_path.read_text().splitlines():
            if line.strip().startswith('emergentintegrations=='):
                continue
            filtered.append(line)
        
        filtered_content = '\n'.join(filtered)
        assert 'emergentintegrations' not in filtered_content, "Filtered content should not contain emergentintegrations"
    
    def test_ci_workflow_file_exists(self):
        """CI workflow file should exist"""
        ci_path = Path('/app/.github/workflows/ci.yml')
        assert ci_path.exists(), "CI workflow file should exist"
    
    def test_ci_workflow_has_filtering_step(self):
        """CI workflow should have Python filtering step"""
        ci_path = Path('/app/.github/workflows/ci.yml')
        content = ci_path.read_text()
        assert 'emergentintegrations==' in content, "CI workflow should filter emergentintegrations"
        assert '/tmp/backend-requirements-ci.txt' in content, "CI workflow should write to temp file"


class TestRequirementsPinsCleaned:
    """Verify problematic pins have been cleaned up"""
    
    def test_greenlet_version(self):
        """greenlet should be pinned to 3.2.5"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'greenlet==3.2.5' in content, "greenlet should be 3.2.5"
    
    def test_multitasking_version(self):
        """multitasking should be pinned to 0.0.13"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'multitasking==0.0.13' in content, "multitasking should be 0.0.13"
    
    def test_numpy_version(self):
        """numpy should be pinned to 2.2.6"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'numpy==2.2.6' in content, "numpy should be 2.2.6"
    
    def test_pandas_version(self):
        """pandas should be pinned to 2.3.2"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'pandas==2.3.2' in content, "pandas should be 2.3.2"
    
    def test_tiktoken_version(self):
        """tiktoken should be pinned to 0.11.0"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'tiktoken==0.11.0' in content, "tiktoken should be 0.11.0"
    
    def test_http_ece_removed(self):
        """http_ece should be removed from requirements"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        assert 'http_ece' not in content, "http_ece should be removed"
    
    def test_jq_removed(self):
        """jq should be removed from requirements"""
        req_path = Path('/app/backend/requirements.txt')
        content = req_path.read_text()
        # Check for jq== at start of line to avoid false positives
        lines = content.splitlines()
        jq_lines = [l for l in lines if l.strip().startswith('jq==')]
        assert len(jq_lines) == 0, "jq should be removed"


class TestTaxiCustomerAPIs:
    """Verify taxi customer flow APIs are functional"""
    
    def test_taxi_status_endpoint(self):
        """Taxi status endpoint should return module info"""
        response = requests.get(f"{BASE_URL}/api/taxi/status")
        assert response.status_code == 200
        data = response.json()
        assert 'module_enabled' in data
        assert data['module_enabled'] == True
    
    def test_nearby_drivers_endpoint(self):
        """Nearby drivers endpoint should return driver list"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/drivers/nearby",
            params={"lat": 52.52, "lng": 13.405, "radius": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'drivers' in data
        assert isinstance(data['drivers'], list)
    
    def test_estimate_endpoint(self):
        """Estimate endpoint should return fare estimates"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.5163,
                "dropoff_lng": 13.3777
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert 'estimates' in data
        assert len(data['estimates']) >= 3  # standard, premium, van
        
        # Verify vehicle types
        vehicle_types = [e['vehicle_type'] for e in data['estimates']]
        assert 'standard' in vehicle_types
        assert 'premium' in vehicle_types
        assert 'van' in vehicle_types
    
    def test_geocode_short_query(self):
        """Geocode should work with short queries (3 chars)"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Pot", "limit": 6}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'features' in data
        assert len(data['features']) > 0
    
    def test_geocode_alexanderplatz(self):
        """Geocode should find Alexanderplatz"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Ale", "limit": 6}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'features' in data
        assert len(data['features']) > 0


class TestTaxiVehicleTypes:
    """Verify all vehicle types return correct estimates"""
    
    @pytest.fixture
    def estimate_response(self):
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.5163,
                "dropoff_lng": 13.3777
            }
        )
        return response.json()
    
    def test_standard_vehicle_has_fare(self, estimate_response):
        """Standard (UberX) vehicle should have fare"""
        standard = next((e for e in estimate_response['estimates'] if e['vehicle_type'] == 'standard'), None)
        assert standard is not None
        assert 'fare' in standard
        assert standard['fare'] > 0
    
    def test_premium_vehicle_has_fare(self, estimate_response):
        """Premium (Comfort) vehicle should have fare"""
        premium = next((e for e in estimate_response['estimates'] if e['vehicle_type'] == 'premium'), None)
        assert premium is not None
        assert 'fare' in premium
        assert premium['fare'] > 0
    
    def test_van_vehicle_has_fare(self, estimate_response):
        """Van (XL) vehicle should have fare"""
        van = next((e for e in estimate_response['estimates'] if e['vehicle_type'] == 'van'), None)
        assert van is not None
        assert 'fare' in van
        assert van['fare'] > 0
    
    def test_premium_more_expensive_than_standard(self, estimate_response):
        """Premium should cost more than standard"""
        standard = next((e for e in estimate_response['estimates'] if e['vehicle_type'] == 'standard'), None)
        premium = next((e for e in estimate_response['estimates'] if e['vehicle_type'] == 'premium'), None)
        assert premium['fare'] > standard['fare']
