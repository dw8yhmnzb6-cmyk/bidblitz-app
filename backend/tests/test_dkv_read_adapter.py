import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.dkv_enterprise import DkvCustomerTenant, DkvDataset, DkvOnboardingState
from services.dkv_read_adapter import (
    DkvReadExecutionBlocked, build_request_plan, execute_request_plan, normalize_rows,
)


class TestDkvReadAdapter(unittest.IsolatedAsyncioTestCase):
    def tenant(self):
        return DkvCustomerTenant(
            customer_id="customer-1",
            state=DkvOnboardingState.ACTIVE,
            enabled_datasets=frozenset({DkvDataset.INVOICE_DATA}),
            production_access_approved=True,
            technical_user_configured=True,
        )

    async def test_authorized_request_plan(self):
        plan = build_request_plan(self.tenant(), DkvDataset.INVOICE_DATA, query={"limit": 10})
        self.assertEqual(plan.method, "GET")
        self.assertEqual(plan.query["limit"], 10)

    async def test_secret_query_params_rejected(self):
        with self.assertRaises(ValueError):
            build_request_plan(self.tenant(), DkvDataset.INVOICE_DATA, query={"token": "secret"})

    async def test_unpermitted_dataset_blocked(self):
        with self.assertRaises(Exception):
            build_request_plan(self.tenant(), DkvDataset.CONSUMPTION_DATA)

    async def test_normalize_unknown_fields_without_semantic_assumptions(self):
        rows = normalize_rows(DkvDataset.INVOICE_DATA, {"items": [{"foo": "bar"}]})
        self.assertEqual(rows, [{"dataset": "invoice_data", "raw": {"foo": "bar"}}])

    async def test_execution_remains_blocked(self):
        plan = build_request_plan(self.tenant(), DkvDataset.INVOICE_DATA)
        with self.assertRaises(DkvReadExecutionBlocked):
            await execute_request_plan(plan)


if __name__ == "__main__":
    unittest.main()
