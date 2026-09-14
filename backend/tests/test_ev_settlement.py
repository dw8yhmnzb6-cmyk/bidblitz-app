"""EV settlement retries must never move money or issue receipts twice."""
import asyncio

import pytest

from core import payment_engine as engine
from routes import ev_charging as ev
from services import ocpp_csms, ocpp_v201
from money_path_test_support import FailOnceCollection, OverrideDB, run_money_scenario


async def seed(db, *, operator=True, balance=100.0):
    await db.users.insert_many([
        {"_id": "customer", "balance": balance},
        {"_id": "operator", "balance": 0.0},
        {"_id": "pool", "email": "admin@bidblitz.ae", "balance": 0.0},
        {"_id": "other", "balance": 0.0},
    ])
    await db.ev_charge_points.insert_one({
        "charge_point_id": "cp", "operator_user_id": "operator" if operator else None,
    })
    await db.ev_charging_sessions.insert_one({
        "session_id": "session", "charge_point_id": "cp", "connector_id": 1,
        "user_id": "customer", "id_tag": "tag", "status": "stopping",
        "ocpp_transaction_id": 7, "meter_start_wh": 1000,
        "kwh_charged": 10.0, "tariff": {"price_per_kwh": 0.5, "currency": "EUR"},
        "started_at": "2026-01-01T10:00:00+00:00",
        "stopped_at": "2026-01-01T11:00:00+00:00",
    })
    await db.ev_authorizations.insert_one({"id_tag": "tag", "active": True})


async def balances(db):
    return {d["_id"]: round(d["balance"], 2) for d in await db.users.find({}).to_list(20)}


def run(monkeypatch, scenario):
    monkeypatch.delenv("PLATFORM_POOL_EMAIL", raising=False)
    run_money_scenario(monkeypatch, scenario, ev, ocpp_csms, ocpp_v201)


def test_parallel_settlement_has_one_charge_commission_and_receipt(monkeypatch):
    async def scenario(db):
        await seed(db)
        await asyncio.gather(*(ev.finalize_session("session") for _ in range(8)))
        await ev.finalize_session("session")
        assert await balances(db) == {"customer": 95.0, "operator": 4.4, "pool": 0.6, "other": 0.0}
        assert await db.transactions.count_documents({}) == 4
        assert await db.wallet_ledger_entries.count_documents({}) == 4
        assert await db.ev_receipts.count_documents({}) == 1
        assert await db.ev_operator_commissions.count_documents({}) == 1
        assert (await db.ev_charging_sessions.find_one({}))["settlement_status"] == "completed"
    run(monkeypatch, scenario)


@pytest.mark.parametrize("operator,collection", [
    (False, "ev_receipts"), (True, "ev_receipts"), (True, "ev_operator_commissions"),
])
def test_persistence_outage_replays_frozen_terms_without_another_charge(monkeypatch, operator, collection):
    async def scenario(db):
        await seed(db, operator=operator)
        monkeypatch.setattr(ev, "db", OverrideDB(db, **{
            collection: FailOnceCollection(getattr(db, collection)),
        }))
        with pytest.raises(RuntimeError, match="injected"):
            await ev.finalize_session("session")
        assert await db.ev_receipts.count_documents({}) == 0
        await db.ev_charge_points.update_one({}, {"$set": {"operator_user_id": "other", "commission_pct_override": 90}})
        await db.ev_charging_sessions.update_one({}, {"$set": {"kwh_charged": 90, "tariff.price_per_kwh": 3}})
        await ev.finalize_session("session")
        assert (await balances(db))["customer"] == 95.0
        assert (await balances(db))["other"] == 0
        assert await db.ev_receipts.count_documents({}) == 1
        receipt = await db.ev_receipts.find_one({})
        assert receipt["total_amount"] == 5.0
        assert receipt["platform_fee"] == (0.6 if operator else 5.0)
        assert receipt["operator_share"] == (4.4 if operator else 0)
        assert await db.transactions.count_documents({}) == (4 if operator else 1)
    run(monkeypatch, scenario)


def test_incomplete_commission_does_not_issue_receipt_or_recharge_customer(monkeypatch):
    async def scenario(db):
        await seed(db)
        transfer = ev.transfer_between_wallets
        async def incomplete(**kwargs):
            if kwargs["tx_type"] == engine.TransactionType.EV_CHARGING_REVENUE:
                return engine.PaymentResult(success=False, status=engine.TransactionStatus.RECONCILIATION_REQUIRED)
            return await transfer(**kwargs)
        monkeypatch.setattr(ev, "transfer_between_wallets", incomplete)
        await ev.finalize_session("session")
        assert await db.ev_receipts.count_documents({}) == 0
        assert (await db.ev_charging_sessions.find_one({}))["status"] == "settle_failed"
        assert (await balances(db))["customer"] == 95.0
        monkeypatch.setattr(ev, "transfer_between_wallets", transfer)
        await ev.finalize_session("session")
        assert (await balances(db))["customer"] == 95.0
        assert (await balances(db))["pool"] == 0.6
        assert await db.ev_receipts.count_documents({}) == 1
    run(monkeypatch, scenario)


