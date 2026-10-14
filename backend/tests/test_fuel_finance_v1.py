import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_core import CommissionRule, CommissionType
from services.fuel_finance import (
    FeeOwner, MerchantRole, OperatorContract, ReconciliationRecord,
    allocate_transaction,
)


class TestFuelFinanceV1(unittest.TestCase):
    def contract(self, **overrides):
        args = dict(
            operator_id="op-1",
            commission_rule=CommissionRule(CommissionType.PERCENTAGE, percentage=Decimal("5")),
            merchant_of_record=MerchantRole.OPERATOR,
            supplier_of_record=MerchantRole.OPERATOR,
            payment_fee_owner=FeeOwner.OPERATOR,
            signed=True,
            settlement_enabled=True,
        )
        args.update(overrides)
        return OperatorContract(**args)

    def test_operator_fee_model(self):
        allocation = allocate_transaction(
            contract=self.contract(),
            gross_amount="100",
            liters="50",
            payment_fee="1.20",
        )
        self.assertEqual(allocation.bidblitz_commission, Decimal("5.00"))
        self.assertEqual(allocation.operator_amount, Decimal("93.80"))
        self.assertEqual(allocation.payment_fee, Decimal("1.20"))

    def test_bidblitz_fee_model(self):
        allocation = allocate_transaction(
            contract=self.contract(payment_fee_owner=FeeOwner.BIDBLITZ),
            gross_amount="100",
            liters="50",
            payment_fee="1.20",
        )
        self.assertEqual(allocation.bidblitz_commission, Decimal("3.80"))
        self.assertEqual(allocation.operator_amount, Decimal("95.00"))

    def test_unsigned_contract_fails_closed(self):
        with self.assertRaises(ValueError):
            OperatorContract(
                operator_id="op-1",
                commission_rule=CommissionRule(CommissionType.PERCENTAGE, percentage=Decimal("5")),
                settlement_enabled=True,
            )

    def test_settlement_disabled_fails_closed(self):
        contract = self.contract(settlement_enabled=False)
        with self.assertRaises(ValueError):
            allocate_transaction(contract=contract, gross_amount="100", liters="20", payment_fee="1")

    def test_payment_fee_cannot_exceed_bidblitz_share(self):
        with self.assertRaises(ValueError):
            allocate_transaction(
                contract=self.contract(payment_fee_owner=FeeOwner.BIDBLITZ),
                gross_amount="100",
                liters="50",
                payment_fee="7",
            )

    def test_reconciliation(self):
        ok = ReconciliationRecord("tx-1", Decimal("100"), Decimal("100"), Decimal("100"))
        self.assertTrue(ok.balanced)
        self.assertEqual(ok.difference, Decimal("0.00"))
        bad = ReconciliationRecord("tx-2", Decimal("100"), Decimal("98.50"), Decimal("100"))
        self.assertFalse(bad.balanced)
        self.assertEqual(bad.difference, Decimal("1.50"))


if __name__ == "__main__":
    unittest.main()
