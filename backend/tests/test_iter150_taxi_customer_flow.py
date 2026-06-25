"""
Iteration 150 - Taxi Customer Flow Tests
Tests the new Uber-like customer-focused taxi UI and APIs

Features tested:
- /api/taxi/status - Module status
- /api/taxi/drivers/nearby - Nearby drivers
- /api/taxi/estimate - Price estimates for all vehicle types
- /api/taxi/geocode - Address autocomplete with short input
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTaxiModuleStatus:
    """Test taxi module status endpoint"""
    
    def test_taxi_status_returns_enabled(self):
        """Verify taxi module is enabled"""
        response = requests.get(f"{BASE_URL}/api/taxi/status")
        assert response.status_code == 200
        data = response.json()
        assert data.get("module_enabled") == True
        assert "message" in data
        print(f"Taxi module status: {data}")

    def test_taxi_status_has_driver_counts(self):
        """Verify status includes driver counts"""
        response = requests.get(f"{BASE_URL}/api/taxi/status")
        assert response.status_code == 200
        data = response.json()
        assert "operators_active" in data
        assert "business_drivers" in data
        assert "private_drivers" in data


class TestNearbyDrivers:
    """Test nearby drivers endpoint"""
    
    def test_nearby_drivers_berlin(self):
        """Get nearby drivers in Berlin"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/drivers/nearby",
            params={"lat": 52.52, "lng": 13.405, "radius": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
        assert "total" in data
        assert "pricing" in data
        print(f"Found {data['total']} drivers nearby")
    
    def test_nearby_drivers_with_car_type_filter(self):
        """Filter drivers by car type"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/drivers/nearby",
            params={"lat": 52.52, "lng": 13.405, "car_type": "standard"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "drivers" in data
    
    def test_nearby_drivers_returns_pricing(self):
        """Verify pricing info is returned"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/drivers/nearby",
            params={"lat": 52.52, "lng": 13.405}
        )
        assert response.status_code == 200
        data = response.json()
        pricing = data.get("pricing", {})
        assert "standard" in pricing
        assert "premium" in pricing
        assert "van" in pricing


class TestRideEstimate:
    """Test ride estimate endpoint"""
    
    def test_estimate_returns_all_vehicle_types(self):
        """Verify estimates for all vehicle types"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("module_enabled") == True
        estimates = data.get("estimates", [])
        assert len(estimates) >= 3
        
        vehicle_types = [e["vehicle_type"] for e in estimates]
        assert "standard" in vehicle_types
        assert "premium" in vehicle_types
        assert "van" in vehicle_types
        print(f"Estimates: {estimates}")
    
    def test_estimate_has_fare_breakdown(self):
        """Verify fare breakdown is included"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        estimates = data.get("estimates", [])
        assert len(estimates) > 0
        
        first_estimate = estimates[0]
        assert "fare" in first_estimate
        assert "fare_breakdown" in first_estimate
        assert "distance_km" in first_estimate
        assert "duration_minutes" in first_estimate
        assert "eta_minutes" in first_estimate
    
    def test_estimate_detects_region(self):
        """Verify region detection for pricing"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "region" in data
        assert data["region"] == "germany"  # Berlin is in Germany
        assert "region_label" in data
    
    def test_estimate_includes_surge_info(self):
        """Verify surge pricing info is included"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "surge" in data
        surge = data["surge"]
        assert "active" in surge
        assert "multiplier" in surge


class TestGeocode:
    """Test geocoding/address autocomplete endpoint"""
    
    def test_geocode_short_query_pot(self):
        """Search with short query 'Pot' returns results"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Pot", "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        features = data["features"]
        assert len(features) > 0
        
        # Should find Potsdam or Potsdamer Platz
        names = [f.get("text", "") for f in features]
        found_pot = any("Pot" in name for name in names)
        assert found_pot, f"Expected to find 'Pot*' in results, got: {names}"
        print(f"Geocode 'Pot' results: {names[:3]}")
    
    def test_geocode_short_query_ale(self):
        """Search with short query 'Ale' returns results"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={"q": "Ale", "limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        features = data["features"]
        assert len(features) > 0
        print(f"Geocode 'Ale' found {len(features)} results")
    
    def test_geocode_with_proximity(self):
        """Search with proximity bias"""
        response = requests.get(
            f"{BASE_URL}/api/taxi/geocode",
            params={
                "q": "Alexanderplatz",
                "limit": 5,
                "lat": 52.52,
                "lng": 13.405
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "features" in data
        features = data["features"]
        assert len(features) > 0
        
        # First result should have coordinates
        first = features[0]
        assert "center" in first
        assert len(first["center"]) == 2


class TestVehicleLabels:
    """Test that vehicle types have Uber-like labels"""
    
    def test_estimate_has_uber_like_names(self):
        """Verify vehicle names are customer-friendly"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        estimates = data.get("estimates", [])
        
        # Check for customer-friendly names
        names = [e.get("name", "") for e in estimates]
        descriptions = [e.get("description", "") for e in estimates]
        
        # Should have descriptive names
        assert any("Standard" in n or "UberX" in n for n in names), f"Expected Standard/UberX, got: {names}"
        assert any("Premium" in n or "Comfort" in n for n in names), f"Expected Premium/Comfort, got: {names}"
        assert any("Van" in n or "XL" in n for n in names), f"Expected Van/XL, got: {names}"
        
        # Should have descriptions
        assert all(len(d) > 0 for d in descriptions), "All vehicles should have descriptions"


class TestTariffZones:
    """Test tariff zone detection"""
    
    def test_estimate_includes_tariff_zone(self):
        """Verify tariff zone info is included"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Tariff zone may or may not be present depending on location
        if "tariff_zone" in data and data["tariff_zone"]:
            zone = data["tariff_zone"]
            assert "id" in zone or "name" in zone
            print(f"Tariff zone: {zone}")
    
    def test_estimate_includes_time_tariff(self):
        """Verify time-based tariff info is included"""
        response = requests.post(
            f"{BASE_URL}/api/taxi/estimate",
            json={
                "pickup_lat": 52.52,
                "pickup_lng": 13.405,
                "dropoff_lat": 52.53,
                "dropoff_lng": 13.42
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "time_tariff" in data
        time_tariff = data["time_tariff"]
        assert "multiplier" in time_tariff
        assert "night" in time_tariff
        assert "weekend" in time_tariff


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
