import os
import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_finance import FeeOwner, MerchantRole
from services.fuel_provider_contracts import (
    ProviderCommercialTerms, ProviderContractConfig, ProviderContractState,
    RevenueModel, unsigned_template,
)
from services.fuel_runtime_persistence import persistence_enabled


class TestFuelProviderContracts(unittest.TestCase):
    def test_unsigned_template_is_blocked(self):
        cfg = unsigned_template("dkv")
        self.assertFalse(cfg.discovery_ready)
        self.assertFalse(cfg.fueling_ready)

    def test_signed_contract_requires_reference(self):
        with self.assertRaises(ValueError):
            ProviderContractConfig(provider="x", state=ProviderContractState.SIGNED)

    def test_full_rights_can_be_ready(self):
        cfg = ProviderContractConfig(
            provider="provider-x",
            state=ProviderContractState.SIGNED,
            territories=frozenset({"DE"}),
            station_discovery_rights=True,
            fueling_rights=True,
            white_label_rights=True,
            api_rights=True,
            payment_rights=True,
            split_settlement_rights=True,
            receipt_responsibility_confirmed=True,
            commercial_terms=ProviderCommercialTerms(
                revenue_model=RevenueModel.PERCENTAGE,
                percentage=Decimal("5"),
                payment_fee_owner=FeeOwner.OPERATOR,
                merchant_of_record=MerchantRole.OPERATOR,
                supplier_of_record=MerchantRole.OPERATOR,
            ),
            contract_reference="contract-123",
        )
        self.assertTrue(cfg.discovery_ready)
        self.assertTrue(cfg.fueling_ready)
        self.assertEqual(cfg.payload()["commercial"]["percentage"], "5")

    def test_invalid_territory_rejected(self):
        with self.assertRaises(ValueError):
            ProviderContractConfig(provider="x", territories=frozenset({"de"}))


class TestFuelRuntimePersistenceFlag(unittest.TestCase):
    def test_persistence_off_by_default(self):
        old = os.environ.pop("FUEL_DEV_PERSISTENCE", None)
        try:
            self.assertFalse(persistence_enabled())
        finally:
            if old is not None:
                os.environ["FUEL_DEV_PERSISTENCE"] = old

    def test_persistence_can_be_enabled_explicitly(self):
        old = os.environ.get("FUEL_DEV_PERSISTENCE")
        os.environ["FUEL_DEV_PERSISTENCE"] = "true"
        try:
            self.assertTrue(persistence_enabled())
        finally:
            if old is None:
                os.environ.pop("FUEL_DEV_PERSISTENCE", None)
            else:
                os.environ["FUEL_DEV_PERSISTENCE"] = old


if __name__ == "__main__":
    unittest.main()
