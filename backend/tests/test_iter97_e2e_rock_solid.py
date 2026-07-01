"""
Iter97 E2E rock-solid test:
- TAXI booking + driver flow + path/replay
- HOTELS search/availability/book/my-bookings
- AUCTIONS browse/credits/bid validation
- POS products/cart/checkout/dashboard/reports
- GENERAL: bookings/providers, restaurants, apartments
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biometric-checkout-7.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUSTOMER = {"email": "kunde@bidblitz.com", "password": "Kunde2026!"}
DRIVER = {"email": "fahrer@bidblitz.com", "password": "Fahrer2026!"}
MERCHANT = {"email": "haendler@bidblitz.com", "password": "Haendler2026!"}
ADMIN = {"email": "admin@bidblitz.com", "password": "BidBlitz2026!"}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    return s, r


@pytest.fixture(scope="session")
def customer_session():
    s, r = _login(CUSTOMER)
    if r.status_code != 200:
        pytest.skip(f"Customer login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="session")
def driver_session():
    s, r = _login(DRIVER)
    if r.status_code != 200:
        pytest.skip(f"Driver login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="session")
def merchant_session():
    s, r = _login(MERCHANT)
    if r.status_code != 200:
        pytest.skip(f"Merchant login failed: {r.status_code} {r.text[:200]}")
    return s


# ======================== GENERAL ========================

class TestGeneral:
    def test_restaurants_list(self):
        r = requests.get(f"{API}/restaurants/list", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_restaurants_cuisines(self):
        r = requests.get(f"{API}/restaurants/cuisines", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_apartments_search(self):
        r = requests.get(f"{API}/apartments/search", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_bookings_providers(self):
        # was 500 (KeyError 'id'), now should return 200
        r = requests.get(f"{API}/bookings/providers", timeout=20)
        assert r.status_code in (200, 401), f"{r.status_code}: {r.text[:200]}"


# ======================== TAXI ========================

class TestTaxi:
    def test_drivers_nearby(self):
        r = requests.get(f"{API}/taxi/drivers/nearby?lat=52.5&lng=13.4", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert isinstance(data, (list, dict))

    def test_estimate(self):
        payload = {
            "pickup_lat": 52.5200,
            "pickup_lng": 13.4050,
            "dropoff_lat": 52.5300,
            "dropoff_lng": 13.4150,
        }
        r = requests.post(f"{API}/taxi/estimate", json=payload, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "estimates" in data
        assert isinstance(data["estimates"], list) and len(data["estimates"]) >= 1
        assert "fare" in data["estimates"][0]

    def test_mapbox_readiness(self):
        r = requests.get(f"{API}/readiness/mapbox-token?live=true", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("status") == "ok", f"unexpected: {data}"
        # live_ok may be true or false depending on token check; we report
        print(f"mapbox readiness: {data}")

    def test_customer_book_active_ride_enriched(self, customer_session):
        # First, check if there's already an active ride from previous runs
        active = customer_session.get(f"{API}/taxi/rides/active", timeout=20)
        assert active.status_code == 200, f"active rides status {active.status_code}: {active.text[:200]}"
        active_data = active.json()
        active_ride = None
        if isinstance(active_data, dict):
            if active_data.get("rides") and isinstance(active_data["rides"], list) and active_data["rides"]:
                active_ride = active_data["rides"][0]
            else:
                active_ride = active_data.get("ride") or (active_data if "ride_id" in active_data else None)
        elif isinstance(active_data, list) and active_data:
            active_ride = active_data[0]

        if not active_ride:
            # No active ride, try to book one
            payload = {
                "pickup_address": "Berlin Mitte",
                "pickup_lat": 52.5200,
                "pickup_lng": 13.4050,
                "dropoff_address": "Berlin",
                "dropoff_lat": 52.5300,
                "dropoff_lng": 13.4150,
                "vehicle_type": "standard",
            }
            r = customer_session.post(f"{API}/taxi/book", json=payload, timeout=30)
            print(f"book status={r.status_code} body={r.text[:200]}")
            assert r.status_code != 500, f"taxi/book returned 500: {r.text[:200]}"
            if r.status_code not in (200, 201):
                pytest.skip(f"Book not possible: {r.status_code} {r.text[:120]}")
            book_data = r.json()
            active_ride = book_data.get("ride") or book_data

        assert active_ride is not None
        # Verify enrichment contract: when a driver has accepted, ride.driver must be an enriched object
        # Pre-acceptance, driver_id is null and 'driver' key may be missing
        if active_ride.get("driver") is not None:
            assert isinstance(active_ride["driver"], dict), (
                f"ride.driver MUST be enriched object (not flat string), got: {active_ride['driver']!r}"
            )
            assert "driver_id" in active_ride["driver"] or "name" in active_ride["driver"] or "_id" in active_ride["driver"], (
                f"ride.driver missing expected fields: {active_ride['driver']}"
            )
            print(f"ENRICHED driver: keys={list(active_ride['driver'].keys())}")
        else:
            print(f"No driver assigned yet (ride status={active_ride.get('status')}) - enrichment check N/A")

    def test_driver_go_online(self, driver_session):
        r = driver_session.post(f"{API}/taxi/driver/go-online", json={"lat": 52.52, "lng": 13.4}, timeout=20)
        # accept 200 or 400 if already online
        assert r.status_code in (200, 201, 400, 409), f"{r.status_code}: {r.text[:200]}"

    def test_driver_requests(self, driver_session):
        r = driver_session.get(f"{API}/taxi/driver/requests", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"


# ======================== HOTELS ========================

class TestHotels:
    _property_id = None

    def test_hotels_properties_berlin(self):
        r = requests.get(f"{API}/hotels/properties?city=Berlin", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("properties") or data.get("data") or []
        assert isinstance(items, list)
        if items:
            prop = items[0]
            TestHotels._property_id = prop.get("id") or prop.get("property_id") or prop.get("_id")

    def test_hotels_availability_quote(self):
        if not TestHotels._property_id:
            pytest.skip("No property id available")
        pid = TestHotels._property_id
        r = requests.get(f"{API}/hotels/{pid}/availability", timeout=20)
        assert r.status_code in (200, 404), f"avail {r.status_code}: {r.text[:200]}"
        r2 = requests.get(f"{API}/hotels/{pid}/quote", timeout=20)
        # quote may need params; accept 200/400/422
        assert r2.status_code in (200, 400, 404, 422), f"quote {r2.status_code}: {r2.text[:200]}"

    def test_hotels_my_bookings(self, customer_session):
        r = customer_session.get(f"{API}/hotels/my-bookings", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"


# ======================== AUCTIONS ========================

class TestAuctions:
    def test_active_or_list(self):
        r = requests.get(f"{API}/auctions/active", timeout=20)
        assert r.status_code == 200, f"active {r.status_code}: {r.text[:200]}"
        r2 = requests.get(f"{API}/auctions/list", timeout=20)
        assert r2.status_code == 200, f"list {r2.status_code}: {r2.text[:200]}"

    def test_credits_packages(self):
        r = requests.get(f"{API}/auctions/credits/packages", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else data.get("packages") or data.get("items") or []
        assert isinstance(items, list)

    def test_credits_balance(self, customer_session):
        r = customer_session.get(f"{API}/auctions/credits/balance", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "balance" in data or "credits" in data or isinstance(data, (int, dict))

    def test_bid_invalid_auction(self, customer_session):
        payload = {"auction_id": "nonexistent_xyz_12345", "amount": 1}
        r = customer_session.post(f"{API}/auctions/bid", json=payload, timeout=20)
        # 403 kyc_required is acceptable (not a server crash), main goal: NOT 500
        assert r.status_code in (400, 403, 404, 422), f"Got {r.status_code}: {r.text[:200]}"
        assert r.status_code != 500, "must not be 500"

    def test_feed(self):
        r = requests.get(f"{API}/auctions/feed", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"


# ======================== POS ========================

class TestPOS:
    _cart_id = None
    _store_id = None
    _register_id = None

    @pytest.fixture(autouse=True)
    def _setup_store(self, merchant_session):
        if TestPOS._store_id is None:
            r = merchant_session.get(f"{API}/pos/stores", timeout=20)
            if r.status_code == 200:
                stores = r.json().get("stores", [])
                if stores:
                    TestPOS._store_id = stores[0].get("store_id")
            r2 = merchant_session.get(f"{API}/pos/registers", timeout=20)
            if r2.status_code == 200:
                regs = r2.json().get("registers", [])
                if regs:
                    TestPOS._register_id = regs[0].get("register_id")
        print(f"POS store_id={TestPOS._store_id} register_id={TestPOS._register_id}")

    def test_products_search(self, merchant_session):
        if not TestPOS._store_id:
            pytest.skip("no store_id for merchant - seed missing")
        r = merchant_session.get(
            f"{API}/pos/products/search?store_id={TestPOS._store_id}&query=test", timeout=20
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_cart_lifecycle(self, merchant_session):
        if not TestPOS._register_id:
            pytest.skip("no register_id - seed missing")
        # Try to get a product first
        prod_resp = merchant_session.get(
            f"{API}/pos/products/search?store_id={TestPOS._store_id}&query=", timeout=20
        )
        prod_id = None
        if prod_resp.status_code == 200:
            products = prod_resp.json().get("products") or prod_resp.json().get("items") or []
            if isinstance(products, list) and products:
                prod_id = products[0].get("product_id") or products[0].get("id")
        items = [{"product_id": prod_id, "qty": 1}] if prod_id else []
        payload = {"register_id": TestPOS._register_id, "items": items}
        r = merchant_session.post(f"{API}/pos/cart/create", json=payload, timeout=20)
        # 400 "Bitte erst Schicht öffnen" or "Cart ist leer" is valid contract response (no 500)
        if r.status_code in (200, 201):
            data = r.json()
            cart_id = (data.get("cart") or {}).get("cart_id") or data.get("cart_id")
            assert cart_id, f"no cart_id in {data}"
            TestPOS._cart_id = cart_id
            r2 = merchant_session.get(f"{API}/pos/cart/{cart_id}", timeout=20)
            assert r2.status_code == 200, f"get {r2.status_code}: {r2.text[:200]}"
        else:
            assert r.status_code in (400, 404, 422), f"unexpected {r.status_code}: {r.text[:200]}"
            assert r.status_code != 500
            print(f"cart/create returned {r.status_code} (expected due to test seed state): {r.text[:120]}")

    def test_checkout(self, merchant_session):
        if not TestPOS._cart_id:
            pytest.skip("no cart")
        payload = {"cart_id": TestPOS._cart_id, "payment_method": "cash"}
        r = merchant_session.post(f"{API}/pos/checkout", json=payload, timeout=30)
        assert r.status_code in (200, 201, 400, 422), f"{r.status_code}: {r.text[:200]}"
        assert r.status_code != 500, "must not 500"

    def test_dashboard_summary(self, merchant_session):
        r = merchant_session.get(f"{API}/pos/dashboard/summary", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_registers(self, merchant_session):
        r = merchant_session.get(f"{API}/pos/registers", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_zbon_list(self, merchant_session):
        if not TestPOS._store_id:
            pytest.skip("no store_id")
        r = merchant_session.get(f"{API}/pos/zbon/list?store_id={TestPOS._store_id}", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_shift_current(self, merchant_session):
        if not TestPOS._register_id:
            pytest.skip("no register_id")
        r = merchant_session.get(f"{API}/pos/shift/current?register_id={TestPOS._register_id}", timeout=20)
        assert r.status_code in (200, 204, 404), f"{r.status_code}: {r.text[:200]}"

    def test_reports_sales(self, merchant_session):
        r = merchant_session.get(f"{API}/pos/reports/sales?range=today", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_barcode_nonexistent(self, merchant_session):
        if not TestPOS._store_id:
            pytest.skip("no store_id")
        r = merchant_session.get(
            f"{API}/pos/products/barcode/NONEXISTENT_BARCODE_XYZ?store_id={TestPOS._store_id}", timeout=20
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
