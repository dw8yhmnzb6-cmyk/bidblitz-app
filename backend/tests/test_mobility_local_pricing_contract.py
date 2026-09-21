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
    assert 'if not local_pricing.get("available", True):' in scooter
    assert 'and not subscription' not in scooter
    assert 'if ride_currency != "EUR":' in scooter
    assert 'payment_status = "reconciliation_required"' in scooter
    assert '"settlement_currency": ride_currency' in scooter
    assert '"amount_due_currency": ride_currency if amount_due > 0 else None' in scooter
    assert '"currency": ride_currency' in scooter
    assert '"currency": str(existing.get("currency") or "EUR").upper()' in scooter
    assert 'elif amount_to_debit > 0:' in scooter
    assert 'if ride_currency == "EUR":' in scooter
    assert 'scooter_inc["total_revenue"] = float(settlement.get("total_cost") or 0)' in scooter
    assert '"$inc": scooter_inc' in scooter


def test_scooter_end_ui_surfaces_locked_currency_and_reconciliation_state():
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert "const summaryCurrency = String(data.summary.currency || data.summary.amount_due_currency || activeRental.currency || pricing.currency || \'EUR\').toUpperCase();" in page
    assert 'data.summary.payment_status === "reconciliation_required"' in page
    assert "Abrechnung wird geprüft:" in page
    assert "Gesamt: €${data.summary.total_cost.toFixed(2)}" not in page


def test_taxi_uses_canonical_mobility_profile_before_legacy_fallback():
    taxi = read("backend/routes/taxi.py")

    canonical = taxi.index("from routes.mobility_platform import _resolve_pricing_context, build_option")
    legacy_city = taxi.index("# 3) Legacy city defaults remain as a compatibility fallback.")
    assert canonical < legacy_city
    assert '"pricing_source": "mobility_profile"' in taxi
    assert '"profile_scope": option.get("pricing_scope") or pricing_context.get("profile_scope") or "country"' in taxi


def test_taxi_non_eur_booking_is_fail_closed_and_ui_surfaces_local_source():
    taxi = read("backend/routes/taxi.py")
    taxi_page = read("frontend/src/pages/TaxiPage.jsx")
    scooter_page = read("frontend/src/pages/ScooterPage.jsx")

    assert 'fare_estimate.get("booking_supported") is False' in taxi
    assert 'str(fare_estimate.get("currency") or "EUR").upper() != "EUR"' in taxi
    assert 'data-testid="taxi-local-pricing-source"' in taxi_page
    assert "selectedEstimate.booking_supported === false" in taxi_page
    assert "selectedEstimate?.booking_supported === false" in taxi_page
    assert "(!selectedEstimate || selectedEstimate.booking_supported === false)" in taxi_page
    assert "Tarif noch nicht buchbar" in taxi_page
    assert "currency={selectedEstimate.currency || 'EUR'}" in taxi_page
    assert "currency={selectedEstimate?.currency || 'EUR'}" in taxi_page
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


def test_taxi_local_mode_is_initialized_before_vehicle_multiplier():
    taxi = read("backend/routes/taxi.py")
    mode_pos = taxi.index('mode = (pricing_context.get("modes") or {}).get("taxi") or {}')
    multiplier_pos = taxi.index('vehicle_multiplier = {', mode_pos)
    assert mode_pos < multiplier_pos


def test_taxi_booking_reserves_exact_displayed_quote_once():
    taxi = read("backend/routes/taxi.py")
    page = read("frontend/src/pages/TaxiPage.jsx")
    api = read("frontend/src/services/taxiApi.js")

    assert 'locked_quote = await _load_taxi_price_quote(req.quote_id, user_id, req)' in taxi
    assert 'fare_total = round(float(locked_quote.get("fare_total")' in taxi
    assert '"status": "booking"' in taxi
    assert '"booking_idempotency_key": client_key' in taxi
    assert '"booking_ride_id": ride_id' in taxi
    assert 'status in {"failed", "used", "claimed"}' in taxi
    assert 'status not in {"active", "booking"}' in taxi
    assert '"status": "used"' in taxi
    assert 'pricing_source": "locked_server_quote" if locked_quote' in taxi
    assert 'quoteId: selectedEstimate.quote_id || null' in page
    assert 'idempotencyKey: bookingAttemptRef.current.key' in page
    assert 'quote_id: quoteId || null' in api
    assert 'idempotency_key: idempotencyKey || null' in api


