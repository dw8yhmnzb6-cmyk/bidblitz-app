"""Static guards for Charge warranty deletion while Care claims are active."""
from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"


def test_active_charge_care_claim_blocks_warranty_delete():
    src = ROUTE.read_text(encoding="utf-8")
    ast.parse(src)
    start = src.index('async def delete_charge_warranty')
    end = src.index('@router.put("/invoices/{invoice_id}")', start)
    block = src[start:end]
    assert "merchant_warranty_claims.find_one" in block
    assert '"customer_user_id": user_id' in block
    assert '"status": {"$in": ["open", "in_review", "approved"]}' in block
    assert "Garantie kann nicht gelöscht werden" in block
