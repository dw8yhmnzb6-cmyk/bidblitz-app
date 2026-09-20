"""Regression guards for BidBlitz Charge document management.

These tests are side-effect free. They validate ownership-scoped CRUD routes,
attachment deletion support, and the customer UI wiring without contacting
object storage or external services.
"""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

CHARGE_ROUTE = BACKEND / "routes" / "charge_app.py"
CHARGE_STORAGE = BACKEND / "services" / "charge_storage.py"
CHARGE_PAGE = FRONTEND / "src" / "pages" / "ChargeAppPage.jsx"
CHARGE_ATTACHMENTS = FRONTEND / "src" / "components" / "charge" / "ChargeAttachmentActions.jsx"
API_SERVICE = FRONTEND / "src" / "services" / "api.js"


def _py_source(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_document_management_routes_exist_and_are_user_scoped():
    src = _py_source(CHARGE_ROUTE)
    for route in (
        '@router.put("/warranty/{registration_id}")',
        '@router.delete("/warranty/{registration_id}")',
        '@router.delete("/warranty/{registration_id}/attachments/{attachment_id}")',
        '@router.put("/invoices/{invoice_id}")',
        '@router.delete("/invoices/{invoice_id}")',
        '@router.delete("/invoices/{invoice_id}/attachments/{attachment_id}")',
    ):
        assert route in src

    assert '"user_id": user_id, "registration_id": registration_id' in src
    assert '"user_id": user_id, "invoice_id": invoice_id' in src


def test_charge_storage_delete_is_retry_safe_for_missing_blobs():
    src = _py_source(CHARGE_STORAGE)
    assert "def delete_bytes(path: str) -> bool:" in src
    assert "resp.status_code == 404" in src


def test_duplicate_serial_and_invoice_numbers_are_rejected_on_update():
    src = _py_source(CHARGE_ROUTE)
    assert '"registration_id": {"$ne": registration_id}' in src
    assert '"invoice_id": {"$ne": invoice_id}' in src
    assert "Diese Seriennummer ist bereits registriert" in src
    assert "Diese Rechnungsnummer ist bereits gespeichert" in src


def test_charge_frontend_exposes_edit_delete_actions():
    page = _text(CHARGE_PAGE)
    for token in (
        "editingWarrantyId",
        "editingInvoiceId",
        "editWarranty",
        "deleteWarranty",
        "deleteWarrantyAttachment",
        "editInvoice",
        "deleteInvoice",
        "deleteInvoiceAttachment",
        "Bearbeiten abbrechen",
    ):
        assert token in page


def test_charge_attachment_component_has_remove_action():
    src = _text(CHARGE_ATTACHMENTS)
    assert "onDelete" in src
    assert "deletingId" in src
    assert "Trash2" in src
    assert "Entfernen" in src


def test_charge_api_service_exposes_document_crud():
    src = _text(API_SERVICE)
    for token in (
        "updateChargeWarranty",
        "deleteChargeWarranty",
        "deleteChargeWarrantyAttachment",
        "updateChargeInvoice",
        "deleteChargeInvoice",
        "deleteChargeInvoiceAttachment",
    ):
        assert token in src
