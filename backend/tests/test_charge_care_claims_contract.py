"""Side-effect-free regression guards for BidBlitz Charge Care claims."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ROUTE = BACKEND / "routes" / "charge_app.py"
CUSTOMER_PAGE = FRONTEND / "src" / "pages" / "ChargeCareClaimsPage.jsx"
ADMIN_PAGE = FRONTEND / "src" / "pages" / "AdminChargeClaimsPage.jsx"
CHARGE_PAGE = FRONTEND / "src" / "pages" / "ChargeAppPage.jsx"
APP = FRONTEND / "src" / "App.js"
API = FRONTEND / "src" / "services" / "api.js"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_claim_customer_endpoints_are_present_and_user_scoped():
    src = _py(ROUTE)
    for route in (
        '@router.post("/warranty/{registration_id}/claims")',
        '@router.get("/claims")',
        '@router.get("/claims/{claim_id}")',
        '@router.post("/claims/{claim_id}/messages")',
        '@router.put("/claims/{claim_id}/cancel")',
    ):
        assert route in src
    assert '"claim_id": claim_id, "user_id": user_id' in src
    assert '"user_id": user_id' in src


def test_charge_claim_duplicate_active_case_is_blocked():
    src = _py(ROUTE)
    assert '"status": {"$in": ["open", "in_review", "approved"]}' in src
    assert '"duplicate": True' in src


def test_charge_claim_admin_endpoints_require_admin():
    src = _py(ROUTE)
    assert '@router.get("/admin/claims")' in src
    assert '@router.put("/admin/claims/{claim_id}/status")' in src
    admin_start = src.index('async def admin_list_charge_claims')
    admin_end = src.index('@router.get("/warranty/{registration_id}/pass")', admin_start)
    block = src[admin_start:admin_end]
    assert "await _require_admin(request)" in block
    assert "_validate_claim_status" in block


def test_dashboard_reports_claim_counts():
    src = _py(ROUTE)
    assert '"claims_total"' in src
    assert '"claims_open"' in src
    assert "charge_warranty_claims.count_documents" in src


def test_charge_claim_customer_ui_is_routed_from_warranties():
    customer = _text(CUSTOMER_PAGE)
    charge = _text(CHARGE_PAGE)
    app = _text(APP)
    assert "ChargeCareClaimsPage" in app
    assert 'case "/charge-app/claims":' in app
    assert "charge-app-warranty-claim-" in charge
    assert "charge-app-claims-button" in charge
    assert "Garantiefall eröffnen" in customer
    assert "charge-care-message-send" in customer


def test_charge_claim_admin_ui_and_api_are_wired():
    admin = _text(ADMIN_PAGE)
    app = _text(APP)
    api = _text(API)
    assert "AdminChargeClaimsPage" in app
    assert 'case "/admin/charge-claims":' in app
    for token in (
        "createChargeWarrantyClaim",
        "getChargeClaims",
        "getChargeClaim",
        "addChargeClaimMessage",
        "cancelChargeClaim",
        "getChargeClaimsAdmin",
        "updateChargeClaimStatusAdmin",
    ):
        assert token in api
    assert "Entscheidung speichern" in admin
    assert "admin-charge-claim-save-" in admin


def test_charge_claim_evidence_files_are_protected_and_wired():
    route = _py(ROUTE)
    customer = _text(CUSTOMER_PAGE)
    admin = _text(ADMIN_PAGE)
    api = _text(API)

    assert '@router.post("/claims/{claim_id}/attachments")' in route
    assert '@router.get("/claims/{claim_id}/attachments/{attachment_id}/download")' in route
    assert '@router.delete("/claims/{claim_id}/attachments/{attachment_id}")' in route
    assert '"claim_id": claim_id, "user_id": user_id' in route
    assert 'query["user_id"] = user_id' in route
    assert "uploadChargeClaimAttachment" in api
    assert "deleteChargeClaimAttachment" in api
    assert "charge-care-evidence-upload" in customer
    assert "admin-charge-claim-attachments-" in admin


def test_repeated_admin_save_does_not_duplicate_same_note_message():
    src = _py(ROUTE)
    assert 'note != str(claim.get("admin_note") or "").strip()' in src