def test_taxi_geocoding_is_not_hardcoded_to_germany_austria_switzerland():
    api = read("frontend/src/services/taxiApi.js")

    assert "country=de,at,ch" not in api
    assert "/api/taxi/geocode?" in api
    assert 'qs.set("lat", String(lat))' in api
    assert 'qs.set("lng", String(lng))' in api


def test_taxi_ride_completion_is_retry_safe_and_charges_only_delta():
    taxi = read("backend/routes/taxi.py")

    assert 'additional_charge = round(max(0.0, float(fare["total"]) - reserved_amount), 2)' in taxi
    assert 'amount=additional_charge' in taxi
    assert 'idempotency_key=f"taxi-settle-delta:{req.ride_id}"' in taxi
    assert 'idempotency_key=f"taxi-driver-earning:{req.ride_id}"' in taxi
    assert '{"ride_id": req.ride_id, "status": RideStatus.STARTED.value}' in taxi
    assert 'async def _ensure_taxi_settlement_reporting(' in taxi
    assert 'driver_marker = f"settled_ride_markers.{marker_hash}"' in taxi
    assert 'revenue_marker = f"taxi_ride_markers.{marker_hash}"' in taxi
    assert 'ride["status"] == RideStatus.COMPLETED.value and ride.get("payment_status") == "settled"' in taxi
    assert '"replayed": True' in taxi


def test_taxi_promo_usage_is_reserved_before_wallet_value_moves():
    taxi = read("backend/routes/taxi.py")
    promo = read("backend/utils/taxi_promo.py")

    reserve_pos = taxi.index("promo_reservation = await reserve_redemption(")
    debit_pos = taxi.index("reservation = await debit_wallet(", reserve_pos)
    assert reserve_pos < debit_pos
    assert 'await release_redemption(user_id, promo_applied["code"], ride_id)' in taxi
    assert 'await record_redemption(user_id, promo_applied["code"], ride_id, promo_applied["discount"])' in taxi
    assert 'reason": "auth_required"' in promo
    assert 'existing_status == "reserving"' in promo
    assert 'existing_status in {"released", "rejected"}' in promo
    assert '"uses": {"$lt": max_uses}' in promo


def test_taxi_cancellation_cannot_race_driver_lifecycle_or_double_money():
    taxi = read("backend/routes/taxi.py")

    assert '"cancellation_state": {"$nin": ["processing", "completed"]}' in taxi
    assert '"cancellation_state": "processing"' in taxi
    assert '"cancellation_state": "completed"' in taxi
    assert '"cancellation_user_id": user_id' in taxi
    assert 'status": {"$in": [RideStatus.ACCEPTED.value, RideStatus.ARRIVING.value]}' in taxi
    assert 'min(float(CANCELLATION_FEE), reserved_amount)' in taxi
    assert 'idempotency_key=f"taxi-cancel-refund:{req.ride_id}"' in taxi
    assert 'idempotency_key=f"taxi-cancel-fee:{req.ride_id}"' in taxi
    assert 'idempotency_key=f"taxi-cancel-comp:{req.ride_id}"' in taxi
    assert '"replayed": True' in taxi


def test_taxi_driver_assignment_is_serialized_and_releases_on_finish_or_cancel():
    taxi = read("backend/routes/taxi.py")

    assert "async def _claim_driver_active_ride" in taxi
    assert "async def _release_driver_active_ride" in taxi
    assert '"active_ride_id": ride_id' in taxi
    assert 'active.get("ride_id") != req.ride_id' in taxi
    schedule_pos = taxi.index('scheduled_at = ride.get("scheduled_at")')
    lock_pos = taxi.index('if not await _claim_driver_active_ride(driver["driver_id"], req.ride_id):', schedule_pos)
    claim_pos = taxi.index('# Atomic claim: exactly one driver can transition requested -> accepted.', schedule_pos)
    assert schedule_pos < lock_pos < claim_pos
    assert 'await _release_driver_active_ride(driver["driver_id"], req.ride_id)' in taxi
    assert 'await _release_driver_active_ride(ride.get("driver_id"), req.ride_id)' in taxi


