"""Offline regression tests: real fee/route functions, simulated storage and wallets.

Only selected functions/constants are loaded to avoid database startup and any
network, email, or real payment side effects. No payment code is reimplemented.
"""
import ast
import asyncio
import math
import secrets
import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from core.merchant_commission import (
    MIN_MERCHANT_COMMISSION_RATE, MIN_MERCHANT_COMMISSION_PERCENT,
    effective_merchant_rate, effective_merchant_percent,
)

class HttpError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


def load_functions(path, names, **values):
    source = ast.parse((BACKEND / path).read_text())
    nodes = []
    for node in source.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names:
            node.decorator_list = []
            node.returns = None
            for arg in node.args.args:
                arg.annotation = None
            nodes.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in node.targets):
            nodes.append(node)
    env = dict(math=math, secrets=secrets, datetime=datetime, timezone=timezone,
               MIN_MERCHANT_COMMISSION_RATE=MIN_MERCHANT_COMMISSION_RATE,
               MIN_MERCHANT_COMMISSION_PERCENT=MIN_MERCHANT_COMMISSION_PERCENT,
               effective_merchant_rate=effective_merchant_rate,
               effective_merchant_percent=effective_merchant_percent,
               HTTPException=HttpError, ObjectId=lambda value: value)
    env.update(values)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(path), "exec"), env)
    return env


def collection(document=None):
    return SimpleNamespace(find_one=AsyncMock(return_value=document),
                           update_one=AsyncMock(), insert_one=AsyncMock(return_value=SimpleNamespace(inserted_id="txn")))


class MerchantCommissionTests(unittest.IsolatedAsyncioTestCase):
    def pos(self, config=None):
        db = SimpleNamespace(fee_config=collection(config))
        env = load_functions("routes/pos_payments.py", {
            "DEFAULT_FEES", "FEE_LABELS", "ULTRA_FAST_LIMIT", "get_fee_rates",
            "detect_payment_type", "generate_receipt", "get_pricing", "set_admin_fees",
            "process_barcode_payment",
        }, db=db)
        return env, db

    def test_floor_and_higher_rates(self):
        for value in (0, 0.003, 0.005, 0.0149, None, "bad", float("nan"), float("inf")):
            self.assertEqual(effective_merchant_rate(value), 0.015)
        for value in (0.015, 0.02, 0.025, 0.03):
            self.assertEqual(effective_merchant_rate(value), value)
        self.assertEqual(effective_merchant_percent(0.5), 1.5)
        self.assertEqual(effective_merchant_percent(3), 3)

    async def test_defaults_and_legacy_config_share_public_pricing(self):
        for config in (None, {"wallet": 0.005, "barcode": 0.005, "nfc_wallet": 0.003, "card": 0.03}):
            env, db = self.pos(config)
            rates = await env["get_fee_rates"]()
            for method in ("wallet", "barcode", "nfc_wallet"):
                self.assertEqual(rates[method], 0.015)
            self.assertEqual(rates["card"], 0.03 if config else 0.025)
            pricing = await env["get_pricing"]()
            for method, fee in pricing["fee_structure"].items():
                self.assertAlmostEqual(fee["rate"], rates[method] * 100)
            self.assertIn("1.5% fee", pricing["plans"][0]["features"][0])
            db.fee_config.update_one.assert_not_awaited()

    async def test_admin_rejects_low_and_nonfinite_rates_without_writes(self):
        env, db = self.pos()
        env["get_current_user"] = AsyncMock(return_value={"role": "admin"})
        for value in (0.3, 1.49, "NaN", "Infinity", None, "bad"):
            request = SimpleNamespace(json=AsyncMock(return_value={"fees": {"wallet": value}}))
            with self.assertRaises(HttpError) as caught:
                await env["set_admin_fees"](request)
            self.assertEqual(caught.exception.status_code, 400)
        db.fee_config.update_one.assert_not_awaited()
        await env["set_admin_fees"](SimpleNamespace(json=AsyncMock(return_value={"fees": {"wallet": 1.5}})))
        self.assertEqual(db.fee_config.update_one.await_args.args[1]["$set"]["wallet"], 0.015)

    async def test_merchant_pays_fee_customer_pays_only_purchase_amount(self):
        env, db = self.pos({"barcode": 0.005})
        merchant = {"_id": "merchant-profile", "user_id": "merchant", "business_name": "Shop"}
        customer = {"_id": "customer", "balance": 200, "name": "Customer"}
        db.merchant_profiles = collection(merchant)
        db.payment_barcodes = collection({"_id": "barcode", "user_id": "customer", "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()})
        db.users = collection(customer)
        db.merchants = collection()
        db.merchant_transactions = collection()
        env["get_current_user"] = AsyncMock(return_value={"_id": "merchant", "role": "merchant"})
        env["debit_wallet"] = AsyncMock(return_value=SimpleNamespace(success=True, transaction_id="txn"))
        env["_credit_merchant_wallet"] = AsyncMock(return_value=SimpleNamespace(success=True))
        env["TransactionType"] = SimpleNamespace(PAYMENT="payment")
        # Prevent the optional receipt-email import from contacting any service.
        from unittest.mock import patch
        email_stub = SimpleNamespace(send_receipt_email=lambda **kwargs: None)
        req = SimpleNamespace(amount=100.0, barcode="test", payment_method="barcode", description="Test")
        with patch.dict(sys.modules, {"core.email": email_stub}):
            result = await env["process_barcode_payment"](req, None)
        self.assertEqual(env["debit_wallet"].await_args.kwargs["amount"], 100)
        self.assertEqual(env["_credit_merchant_wallet"].await_args.args[1], 98.5)
        self.assertEqual((result["fee"], result["net"]), (1.5, 98.5))
        self.assertEqual(result["receipt"]["fee_rate"], 1.5)
        self.assertEqual(db.merchant_transactions.insert_one.await_args.args[0]["fee"], 1.5)

    async def test_hierarchy_applies_floor_to_legacy_profile_and_keeps_higher_rate(self):
        for configured, expected in ((0.5, 1.5), (1.5, 1.5), (3, 3)):
            db = SimpleNamespace(
                merchant_registers=collection({"merchant_id": "m", "branch_id": "b", "device_id": "d"}),
                merchant_profiles=collection({"commission_rate": configured}),
                merchant_transactions=collection(), merchant_branches=collection(),
            )
            env = load_functions("routes/merchant_hierarchy.py", {"DEFAULT_COMMISSION", "process_pos_payment"}, db=db)
            request = SimpleNamespace(headers={"X-API-Key": "test"}, json=AsyncMock(return_value={"amount": 100}))
            result = await env["process_pos_payment"](request)
            self.assertEqual(result["fee"], expected)
            self.assertEqual(result["net"], 100 - expected)
            self.assertNotIn("commission_rate", db.merchant_profiles.update_one.await_args.args[1].get("$set", {}))

    async def test_central_engine_floors_only_merchant_commission(self):
        db = SimpleNamespace(platform_config=collection({"rates": {"merchant": 0.005, "subscription": 0, "taxi": 0.20}}))
        env = load_functions("core/payment_engine.py", {"DEFAULT_COMMISSIONS", "get_commission_rate", "admin_get_commission_rates"}, db=db)
        self.assertEqual(await env["get_commission_rate"]("merchant"), 0.015)
        self.assertEqual(await env["get_commission_rate"]("subscription"), 0)
        self.assertEqual(await env["get_commission_rate"]("taxi"), 0.20)
        self.assertEqual((await env["admin_get_commission_rates"]())["merchant"], 0.015)


if __name__ == "__main__":
    unittest.main()
