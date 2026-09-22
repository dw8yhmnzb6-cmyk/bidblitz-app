"""Static regression guards for BidBlitz Charge service appointments."""
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHARGE = ROOT / "backend" / "routes" / "charge_app.py"
MERCHANT = ROOT / "backend" / "routes" / "merchant_portal.py"
API = ROOT / "frontend" / "src" / "services" / "api.js"
CUSTOMER = ROOT / "frontend" / "src" / "pages" / "ChargeServiceRequestsPage.jsx"
PORTAL = ROOT / "frontend" / "src" / "pages" / "MerchantPortalPage.jsx"
ADMIN_CARE = ROOT / "frontend" / "src" / "pages" / "AdminChargeClaimsPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_routes_have_no_accidental_duplicate_decorators():
    charge = _py(CHARGE)
    merchant = _py(MERCHANT)
    assert charge.count('@router.get("/product-lookup")') == 1
    assert charge.count('@router.post("/warranty/{registration_id}/transfer")') == 1
    assert merchant.count('@router.post("/dealer/warranty/create")') == 1


def test_customer_can_accept_or_decline_merchant_reschedule():
    charge = _py(CHARGE)
    api = _text(API)
    customer = _text(CUSTOMER)
    assert '@router.put("/service-requests/{request_id}/respond")' in charge
    assert 'action not in {"accept", "decline"}' in charge
    assert 'next_status = "confirmed" if action == "accept" else "requested"' in charge
    assert 'charge_service_customer_response:' in charge
    assert "respondChargeServiceRequest" in api
    assert "respondToProposal" in customer
    assert "Termin annehmen" in customer
    assert "Anderen Termin wünschen" in customer


def test_merchant_portal_exposes_real_service_appointment_controls():
    merchant = _py(MERCHANT)
    portal = _text(PORTAL)
    api = _text(API)
    assert '@router.post("/dealer/service-requests/{request_id}/status")' in merchant
    assert '"reschedule_requested"' in merchant
    assert "updateMerchantDealerServiceRequestStatus" in api
    assert "updateDealerServiceRequest" in portal
    assert 'title="Servicetermine"' in portal
    assert "merchant-dealer-service-date-" in portal
    assert "merchant-dealer-service-time-" in portal
    assert 'data-testid={`merchant-dealer-service-${status}-${index}`}' in portal
    assert '["confirmed", "Bestätigen"]' in portal
    assert '["reschedule_requested", "Neuer Termin"]' in portal
    assert '["in_service", "Im Service"]' in portal
    assert '["completed", "Abschließen"]' in portal
    assert '["rejected", "Ablehnen"]' in portal


def test_service_appointment_state_machine_is_fail_closed():
    charge = _py(CHARGE)
    merchant = _py(MERCHANT)
    customer = _text(CUSTOMER)
    portal = _text(PORTAL)
    assert "_SERVICE_CUSTOMER_CANCELLABLE" in charge
    assert '"in_service"' not in charge.split("_SERVICE_CUSTOMER_CANCELLABLE =", 1)[1].split("}", 1)[0]
    assert '"status": current_status' in charge
    assert 'getattr(result, "matched_count", 1) == 0' in charge
    assert "_CHARGE_SERVICE_TRANSITIONS" in merchant
    assert '"requested": {"confirmed", "reschedule_requested", "rejected"}' in merchant
    assert '"confirmed": {"reschedule_requested", "in_service", "rejected"}' in merchant
    assert '"in_service": {"completed", "rejected"}' in merchant
    assert '"status": current_status' in merchant
    assert 'Statuswechsel von {current_status} zu {status} ist nicht zulässig' in merchant
    assert 'const cancellable = ["requested", "confirmed", "reschedule_requested"]' in customer
    assert "const serviceActions = {" in portal


def test_service_updates_are_retry_safe_and_history_complete():
    charge = _py(CHARGE)
    merchant = _py(MERCHANT)
    assert "response_hash = hashlib.sha256" in charge
    assert "charge_service_customer_response:{request_id}:{response_hash}" in charge
    assert '"merchant_note": ""' in charge
    assert "schedule_changed =" in merchant
    assert "note_changed =" in merchant
    assert "status_changed =" in merchant
    assert '"reused": True' in merchant
    assert "if status_changed or schedule_changed or note_changed:" in merchant


def test_customer_and_merchant_show_service_status_history():
    customer = _text(CUSTOMER)
    portal = _text(PORTAL)
    assert "charge-service-history-" in customer
    assert "historyActorLabel" in customer
    assert "formatServiceDateTime" in customer
    assert "merchant-dealer-service-history-" in portal
    assert "chargeServiceStatusLabel" in portal
    assert "chargeServiceActorLabel" in portal
    assert "formatChargeServiceDateTime" in portal


def test_merchant_service_schedule_validation_is_strict():
    merchant = _py(MERCHANT)
    assert "_validate_charge_service_schedule_date" in merchant
    assert "Servicetermin muss YYYY-MM-DD sein" in merchant
    assert "Servicetermin darf nicht in der Vergangenheit liegen" in merchant
    assert "_validate_charge_service_schedule_time" in merchant
    assert "Servicezeit muss HH:MM sein" in merchant
    assert 'req.scheduled_date or service_request.get("scheduled_date")' in merchant
    assert 'req.scheduled_time or service_request.get("scheduled_time")' in merchant
    assert 'service_request.get("completed_at") or now' in merchant


def test_admin_can_oversee_charge_service_appointments():
    charge = _py(CHARGE)
    api = _text(API)
    assert '@router.get("/admin/service-requests")' in charge
    assert '"service_requests": [_service_request_card(item) for item in rows]' in charge
    assert '"requested": sum(1 for item in rows if item.get("status") == "requested")' in charge
    assert '"in_service": sum(1 for item in rows if item.get("status") == "in_service")' in charge
    assert '"completed": sum(1 for item in rows if item.get("status") == "completed")' in charge
    assert 'getChargeServiceRequestsAdmin' in api


def test_admin_care_page_shows_service_appointments():
    admin_page = _text(ADMIN_CARE)
    assert "getChargeServiceRequestsAdmin" in _text(API)
    assert 'data-testid="admin-charge-service-section"' in admin_page
    assert "Servicetermine überwachen" in admin_page
    assert "admin-charge-service-search" in admin_page
    assert "admin-charge-service-filter" in admin_page
    assert "admin-charge-service-item-" in admin_page
    assert "ServiceStatusBadge" in admin_page
    assert "Letzte Statusänderungen" in admin_page


def test_admin_can_control_service_appointments():
    admin_page = _text(ADMIN_CARE)
    api = _text(API)
    assert "updateMerchantDealerServiceRequestStatus" in api
    assert "updateService" in admin_page
    assert "Admin-Steuerung" in admin_page
    assert "admin-charge-service-date-" in admin_page
    assert "admin-charge-service-time-" in admin_page
    assert "admin-charge-service-note-" in admin_page
    assert "admin-charge-service-action-" in admin_page
    assert 'in_service: [["completed", "Abschließen"], ["rejected", "Ablehnen"]]' in admin_page
