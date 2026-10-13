"""Admin endpoint for read-only discovery preflight, no database or network required."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class FakeCollection:
    doc = None

    async def find_one(self, query, projection=None):
        return self.doc


def make_app():
    security = types.ModuleType("core.security")

    async def user_from_header(request):
        return {"role": request.headers.get("x-test-role", "guest")}

    security.get_current_user = user_from_header
    database = types.ModuleType("core.database")
    database.db = types.SimpleNamespace(fuel_provider_contracts=FakeCollection())
    spec = importlib.util.spec_from_file_location(
        "_fuel_preflight_api_isolated",
        ROOT / "routes" / "fuel_admin_config.py",
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"core.security": security, "core.database": database}):
        spec.loader.exec_module(module)
    app = FastAPI()
    app.include_router(module.router)
    return app


class TestFuelDiscoveryPreviewAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(make_app())
        cls.url = "/api/fuel/admin-config/providers/pace/discovery-preview"

    def tearDown(self):
        FakeCollection.doc = None

    def test_non_admin_blocked_before_database(self):
        response = self.client.get(self.url, headers={"x-test-role": "customer"})
        self.assertEqual(response.status_code, 403)

    def test_unknown_provider_rejected(self):
        response = self.client.get(
            "/api/fuel/admin-config/providers/unknown/discovery-preview",
            headers={"x-test-role": "admin"},
        )
        self.assertEqual(response.status_code, 404)

    def test_default_draft_is_blocked_with_no_network_calls(self):
        response = self.client.get(self.url, headers={"x-test-role": "admin"})
        self.assertEqual(response.status_code, 200)
        data = response.json()["preflight"]
        self.assertEqual(data["country"], "DE")
        self.assertFalse(data["discovery_conditions_met"])
        self.assertFalse(data["external_request_executed"])
        self.assertFalse(data["payments_enabled"])
        self.assertFalse(data["network_discovery_enabled"])

    def test_signed_document_still_needs_partner_confirmation(self):
        FakeCollection.doc = {
            "provider": "pace", "state": "signed", "territories": ["DE"],
            "rights": {"api": True, "station_discovery": True},
            "commercial": {}, "contract_reference": "c-001",
            "effective_from": "2026-01-01", "effective_until": "2027-01-01",
        }
        response = self.client.get(self.url, headers={"x-test-role": "admin"})
        self.assertEqual(response.status_code, 200)
        data = response.json()["preflight"]
        self.assertFalse(data["discovery_conditions_met"])
        self.assertIn("provider_api_confirmed", data["missing"])

    def test_invalid_country_and_bad_contract_flags_rejected(self):
        bad_country = self.client.get(
            self.url + "?country=de", headers={"x-test-role": "admin"},
        )
        self.assertEqual(bad_country.status_code, 422)
        FakeCollection.doc = {
            "provider": "pace", "state": "draft",
            "rights": {"station_discovery": "false"},
        }
        bad_contract = self.client.get(self.url, headers={"x-test-role": "admin"})
        self.assertEqual(bad_contract.status_code, 422)
        self.assertNotIn("station_discovery", bad_contract.text)


if __name__ == "__main__":
    unittest.main()
