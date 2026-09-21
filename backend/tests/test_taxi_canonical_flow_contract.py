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


def test_taxi_booking_retry_repairs_quote_and_promo_without_second_charge():
    taxi = read("backend/routes/taxi.py")
    promo = read("backend/utils/taxi_promo.py")
    api = read("frontend/src/services/taxiApi.js")
    page = read("frontend/src/pages/TaxiPage.jsx")

    assert "async def _finalize_taxi_booking_replay" in taxi
    assert "await _finalize_taxi_booking_replay(existing_ride, user_id)" in taxi
    assert "await _finalize_taxi_booking_replay(current, user_id)" in taxi
    assert "async def reserve_redemption" in promo
    assert "async def release_redemption" in promo
    assert "taxi_promo_usage" in promo
    assert '"auth_required"' in promo
    assert '"Idempotency-Key": idempotencyKey' in api
    assert "bookingAttemptRef" in page


def test_taxi_promo_is_reserved_before_wallet_and_released_on_failure():
    taxi = read("backend/routes/taxi.py")
    promo = read("backend/utils/taxi_promo.py")

    reserve_pos = taxi.index("promo_reservation = await reserve_redemption(")
    wallet_pos = taxi.index("reservation = await debit_wallet(", reserve_pos)
    assert reserve_pos < wallet_pos
    assert "await release_redemption(user_id, promo_applied[\"code\"], ride_id)" in taxi
    assert "await record_redemption(user_id, promo_applied[\"code\"], ride_id, promo_applied[\"discount\"])" in taxi

    assert 'reason": "auth_required"' in promo
    assert 'existing_status == "reserving"' in promo
    assert 'existing_status in {"released", "rejected"}' in promo
    assert '"uses": {"$lt": max_uses}' in promo
    assert '"$pull": {"ride_ids": ride_id}' in promo


def test_legacy_customer_request_endpoint_cannot_create_second_taxi_lifecycle():
    driver = read("backend/routes/driver_dashboard.py")

    legacy_start = driver.index('@router.post("/request-ride")')
    legacy = driver[legacy_start:]
    assert 'status_code=410' in legacy
    assert 'base_fare = 3.50' not in legacy
    assert 'per_km = 1.80' not in legacy
    assert 'db.taxi_ride_requests.insert_one' not in legacy
    assert 'create_notification(' not in legacy
    assert "kanonischen Taxi" in legacy or "aktuelle Taxi-Buchung" in legacy
