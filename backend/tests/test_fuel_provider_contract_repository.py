import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_provider_contract_repository import (
    contract_from_payload, _reject_sensitive,
)


class TestFuelProviderContractRepositoryParsing(unittest.TestCase):
    def test_draft_payload_parses(self):
        cfg = contract_from_payload("dkv", {
            "state": "draft",
            "territories": [],
            "rights": {"api": True},
            "commercial": {
                "revenue_model": "none",
                "payment_fee_owner": "operator",
                "merchant_of_record": "operator",
                "supplier_of_record": "operator",
                "currency": "EUR",
            },
        })
        self.assertEqual(cfg.provider, "dkv")
        self.assertTrue(cfg.api_rights)
        self.assertFalse(cfg.discovery_ready)

    def test_signed_payload_requires_reference(self):
        with self.assertRaises(ValueError):
            contract_from_payload("x", {"state": "signed"})

    def test_sensitive_keys_rejected(self):
        with self.assertRaises(ValueError):
            _reject_sensitive({"nested": {"api_key": "secret"}})

    def test_ready_contract_parses(self):
        cfg = contract_from_payload("x", {
            "state": "signed",
            "territories": ["DE"],
            "rights": {
                "api": True,
                "station_discovery": True,
                "fueling": True,
                "payment": True,
                "split_settlement": True,
                "receipt_responsibility_confirmed": True,
            },
            "commercial": {
                "revenue_model": "percentage",
                "percentage": "5",
                "payment_fee_owner": "operator",
                "merchant_of_record": "operator",
                "supplier_of_record": "operator",
                "currency": "EUR",
            },
            "contract_reference": "signed-001",
        })
        self.assertTrue(cfg.discovery_ready)
        self.assertTrue(cfg.fueling_ready)


if __name__ == "__main__":
    unittest.main()
