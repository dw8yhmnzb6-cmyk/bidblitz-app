"""
Iteration 151 - CI Fix & Taxi Customer Flow Tests
Tests:
1. CI Fix: Verify requirements.txt has correct package versions
2. Taxi Customer Flow: API endpoints for new Uber-like UI
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCIFix:
    """Verify CI/CD bug fix - requirements.txt package versions"""
    
    def test_requirements_greenlet_version(self):
        """greenlet should be 3.2.5 (not problematic Linux-x64 pin)"""
        with open('/app/backend/requirements.txt', 'r') as f:
            content = f.read()
        assert 'greenlet==3.2.5' in content, "greenlet should be version 3.2.5"
        print("✅ greenlet==3.2.5 found")
    
    def test_requirements_no_http_ece(self):
        """http_ece should be removed (problematic package)"""
        with open('/app/backend/requirements.txt', 'r') as f:
            content = f.read()
        assert 'http_ece' not in content.lower(), "http_ece should be removed"
        print("✅ http_ece not in requirements")
    
    def test_requirements_no_jq(self):
        """jq should be removed (problematic package)"""
        with open('/app/backend/requirements.txt', 'r') as f:
            content = f.read()
        # Check for jq as a standalone package (not part of other package names)
        lines = content.split('\n')
        jq_lines = [l for l in lines if l.strip().startswith('jq==') or l.strip() == 'jq']
        assert len(jq_lines) == 0, f"jq should be removed, found: {jq_lines}"
        print("✅ jq not in requirements")
    
    def test_requirements_multitasking_version(self):
        """multitasking should be 0.0.13"""
        with open('/app/backend/requirements.txt', 'r') as f:
            content = f.read()
        assert 'multitasking==0.0.13' in content, "multitasking should be version 0.0.13"
        print("✅ multitasking==0.0.13 found")
    
    def test_requirements_numpy_version(self):
        """numpy should be 2.2.6"""
        with open('/app/backend/requirements.txt', 'r') as f:
            content = f.read()
        assert 'numpy==2.2.6' in content, "numpy should be version 2.2.6"
        print("✅ numpy==2.2.6 found")


class TestTaxiCustomerAPIs:
    """Test Taxi Customer Flow APIs"""
    
    def test_taxi_status_endpoint(self):
        """GET /api/taxi/status should return enabled status"""
        response = requests.get(f"{BASE_URL}/api/taxi/status")
        assert response.status_code == 200
        data = response.json()
        assert 'module_enabled' in data or 'enabled' in data or 'status' in data
        assert data.get('module_enabled', True) == True, "Taxi module should be enabled"
        print(f"✅ Taxi status: {data}")
    
    def test_nearby_drivers_endpoint(self):
        """GET /api/taxi/drivers/nearby should return drivers"""
        params = {'lat': 52.52, 'lng': 13.405, 'radius': 10}
        response = requests.get(f"{BASE_URL}/api/taxi/drivers/nearby", params=params)
        assert response.status_code == 200
        data = response.json()
        assert 'drivers' in data or 'total' in data
        print(f"✅ Nearby drivers: {data.get('total', len(data.get('drivers', [])))} found")
    
    def test_estimate_endpoint(self):
        """POST /api/taxi/estimate should return price estimates"""
        payload = {
            'pickup_lat': 52.52,
            'pickup_lng': 13.405,
            'dropoff_lat': 52.5163,
            'dropoff_lng': 13.3777
        }
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'estimates' in data
        estimates = data['estimates']
        assert len(estimates) > 0, "Should have at least one estimate"
        
        # Check for vehicle types
        vehicle_types = [e.get('vehicle_type') for e in estimates]
        print(f"✅ Estimates returned for: {vehicle_types}")
        
        # Check estimate has price
        first_estimate = estimates[0]
        assert 'total' in first_estimate or 'fare' in first_estimate
        print(f"✅ First estimate: {first_estimate}")
    
    def test_geocode_short_query(self):
        """GET /api/taxi/geocode should work with short queries (3 chars)"""
        params = {'q': 'Pot', 'limit': 6}
        response = requests.get(f"{BASE_URL}/api/taxi/geocode", params=params)
        assert response.status_code == 200
        data = response.json()
        assert 'features' in data
        features = data['features']
        assert len(features) > 0, "Should return suggestions for 'Pot'"
        print(f"✅ Geocode 'Pot' returned {len(features)} results")
    
    def test_geocode_alexanderplatz(self):
        """GET /api/taxi/geocode should find Alexanderplatz"""
        params = {'q': 'Ale', 'limit': 6}
        response = requests.get(f"{BASE_URL}/api/taxi/geocode", params=params)
        assert response.status_code == 200
        data = response.json()
        assert 'features' in data
        features = data['features']
        assert len(features) > 0, "Should return suggestions for 'Ale'"
        print(f"✅ Geocode 'Ale' returned {len(features)} results")


class TestTaxiVehicleTypes:
    """Test Uber-like vehicle type labels"""
    
    def test_estimate_has_standard_vehicle(self):
        """Estimate should include 'standard' (UberX) vehicle type"""
        payload = {
            'pickup_lat': 52.52,
            'pickup_lng': 13.405,
            'dropoff_lat': 52.5163,
            'dropoff_lng': 13.3777
        }
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        vehicle_types = [e.get('vehicle_type') for e in data.get('estimates', [])]
        assert 'standard' in vehicle_types, f"Should have 'standard' vehicle type, got: {vehicle_types}"
        print(f"✅ Standard (UberX) vehicle type found")
    
    def test_estimate_has_premium_vehicle(self):
        """Estimate should include 'premium' (Comfort) vehicle type"""
        payload = {
            'pickup_lat': 52.52,
            'pickup_lng': 13.405,
            'dropoff_lat': 52.5163,
            'dropoff_lng': 13.3777
        }
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        vehicle_types = [e.get('vehicle_type') for e in data.get('estimates', [])]
        assert 'premium' in vehicle_types, f"Should have 'premium' vehicle type, got: {vehicle_types}"
        print(f"✅ Premium (Comfort) vehicle type found")
    
    def test_estimate_has_van_vehicle(self):
        """Estimate should include 'van' (XL) vehicle type"""
        payload = {
            'pickup_lat': 52.52,
            'pickup_lng': 13.405,
            'dropoff_lat': 52.5163,
            'dropoff_lng': 13.3777
        }
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        data = response.json()
        vehicle_types = [e.get('vehicle_type') for e in data.get('estimates', [])]
        assert 'van' in vehicle_types, f"Should have 'van' vehicle type, got: {vehicle_types}"
        print(f"✅ Van (XL) vehicle type found")