def test_taxi_driver_arriving_and_start_are_retry_safe():
    taxi = read("backend/routes/taxi.py")

    assert '"message": "Kunde wurde bereits benachrichtigt", "replayed": True' in taxi
    assert '"message": "Fahrt bereits gestartet", "replayed": True' in taxi
    assert '"cancellation_state": {"$nin": ["processing", "completed"]}' in taxi


def test_non_european_unconfigured_countries_do_not_receive_fake_eu_tariffs():
    mobility = read("backend/routes/mobility_platform.py")

    assert '"UNSUPPORTED": {' in mobility
    assert '"strict_modes": True' in mobility
    assert 'if code in EUROPE_COUNTRY_CODES:' in mobility
    assert 'return "UNSUPPORTED"' in mobility


def test_taxi_does_not_fall_back_to_legacy_default_for_strict_regions():
    taxi = read("backend/routes/taxi.py")

    assert 'if pricing_context.get("strict_modes"):' in taxi
    assert '"pricing_source": "mobility_profile_unavailable"' in taxi
    assert '"booking_supported": False' in taxi
    assert '"Für diesen Standort ist noch kein verifizierter Taxi-Tarif freigeschaltet."' in taxi


def test_taxi_does_not_issue_quotes_for_unsupported_or_non_eur_fares():
    taxi = read("backend/routes/taxi.py")

    assert 'item.get("booking_supported") is False' in taxi
    assert 'str(item.get("currency") or "EUR").upper() != "EUR"' in taxi
    assert 'float(item.get("fare") or 0) <= 0' in taxi
    assert 'item["quote_id"] = None' in taxi
    assert 'item["quote_expires_at"] = None' in taxi


def test_zero_coordinates_remain_valid_in_mobility_and_taxi_helpers():
    mobility = read("backend/routes/mobility_platform.py")
    taxi = read("backend/routes/taxi.py")

    assert "if dlat is None or dlng is None:" in mobility
    assert "if slat is None or slng is None:" in mobility
    assert mobility.count("if clat is None or clng is None:") >= 2
    assert "if elat is None or elng is None:" in mobility
    assert 'slat = loc.get("lat") if loc.get("lat") is not None else scooter.get("lat")' in mobility
    assert 'slng = loc.get("lng") if loc.get("lng") is not None else scooter.get("lng")' in mobility
    assert "if not addr or lat is None or lng is None:" in taxi


def test_scooter_tariff_resolution_and_selection_preview_fail_closed():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert 'logger.warning("Scooter tariff resolution failed closed: %s", exc)' in scooter
    assert '"billing_supported": False' in scooter
    assert '"source": "pricing_resolution_failed"' in scooter
    assert '(context.get("mode_scopes") or {}).get("scooter"' in scooter

    assert "const fetchPricingForLocation = async (lat, lng) => {" in page
    assert "const selectScooter = async (scooter) => {" in page
    assert "pricingSelectionRequestRef" in page
    assert "setSelectedPricing(localPricing)" in page
    assert "if (pricingSelectionLoading || !selectedPricing)" in page
    assert "Number(selectedPricing.unlock_fee ?? 0).toFixed(2)" in page


