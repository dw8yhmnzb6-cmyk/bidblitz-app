import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_provider_activation import credential_readiness_flag, evaluate_provider_activation
from services.fuel_provider_contracts import ProviderContractConfig, ProviderContractState
from services.fuel_provider_onboarding import ProviderOnboarding, OnboardingStage


class TestFuelProviderActivation(unittest.TestCase):
    def full_onboarding(self):
        return ProviderOnboarding(
            provider="x",
            stage=OnboardingStage.PRODUCTION_REVIEW,
            api_confirmed=True,
            station_discovery_confirmed=True,
            fueling_confirmed=True,
            payment_confirmed=True,
            split_settlement_confirmed=True,
            contract_signed=True,
            credentials_configured=True,
        )

    def full_contract(self):
        return ProviderContractConfig(
            provider="x",
            state=ProviderContractState.SIGNED,
            territories=frozenset({"DE"}),
            station_discovery_rights=True,
            fueling_rights=True,
            api_rights=True,
            payment_rights=True,
            split_settlement_rights=True,
            receipt_responsibility_confirmed=True,
            contract_reference="c-1",
        )

    def test_all_gates_ready(self):
        status = evaluate_provider_activation(self.full_onboarding(), self.full_contract(), credentials_ready=True)
        self.assertTrue(status.discovery_ready)
        self.assertTrue(status.fueling_ready)
        self.assertEqual(status.missing_discovery, ())
        self.assertEqual(status.missing_fueling, ())

    def test_missing_credentials_blocks_both(self):
        status = evaluate_provider_activation(self.full_onboarding(), self.full_contract(), credentials_ready=False)
        self.assertFalse(status.discovery_ready)
        self.assertFalse(status.fueling_ready)
        self.assertIn("credentials_configured", status.missing_discovery)

    def test_dkv_style_data_only_stays_blocked_for_fueling(self):
        onboarding = ProviderOnboarding(
            provider="dkv",
            stage=OnboardingStage.RESPONSE_RECEIVED,
            api_confirmed=True,
        )
        contract = ProviderContractConfig(provider="dkv")
        status = evaluate_provider_activation(onboarding, contract, credentials_ready=False)
        self.assertFalse(status.discovery_ready)
        self.assertFalse(status.fueling_ready)
        self.assertIn("provider_station_discovery_confirmed", status.missing_discovery)
        self.assertIn("provider_fueling_confirmed", status.missing_fueling)

    def test_credential_flag_is_non_secret_boolean(self):
        old = os.environ.get("FUEL_X_CREDENTIALS_CONFIGURED")
        os.environ["FUEL_X_CREDENTIALS_CONFIGURED"] = "true"
        try:
            self.assertTrue(credential_readiness_flag("x"))
        finally:
            if old is None:
                os.environ.pop("FUEL_X_CREDENTIALS_CONFIGURED", None)
            else:
                os.environ["FUEL_X_CREDENTIALS_CONFIGURED"] = old


if __name__ == "__main__":
    unittest.main()
