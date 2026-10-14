import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.dkv_enterprise import (
    CAPABILITY_STATUS, CONFIRMED_DATASETS, PROFILE,
    DkvCustomerTenant, DkvDataset, DkvEnterpriseAccessBlocked,
    DkvEnterpriseClientStub, DkvOnboardingState,
)


class TestDkvEnterpriseV1(unittest.IsolatedAsyncioTestCase):
    async def test_confirmed_profile_matches_received_offer(self):
        self.assertEqual(PROFILE.monthly_price_eur, "69.90")
        self.assertTrue(PROFILE.rest_json)
        self.assertFalse(PROFILE.public_sandbox_available)
        self.assertTrue(PROFILE.direct_production_after_onboarding)
        self.assertTrue(PROFILE.supports_multi_customer_platform)
        self.assertTrue(PROFILE.customer_specific_authorization)
        self.assertEqual(len(CONFIRMED_DATASETS), 6)

    async def test_unonboarded_customer_cannot_call(self):
        tenant = DkvCustomerTenant(
            customer_id="customer-1",
            enabled_datasets=frozenset({DkvDataset.INVOICE_DATA}),
        )
        self.assertFalse(tenant.can_call_enterprise_api)
        with self.assertRaises(DkvEnterpriseAccessBlocked):
            await DkvEnterpriseClientStub(tenant).fetch(DkvDataset.INVOICE_DATA)

    async def test_active_customer_requires_technical_user_and_approval(self):
        with self.assertRaises(ValueError):
            DkvCustomerTenant(
                customer_id="customer-1",
                state=DkvOnboardingState.ACTIVE,
                enabled_datasets=frozenset({DkvDataset.INVOICE_DATA}),
                production_access_approved=True,
                technical_user_configured=False,
            )
        with self.assertRaises(ValueError):
            DkvCustomerTenant(
                customer_id="customer-1",
                state=DkvOnboardingState.ACTIVE,
                enabled_datasets=frozenset({DkvDataset.INVOICE_DATA}),
                production_access_approved=False,
                technical_user_configured=True,
            )

    async def test_customer_specific_permissions(self):
        tenant = DkvCustomerTenant(
            customer_id="customer-1",
            state=DkvOnboardingState.ACTIVE,
            enabled_datasets=frozenset({
                DkvDataset.INVOICE_DATA,
                DkvDataset.CONSUMPTION_DATA,
            }),
            production_access_approved=True,
            technical_user_configured=True,
        )
        self.assertTrue(tenant.permits(DkvDataset.INVOICE_DATA))
        self.assertFalse(tenant.permits(DkvDataset.SERVICE_CARD_MASTER_DATA))
        with self.assertRaises(DkvEnterpriseAccessBlocked):
            await DkvEnterpriseClientStub(tenant).fetch(DkvDataset.SERVICE_CARD_MASTER_DATA)
        with self.assertRaises(DkvEnterpriseAccessBlocked) as ctx:
            await DkvEnterpriseClientStub(tenant).fetch(DkvDataset.INVOICE_DATA)
        self.assertIn("production call intentionally not implemented", str(ctx.exception))

    async def test_fueling_capabilities_are_not_claimed(self):
        self.assertEqual(CAPABILITY_STATUS.enterprise_data_api, "confirmed")
        self.assertEqual(CAPABILITY_STATUS.pay_at_pump_api, "not_confirmed")
        self.assertEqual(CAPABILITY_STATUS.revenue_share, "not_confirmed")
        self.assertEqual(CAPABILITY_STATUS.split_settlement, "not_confirmed")


if __name__ == "__main__":
    unittest.main()