def test_scooter_effective_subscription_tariff_matches_preview_and_unlock():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert "def _apply_scooter_subscription_pricing(" in scooter
    assert '"minimum_charge": round(float(subscription.get("minimum_charge", unlock_fee) or 0), 2)' in scooter
    assert '"min_balance": 0.0' in scooter
    assert 'pricing = _apply_scooter_subscription_pricing(local_pricing, subscription)' in scooter
    assert 'effective_pricing = _apply_scooter_subscription_pricing(local_pricing, subscription)' in scooter
    assert 'pricing["pricing_hash"] = _scooter_pricing_hash(pricing)' in scooter
    assert 'current_pricing_hash = _scooter_pricing_hash(effective_pricing)' in scooter
    assert 'secrets.compare_digest(req.pricing_hash, current_pricing_hash)' in scooter
    assert '"Scooter-Tarif hat sich geändert. Bitte Preis neu laden und erneut bestätigen."' in scooter
    assert "pricing_hash: Optional[str] = Field(default=None, min_length=8, max_length=128)" in scooter
    assert "pricing_hash: selectedPricing.pricing_hash || null" in page


def test_scooter_debt_settlement_happens_after_tariff_confirmation():
    scooter = read("backend/routes/scooter.py")

    hash_pos = scooter.index("if req.pricing_hash and not secrets.compare_digest")
    debt_pos = scooter.index("outstanding = await _settle_outstanding_scooter_debts(user)", hash_pos)
    device_pos = scooter.index("device_id = scooter.get(\"device_id\")", debt_pos)
    assert hash_pos < debt_pos < device_pos


def test_scooter_unlock_replay_never_treats_cancelled_attempt_as_success():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert 'existing_ride.get("status") not in {"active", "paused", "completed"}' in scooter
    assert '"error": "unlock_attempt_not_replayable"' in scooter
    assert '"error": "pricing_changed"' in scooter

    assert "const unlockAttemptScooterRef = useRef(null);" in page
    assert "unlockAttemptScooterRef.current !== scooter.scooter_id" in page
    assert "unlockAttemptScooterRef.current = scooter.scooter_id" in page
    assert "unlockAttemptKeyRef.current = null;" in page
    assert "unlockAttemptScooterRef.current = null;" in page
    assert "errorCode === 'pricing_changed'" in page
    assert "const detailMessage = typeof err?.detail === 'string'" in page


def test_scooter_my_subscription_uses_same_identity_lookup_as_pricing():
    scooter = read("backend/routes/scooter.py")

    start = scooter.index('@router.get("/my-subscription")')
    end = scooter.index('@router.post("/cancel-subscription")', start)
    handler = scooter[start:end]
    assert "sub = await _get_active_scooter_subscription(user)" in handler
    assert '"user_email": user.get("email", "")' not in handler


def test_scooter_pause_resume_use_real_iot_state_transitions():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert '@router.post("/pause")' in scooter
    assert '@router.post("/resume")' in scooter
    assert "command = await send_device_command(device_id, DeviceCommand.LOCK)" in scooter
    assert "command = await send_device_command(device_id, DeviceCommand.UNLOCK)" in scooter
    assert '{"$set": {"control_action": "pause", "control_started_at": control_started_at}}' in scooter
    assert '{"$set": {"control_action": "resume", "control_started_at": control_started_at}}' in scooter
    assert '{"$set": {"control_action": "end", "control_started_at": control_started_at}}' in scooter
    assert '"$unset": {"control_action": "", "control_started_at": ""}' in scooter
    assert "Eine andere Scooter-Aktion wird bereits verarbeitet" in scooter
    assert 'if current.get("control_action") != "pause":' in scooter
    assert 'if current.get("control_action") != "resume":' in scooter
    assert "if not TEST_MODE and not _iot_live_configured():" in scooter
    assert '"status": "paused"' in scooter
    assert '"status": "active"' in scooter
    assert "/api/scooter/pause" in page
    assert "/api/scooter/resume" in page
    assert "pricing.pause_rate" not in page
    assert "Scooter bleibt reserviert" in page
    assert "Der normale Fahrtarif läuft weiter" in page


def test_scooter_history_keeps_currency_totals_separate():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert "totals_by_currency = {}" in scooter
    assert 'currency = str(ride.get("currency") or "EUR").upper()' in scooter
    assert 'total_spent_eur = round(float(totals_by_currency.get("EUR", 0) or 0), 2)' in scooter
    assert '"totals_by_currency": totals_by_currency' in scooter
    assert '"mixed_currency_history": len(totals_by_currency) > 1' in scooter
    assert "rental.currency" in page
    assert "toUpperCase()" in page


