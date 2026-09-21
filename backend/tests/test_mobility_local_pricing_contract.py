"""Regression contracts for canonical country/city Mobility pricing.

These tests are intentionally lightweight. They protect the architecture that
keeps dedicated Taxi/Scooter screens on the same admin-managed tariff source as
the Mobility Platform and keeps unsupported FX settlement fail-closed.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_scooter_uses_canonical_mobility_pricing_and_locks_quote_on_ride():
    scooter = read("backend/routes/scooter.py")

    assert "from routes.mobility_platform import _resolve_pricing_context" in scooter
    assert "local_pricing = await _resolve_scooter_pricing(" in scooter
    assert '"daily_cap": ride_daily_cap' in scooter
    assert '"currency": ride_currency' in scooter
    assert '"pricing_context": {' in scooter
    assert 'daily_cap = float(ride.get("daily_cap") or MAX_DAILY_CAP)' in scooter


def test_scooter_non_eur_wallet_settlement_is_fail_closed():
    scooter = read("backend/routes/scooter.py")

    assert '"available": local_currency == "EUR"' in scooter
    assert '"billing_supported": local_currency == "EUR"' in scooter
    assert 'if not local_pricing.get("available", True) and not subscription:' in scooter
    assert 'if ride_currency != "EUR":' in scooter


def test_taxi_uses_canonical_mobility_profile_before_legacy_fallback():
    taxi = read("backend/routes/taxi.py")

    canonical = taxi.index("from routes.mobility_platform import _resolve_pricing_context, build_option")
    legacy_city = taxi.index("# 3) Legacy city defaults remain as a compatibility fallback.")
    assert canonical < legacy_city
    assert '"pricing_source": "mobility_profile"' in taxi
    assert '"profile_scope": pricing_context.get("profile_scope") or "country"' in taxi


def test_taxi_non_eur_booking_is_fail_closed_and_ui_surfaces_local_source():
    taxi = read("backend/routes/taxi.py")
    taxi_page = read("frontend/src/pages/TaxiPage.jsx")
    scooter_page = read("frontend/src/pages/ScooterPage.jsx")

    assert 'fare_estimate.get("booking_supported") is False' in taxi
    assert 'str(fare_estimate.get("currency") or "EUR").upper() != "EUR"' in taxi
    assert 'data-testid="taxi-local-pricing-source"' in taxi_page
    assert "selectedEstimate.booking_supported === false" in taxi_page
    assert 'data-testid="scooter-local-pricing"' in scooter_page
    assert "pricing.available === false" in scooter_page


def test_admin_can_persist_local_scooter_daily_cap_and_minimum_balance():
    backend = read("backend/routes/mobility_platform.py")
    admin = read("frontend/src/pages/AdminMobilityPricingPage.jsx")

    assert '"daily_cap"' in backend
    assert '"min_balance"' in backend
    assert 'daily_cap: ""' in admin
    assert 'min_balance: ""' in admin
    assert '["daily_cap", "Tageslimit"]' in admin
    assert '["min_balance", "Mindestguthaben"]' in admin


def test_taxi_frontend_keeps_shared_zone_time_and_fixed_fare_context():
    api = read("frontend/src/services/taxiApi.js")
    page = read("frontend/src/pages/TaxiPage.jsx")

    assert "const sharedPricing = {" in api
    assert "time_tariff: item?.time_tariff || sharedPricing.time_tariff" in api
    assert "fixed_fares: item?.fixed_fares || sharedPricing.fixed_fares" in api
    assert "typeof fixedFareConfig === 'object'" in page
    assert "fixedFareConfig?.fixed_fare" in page


def test_admin_can_control_taxi_premium_and_van_city_factors():
    backend = read("backend/routes/mobility_platform.py")
    taxi = read("backend/routes/taxi.py")
    admin = read("frontend/src/pages/AdminMobilityPricingPage.jsx")

    assert '"premium_multiplier"' in backend
    assert '"van_multiplier"' in backend
    assert '0.1 <= number <= 10' in backend
    assert 'mode.get("premium_multiplier", 1.35)' in taxi
    assert 'mode.get("van_multiplier", 1.20)' in taxi
    assert '["premium_multiplier", "Premium Faktor"]' in admin
    assert '["van_multiplier", "Van Faktor"]' in admin


def test_pricing_scope_is_tracked_per_transport_mode():
    mobility = read("backend/routes/mobility_platform.py")
    scooter = read("backend/routes/scooter.py")
    taxi = read("backend/routes/taxi.py")
    page = read("frontend/src/pages/BidBlitzMobilityPlatformPage.jsx")

    assert 'profile["mode_scopes"] = {' in mobility
    assert '"pricing_scope": ((pricing_profile or {}).get("mode_scopes") or {}).get(option_type' in mobility
    assert '(context.get("mode_scopes") or {}).get("scooter"' in scooter
    assert 'option.get("pricing_scope") or pricing_context.get("profile_scope")' in taxi
    assert 'selectedOption?.pricing_scope || routeSnapshot.pricing_context.profile_scope' in page


def test_admin_lists_real_country_codes_instead_of_pseudo_regions():
    mobility = read("backend/routes/mobility_platform.py")

    assert 'BALKAN_COUNTRY_CODES = {"AL", "MK", "ME", "RS", "BA"}' in mobility
    assert 'def _regional_profile_key_for_country' in mobility
    assert 'admin_country_codes = {"XK", "DE", "AE", *BALKAN_COUNTRY_CODES, *CITY_PRICING_PROFILES.keys()}' in mobility
    assert 'profile_key = _regional_profile_key_for_country(country_code)' in mobility


def test_scooter_local_minimum_fare_is_enforced_end_to_end():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert '"minimum_charge": ride_minimum_charge' in scooter
    assert 'minimum_charge = max(0.0, float(ride.get("minimum_charge") or 0))' in scooter
    assert 'min(max(round(unlock_fee + ride_cost, 2), minimum_charge), daily_cap)' in scooter
    assert 'const minimumCharge = Number(rental.minimum_charge ?? pricing.minimum_charge' in page
    assert 'Math.min(Math.max(cost, minimumCharge)' in page
    assert '>Mindestpreis<' in page
