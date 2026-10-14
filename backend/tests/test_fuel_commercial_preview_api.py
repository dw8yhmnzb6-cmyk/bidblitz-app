"""Contract and authentication boundaries for the Fuel quote endpoint.

Runs without a real database, credentials or payment providers.
"""
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


def build_isolated_app():
    fake_security = types.ModuleType("core.security")

    async def get_current_user(request):
        return {"role": request.headers.get("x-test-role", "guest")}

    fake_security.get_current_user = get_current_user
    spec = importlib.util.spec_from_file_location(
        "_fuel_commercial_preview_test_route",
        ROOT / "routes" / "fuel_commercial_preview.py",
    )
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"core.security": fake_security}):
        spec.loader.exec_module(module)
    app = FastAPI()
    app.include_router(module.router)
    return app


class TestFuelCommercialPreviewAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(build_isolated_app())
        cls.url = "/api/fuel/admin-config/commercial-preview"

    def test_non_admin_is_rejected(self):
        response = self.client.post(self.url, json={}, headers={"x-test-role": "customer"})
        self.assertEqual(response.status_code, 403)

    def test_admin_gets_read_only_comparison(self):
        response = self.client.post(
            self.url,
            json={"monthly_turnover": "100000", "percent_rate": "0.2", "cent_per_liter": "1"},
            headers={"x-test-role": "admin"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["payments_enabled"])
        self.assertEqual(payload["percentage_model"]["commission_before_cost"], "200.00")

    def test_network_portfolio_quote_remains_read_only(self):
        response = self.client.post(
            self.url,
            json={"monthly_turnover": "100000", "station_count": "100", "percent_rate": "0.2"},
            headers={"x-test-role": "admin"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertFalse(payload["payments_enabled"])
        self.assertEqual(payload["station_count"], 100)
        self.assertEqual(payload["portfolio_projection"]["monthly_turnover_gross"], "10000000.00")
        self.assertEqual(payload["portfolio_projection"]["percentage_model"]["monthly_commission_before_cost"], "20000.00")

    def test_noninteger_station_count_rejected(self):
        response = self.client.post(
            self.url, json={"station_count": "1.5"}, headers={"x-test-role": "admin"},
        )
        self.assertEqual(response.status_code, 422)

    def test_invalid_input_is_rejected(self):
        response = self.client.post(
            self.url,
            json={"monthly_turnover": "NaN"}, headers={"x-test-role": "admin"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