def test_scooter_pause_pricing_matches_actual_billing():
    scooter = read("backend/routes/scooter.py")

    assert '"free_paused_minutes": 0' in scooter
    assert '"pause_billing_mode": "ride_rate"' in scooter
    assert '"pause_rate": pricing.get("per_minute", PER_MINUTE_RATE)' in scooter
    assert '"free_paused_minutes": 5' not in scooter


def test_scooter_share_redemption_is_atomic_and_tariff_safe():
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/ScooterPage.jsx")

    assert "duration_minutes: int = Field(default=60, ge=5, le=1440)" in scooter
    assert 'code = f"BLZ-{secrets.token_hex(4).upper()}"' in scooter
    assert "Bitte verifiziere zuerst deinen Ausweis, um eine Scooter-Freigabe zu nutzen." in scooter
    assert "Du hast bereits eine aktive Scooter-Fahrt" in scooter
    assert '"status": "active"' in scooter
    assert '"guest_user_id": None' in scooter
    assert "Code wurde bereits eingelöst oder ist nicht mehr verfügbar" in scooter
    assert 'existing_expires = datetime.fromisoformat' in scooter
    assert '{"$set": {"status": "expired", "expired_at": now.isoformat()}}' in scooter
    assert '{"ride_id": ride_id, "status": "active"}' in scooter
    assert '{"$set": {"status": "ended", "ended_at": completed_at}}' in scooter
    assert 'rate = float(ride.get("per_minute_rate") or PER_MINUTE_RATE)' in scooter
    assert 'share["currency"] = str(ride.get("currency") or "EUR").upper()' in scooter
    assert "data.detail?.message" in page
    assert "Die Abrechnung bleibt beim Gastgeber." in page
    assert "String(s.currency || activeRental?.currency || pricing.currency || 'EUR').toUpperCase()" in page


def test_admin_scooter_fleet_cannot_override_active_lifecycle():
    scooter = read("backend/routes/scooter.py")
    admin_page = read("frontend/src/components/admin/AdminScootersTab.jsx")

    assert '"status": {"$in": ["active", "paused"]}' in scooter
    assert '"expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}' in scooter
    assert 'scooter.get("status") in {"in_use", "unlocking", "reserved"}' in scooter
    assert "Aktiver Scooter-Lifecycle: Status kann nicht manuell überschrieben werden" in scooter
    assert "Aktiver Scooter-Lifecycle: Geräte-ID kann nicht geändert werden" in scooter
    assert "Scooter ist aktiv gebunden und kann nicht gelöscht werden" in scooter

    assert "const lifecycleLocked = Boolean(" in admin_page
    assert '["in_use", "unlocking", "reserved"].includes(scooter.status)' in admin_page
    assert "disabled={lifecycleLocked}" in admin_page
    assert "Aktiver Scooter-Lifecycle – Status gesperrt" in admin_page
    assert "Aktiver Scooter-Lifecycle – Löschen gesperrt" in admin_page


def test_admin_scooter_hardware_identity_is_unique_and_errors_visible():
    scooter = read("backend/routes/scooter.py")
    admin_page = read("frontend/src/components/admin/AdminScootersTab.jsx")

    assert 'existing = await db.scooters.find_one({"device_id": device_id}' in scooter
    assert 'existing_qr = await db.scooters.find_one({"qr_code": qr_code}' in scooter
    assert "QR-Code already registered" in scooter
    assert '"device_id": normalized_device_id, "scooter_id": {"$ne": scooter_id}' in scooter
    assert "Device ID already registered" in scooter
    assert "Device ID erforderlich" in scooter

    assert "setError(e?.message || String(e))" in admin_page
    assert "catch { /* noop */ }" not in admin_page


