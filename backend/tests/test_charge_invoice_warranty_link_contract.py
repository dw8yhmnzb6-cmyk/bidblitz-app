"""Static guards for stable Charge invoice-to-warranty linking."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_warranty_models_and_cards_keep_stable_invoice_id():
    src = _py(ROUTE)
    assert "invoice_id: str = """ in src
    assert "invoice_id: Optional[str] = None" in src
    assert '"invoice_id": doc.get("invoice_id") or ""' in src


def test_registration_resolves_linked_invoice_with_user_scope():
    src = _py(ROUTE)
    register_start = src.index("async def register_charge_warranty")
    register_end = src.index('@router.post("/invoices/save")', register_start)
    block = src[register_start:register_end]
    assert "_find_user_invoice(user_id, req.invoice_id.strip())" in block
    assert '"invoice_id": (linked_invoice or {}).get("invoice_id")' in block
    assert '"invoice_number": (linked_invoice or {}).get("invoice_number")' in block


def test_linked_invoice_cannot_be_deleted_while_warranty_references_it():
    src = _py(ROUTE)
    start = src.index("async def delete_charge_invoice")
    end = src.index('@router.post("/warranty/{registration_id}/attachments")', start)
    block = src[start:end]
    assert "charge_app_warranties.find_one" in block
    assert '"invoice_id": invoice_id' in block
    assert "Rechnung kann nicht gelöscht werden" in block


def test_customer_can_create_and_unlink_warranty_from_saved_invoice():
    page = _text(PAGE)
    assert "createWarrantyFromInvoice" in page
    assert "charge-app-invoice-create-warranty-" in page
    assert "invoice_id: item.invoice_id || """ in page
    assert "charge-app-warranty-linked-invoice" in page
    assert "unlinkWarrantyInvoice" in page
    assert "charge-app-warranty-unlink-invoice" in page


def test_warranty_form_resets_invoice_id_after_save_and_cancel():
    page = _text(PAGE)
    assert page.count('invoice_id: "",') >= 3
