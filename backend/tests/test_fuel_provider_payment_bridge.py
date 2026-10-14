import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_payment_bridge import (
    FuelPaymentBlocked, FuelPaymentMode, FuelPaymentReleaseGate,
    assert_payment_mode_allowed, build_payment_intent, to_bidblitz_pay_request,
)
from services.fuel_provider_onboarding import OnboardingStage, provider_by_name, provider_matrix


class TestFuelProviderOnboarding(unittest.TestCase):
    def test_dkv_response_is_recorded_without_overclaiming(self):
        dkv = provider_by_name("dkv")
        self.assertIsNotNone(dkv)
        self.assertEqual(dkv.stage, OnboardingStage.RESPONSE_RECEIVED)
        self.assertTrue(dkv.api_confirmed)
        self.assertFalse(dkv.fueling_confirmed)
        self.assertFalse(dkv.revenue_share_confirmed)
        self.assertFalse(dkv.can_enable_fueling)

    def test_matrix_contains_multiple_provider_tracks(self):
        names = {item.provider for item in provider_matrix()}
        self.assertTrue({"dkv", "pace", "huth", "hectronic", "dfs_tokheim"}.issubset(names))


class TestFuelPaymentBridge(unittest.TestCase):
    def test_deterministic_idempotency(self):
        a = build_payment_intent(
            fuel_session_id="s1", station_id="st1", operator_id="op1", amount="100", mode=FuelPaymentMode.MOCK
        )
        b = build_payment_intent(
            fuel_session_id="s1", station_id="st1", operator_id="op1", amount="100", mode=FuelPaymentMode.MOCK
        )
        self.assertEqual(a.idempotency_key, b.idempotency_key)
        self.assertEqual(a.amount, Decimal("100.00"))

    def test_live_mode_requires_all_gates(self):
        gate = FuelPaymentReleaseGate()
        with self.assertRaises(FuelPaymentBlocked):
            assert_payment_mode_allowed(FuelPaymentMode.LIVE, gate)
        ready = FuelPaymentReleaseGate(
            provider_contract_signed=True,
            provider_payment_approved=True,
            psp_approved=True,
            split_settlement_approved=True,
            merchant_role_confirmed=True,
            reconciliation_ready=True,
            webhooks_verified=True,
        )
        assert_payment_mode_allowed(FuelPaymentMode.LIVE, ready)

    def test_disabled_mode_always_blocks(self):
        with self.assertRaises(FuelPaymentBlocked):
            assert_payment_mode_allowed(FuelPaymentMode.DISABLED, FuelPaymentReleaseGate())

    def test_bidblitz_pay_payload_is_fuel_scoped(self):
        intent = build_payment_intent(
            fuel_session_id="s1", station_id="st1", operator_id="op1", amount="52.34", mode=FuelPaymentMode.MOCK
        )
        payload = to_bidblitz_pay_request(
            intent,
            success_url="https://fuel.example/success",
            cancel_url="https://fuel.example/cancel",
            webhook_url="https://fuel.example/webhook",
        )
        self.assertEqual(payload["metadata"]["product"], "fuel")
        self.assertEqual(payload["metadata"]["fuel_session_id"], "s1")
        self.assertEqual(payload["amount"], 52.34)


if __name__ == "__main__":
    unittest.main()