@pytest.mark.parametrize("case", ["insufficient", "missing_owner", "missing_pool", "nan", "negative_tariff", "legacy_transfer"])
def test_unverified_or_failed_settlement_has_no_receipt(monkeypatch, case):
    async def scenario(db):
        await seed(db, balance=0 if case == "insufficient" else 100)
        if case == "missing_owner":
            await db.ev_charging_sessions.update_one({}, {"$set": {"user_id": None}})
        elif case == "missing_pool":
            await db.users.delete_one({"_id": "pool"})
        elif case in {"nan", "negative_tariff"}:
            await db.ev_charging_sessions.update_one({}, {"$set": {
                "tariff.price_per_kwh": float("nan") if case == "nan" else -1,
            }})
        elif case == "legacy_transfer":
            await db.transactions.insert_one({"metadata": {"session_id": "session"}, "status": "completed"})
        before = await balances(db)
        await ev.finalize_session("session")
        await ev.finalize_session("session")
        assert await balances(db) == before
        assert await db.ev_receipts.count_documents({}) == 0
        assert (await db.ev_charging_sessions.find_one({}))["status"] == "settle_failed"
        assert not (await db.ev_authorizations.find_one({}))["active"]
    run(monkeypatch, scenario)


def test_previous_operatorless_debit_recovers_its_reference_and_receipt(monkeypatch):
    async def scenario(db):
        await seed(db, operator=False)
        result = await engine.debit_wallet(
            user_id="customer", amount=5, tx_type=engine.TransactionType.EV_CHARGING,
            description="previous version", reference="EV-OLD-REFERENCE",
            idempotency_key="ev:settlement:session",
        )
        assert result.success
        await db.ev_receipts.insert_one({"session_id": "session", "receipt_no": "EXISTING"})
        await ev.finalize_session("session")
        assert (await balances(db))["customer"] == 95.0
        assert await db.transactions.count_documents({}) == 1
        assert await db.ev_receipts.count_documents({}) == 1
        session = await db.ev_charging_sessions.find_one({})
        assert session["settlement_ref"] == "EV-OLD-REFERENCE"
        assert session["receipt_no"] == "EXISTING"
        assert session["status"] == "completed"
    run(monkeypatch, scenario)


@pytest.mark.parametrize("protocol", ["1.6", "2.0.1"])
def test_ocpp_final_meter_is_used_and_duplicate_end_cannot_reopen_session(monkeypatch, protocol):
    async def scenario(db):
        await seed(db, operator=False)
        await db.ev_charging_sessions.update_one({}, {"$set": {"status": "active", "kwh_charged": 0.2}})
        async def end(meter):
            if protocol == "1.6":
                return await ocpp_csms.handle_StopTransaction("cp", {
                    "transactionId": 7, "meterStop": meter, "timestamp": "2026-01-01T11:00:00Z",
                })
            return await ocpp_v201.handle_TransactionEvent("cp", {
                "eventType": "Ended", "seqNo": 2, "timestamp": "2026-01-01T11:00:00Z",
                "transactionInfo": {"transactionId": 7},
                "meterValue": [{"timestamp": "2026-01-01T11:00:00Z", "sampledValue": [{
                    "value": meter, "measurand": "Energy.Active.Import.Register",
                    "unitOfMeasure": {"unit": "Wh"},
                }]}],
            })
        await end(11000)
        before = await db.ev_charging_sessions.find_one({})
        assert before["final_cost"] == 5.0
        await end(21000)
        after = await db.ev_charging_sessions.find_one({})
        assert after == before
        assert (await balances(db))["customer"] == 95.0
        assert await db.ev_receipts.count_documents({}) == 1
    run(monkeypatch, scenario)


def test_ocpp16_transaction_is_scoped_to_the_reporting_charge_point(monkeypatch):
    async def scenario(db):
        await seed(db)
        before = await db.ev_charging_sessions.find_one({})
        await ocpp_csms.handle_StopTransaction("different-station", {"transactionId": 7, "meterStop": 11000})
        assert await db.ev_charging_sessions.find_one({}) == before
        assert await db.transactions.count_documents({}) == 0
    run(monkeypatch, scenario)
