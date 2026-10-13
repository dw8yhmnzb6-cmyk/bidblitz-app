"""Fuel contract hardening and country discovery preflight (offline, no PSP)."""
import sys
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.fuel_discovery_preflight import discovery_preflight
from services.fuel_provider_contract_repository import contract_from_payload
from services.fuel_provider_contracts import (
    ProviderCommercialTerms, ProviderContractConfig, ProviderContractState,
)
from services.fuel_provider_onboarding import OnboardingStage, ProviderOnboarding


def approved_onboarding():
    return ProviderOnboarding(
        provider="pace", stage=OnboardingStage.PRODUCTION_REVIEW,
        api_confirmed=True, station_discovery_confirmed=True,
    )


def approved_contract(**overrides):
    fields = {
        "provider": "pace",
        "state": ProviderContractState.SIGNED,
        "contract_reference": "contract-test-123",
        "territories": frozenset({"DE", "AT"}),
        "api_rights": True,
        "station_discovery_rights": True,
        "effective_from": "2026-01-01",
        "effective_until": "2027-12-31",
    }
    fields.update(overrides)
    return ProviderContractConfig(**fields)


class TestDiscoveryPreflight(unittest.TestCase):
    def quote(self, contract=None, *, country="DE", credentials=True):
        return discovery_preflight(
            approved_onboarding(),
            contract or approved_contract(),
            country=country, credentials_ready=credentials,
            today=date(2026, 10, 13),
        )

    def test_valid_country_conditions_never_trigger_network(self):
        result = self.quote()
        self.assertTrue(result["discovery_conditions_met"])
        self.assertEqual(result["missing"], [])
        self.assertFalse(result["external_request_executed"])
        self.assertFalse(result["network_discovery_enabled"])
        self.assertFalse(result["payments_enabled"])
        self.assertFalse(result["pump_release_enabled"])

    def test_country_must_be_in_signed_territories(self):
        result = self.quote(country="FR")
        self.assertFalse(result["discovery_conditions_met"])
        self.assertIn("country_not_in_signed_territories", result["missing"])

    def test_no_contract_is_blocked(self):
        result = self.quote(ProviderContractConfig(provider="pace"))
        self.assertIn("signed_contract", result["missing"])
        self.assertIn("contract_effective_from_missing", result["missing"])

    def test_missing_credentials_is_blocked(self):
        result = self.quote(credentials=False)
        self.assertIn("credentials_configured", result["missing"])

    def test_future_contract_is_blocked(self):
        result = self.quote(approved_contract(effective_from="2026-11-01"))
        self.assertIn("contract_not_yet_effective", result["missing"])

    def test_expired_contract_is_blocked(self):
        result = self.quote(approved_contract(effective_until="2026-10-12"))
        self.assertIn("contract_expired", result["missing"])

    def test_invalid_contract_dates_fail_closed(self):
        bad_start = self.quote(approved_contract(effective_from="not-a-date"))
        self.assertIn("invalid_contract_effective_from", bad_start["missing"])
        bad_end = self.quote(approved_contract(effective_until="2026-99-01"))
        self.assertIn("invalid_contract_effective_until", bad_end["missing"])

    def test_reversed_date_window_blocked(self):
        result = self.quote(approved_contract(
            effective_from="2027-01-01", effective_until="2026-01-01",
        ))
        self.assertIn("contract_date_window_invalid", result["missing"])

    def test_non_uppercase_and_invalid_countries_rejected(self):
        for code in ("de", "DEU", "*", "", "D1", "DE FR"):
            with self.subTest(country=code), self.assertRaises(ValueError):
                self.quote(country=code)

    def test_provider_identity_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            self.quote(approved_contract(provider="dkv"))


class TestStrictFuelCommercialTerms(unittest.TestCase):
    def test_rights_strings_or_numeric_values_rejected(self):
        for value in ("false", "true", "0", 0, 1, None, [], {}):
            with self.subTest(value=value), self.assertRaises(ValueError):
                contract_from_payload("pace", {
                    "rights": {"api": value},
                })

    def test_explicit_false_right_is_not_granted(self):
        contract = contract_from_payload(
            "pace", {"rights": {"api": False, "payment": False}}
        )
        self.assertFalse(contract.api_rights)
        self.assertFalse(contract.payment_rights)

    def test_nan_and_infinity_commercial_terms_rejected(self):
        for field in ("percentage", "per_liter", "per_transaction", "monthly_fee"):
            for value in ("NaN", "Infinity", "-Infinity"):
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    ProviderCommercialTerms(**{field: Decimal(value)})

    def test_malformed_rate_rejected_without_decimal_exception(self):
        for bad_value in ("garbage", "NaN", "Infinity"):
            with self.subTest(value=bad_value), self.assertRaises(ValueError):
                contract_from_payload("pace", {"commercial": {"per_liter": bad_value}})

    def test_secret_key_variants_are_rejected(self):
        for key in ("client-secret", "API KEY", "bearer-token", "secret key"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                contract_from_payload("pace", {"commercial": {"audit": {key: "dummy"}}})


if __name__ == "__main__":
    unittest.main()