def test_scooter_critical_iot_commands_require_physical_confirmation():
    scooter = read("backend/routes/scooter.py")

    assert "critical_state_command = command in {DeviceCommand.UNLOCK, DeviceCommand.LOCK}" in scooter
    assert "response.status_code == 202 or not explicitly_confirmed" in scooter
    assert '"status": "pending_confirmation"' in scooter
    assert '"confirmation_required": True' in scooter
    assert "Device command accepted but physical state is not confirmed" in scooter
    assert "Command confirmed by IoT provider" in scooter


def test_scooter_uncertain_device_state_is_quarantined_until_locked_telemetry():
    scooter = read("backend/routes/scooter.py")

    assert "async def _quarantine_uncertain_scooter_state(" in scooter
    assert '"status": "offline"' in scooter
    assert '"device_state_uncertain": True' in scooter
    assert 'cmd_result.data.get("confirmation_required")' in scooter
    assert 'command="lock_after_payment_failure"' in scooter
    assert 'command="lock_after_assignment_failure"' in scooter

    assert 'if scooter.get("device_state_uncertain") and not scooter.get("current_ride_id"):' in scooter
    assert 'if req.locked:' in scooter
    assert 'update["status"] = "available"' in scooter
    assert 'update["device_state_uncertain"] = False' in scooter
    assert 'update["device_state_uncertain_reason"] = "physical_unlocked_without_active_ride"' in scooter


def test_scooter_physical_command_retries_use_stable_operation_keys():
    scooter = read("backend/routes/scooter.py")

    assert "operation_key: Optional[str] = None" in scooter
    assert 'f"{device_id}:{command.value}:{operation_key}"' in scooter
    assert 'command_id = f"SCMD-{command_hash.upper()}"' in scooter
    assert '"Idempotency-Key": f"scooter-command:{command_id}"' in scooter
    assert '"attempt_count": 1' in scooter
    assert '"replayed": True' in scooter
    assert 'operation_key=f"ride:{ride_id}:unlock"' in scooter
    assert 'operation_key=f"ride:{ride_id}:rollback-lock-payment"' in scooter
    assert 'operation_key=f"ride:{ride_id}:rollback-lock-assignment"' in scooter
    assert 'operation_key=f"ride:{ride[\'ride_id\']}:pause-lock"' in scooter
    assert 'operation_key=f"ride:{ride[\'ride_id\']}:resume-unlock"' in scooter
    assert 'operation_key=f"ride:{ride_id}:end-lock"' in scooter


def test_scooter_device_telemetry_reconciles_recent_pending_commands():
    scooter = read("backend/routes/scooter.py")

    assert "confirmed_command = DeviceCommand.LOCK.value if req.locked else DeviceCommand.UNLOCK.value" in scooter
    assert "confirmation_cutoff = (now - timedelta(minutes=2)).isoformat()" in scooter
    assert '"status": "pending_confirmation"' in scooter
    assert '"last_attempt_at": {"$gte": confirmation_cutoff}' in scooter
    assert '"confirmed_via": "device_telemetry"' in scooter
    assert '"physical_state": "locked" if req.locked else "unlocked"' in scooter
    assert '"status": "success"' in scooter


def test_scooter_reservation_lifecycle_is_atomic_and_unlockable_by_owner():
    scooter = read("backend/routes/scooter.py")

    assert '"status": "reserved"' in scooter
    assert '"reserved_by": user_id' in scooter
    assert '"reserved_until": {"$gt": now_claim_iso}' in scooter
    assert "Scooter ist für einen anderen Nutzer reserviert" in scooter
    assert '"status": "used", "used_at": now.isoformat(), "ride_id": ride_id' in scooter
    assert '"reserved_by": ""' in scooter
    assert '"reserved_until": ""' in scooter

    assert "existing_target = await db.scooter_reservations.find_one" in scooter
    assert '"cancel_reason": "replaced_by_new_reservation"' in scooter
    assert '"status": "available"' in scooter
    assert "claim.modified_count != 1" in scooter
    assert "Scooter wurde gerade von einem anderen Nutzer reserviert" in scooter
    assert '"fee_charged": False' in scooter
