"""Regression contracts for the unified BidBlitz Taxi customer/driver flow.

These tests intentionally protect architecture-level safety rules that previously
regressed because customer Taxi and Driver Dashboard evolved as separate flows.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_customer_and_driver_use_same_canonical_rides_collection():
    driver = read("backend/routes/driver_dashboard.py")
    taxi = read("backend/routes/taxi.py")

    assert "async def _pending_customer_rides" in driver
    assert 'db.taxi_rides.find({' in driver
    assert "requests = await _pending_customer_rides(driver" in driver
    assert '"ride_id": request_id' in driver
    assert '"status": "requested"' in driver
    assert '"driver_id": None' in driver

    # Taxi-side atomic claim must remain protected as well.
    assert '"status": RideStatus.REQUESTED.value' in taxi
    assert '"driver_id": None' in taxi
    assert "claim.modified_count != 1" in taxi


def test_taxi_fare_is_reserved_and_not_double_charged():
    taxi = read("backend/routes/taxi.py")

    assert '"payment_status": "reserved"' in taxi
    assert '"payment_reserved_amount": round(fare_total, 2)' in taxi
    assert 'payment_source = "reserved_at_booking"' in taxi
    assert '"payment_status": "settled"' in taxi
    assert 'idempotency_key=f"taxi-reserve:{user_id}:{ride_id}"' in taxi
    assert 'client_key = _require_taxi_booking_idempotency_key(req, request)' in taxi
    assert 'booking_request_fingerprint' in taxi
    assert 'idempotency_key=f"taxi-cancel-refund:{req.ride_id}"' in taxi


def test_estimate_booking_and_settlement_share_locked_pricing_contract():
    taxi = read("backend/routes/taxi.py")

    assert "get_driving_route_metrics" in taxi
    assert 'route_source = "mapbox_directions"' not in taxi  # helper returns it dynamically
    assert '"route_source": route_source' in taxi
    assert "fare_estimate = apply_multi_tariff" in taxi
    assert 'pricing_source = "locked_booking_quote"' in taxi
    assert '"pricing_source": pricing_source' in taxi


def test_frontend_does_not_fake_pickup_or_driver_availability():
    page = read("frontend/src/pages/TaxiPage.jsx")
    api = read("frontend/src/services/taxiApi.js")
    driver_page = read("frontend/src/pages/DriverDashboardPage.jsx")

    assert "useState({ lat: null, lng: null, address: '' })" in page
    assert "Math.max(mapDrivers.length, 1)" not in page
    assert "UberX" not in page
    assert "/api/taxi/rides/${rideId}" in api
    assert "/api/taxi/ride/${rideId}" not in api
    assert "() => setLocation({ lat: 52.52, lng: 13.405 })" not in driver_page


def test_driver_dashboard_status_uses_canonical_taxi_lifecycle():
    driver = read("backend/routes/driver_dashboard.py")

    assert "from routes.taxi import driver_arriving, driver_start_ride, driver_end_ride, cancel_ride" in driver
    assert "result = await driver_end_ride(action, request)" in driver
    assert "result = await cancel_ride(action, request)" in driver
    # The old direct-balance mutation must not exist in the active status handler.
    status_start = driver.index('@router.post("/rides/{ride_id}/status")')
    history_start = driver.index("# RIDE HISTORY", status_start)
    status_handler = driver[status_start:history_start]
    assert '"$inc": {"balance": -final_fare}' not in status_handler
    assert '"type": "TAXI_RIDE"' not in status_handler
