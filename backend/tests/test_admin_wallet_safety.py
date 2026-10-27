"""Behavior regressions for admin money operations, using an isolated fake DB."""
import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from starlette.requests import Request

from core import canonical_wallet_service as canonical, payment_engine as engine
from routes import admin_wallet as admin_wallet
from test_wallet_reconciliation import FakeCollection, FakeDB


def run(coro):
    return asyncio.run(coro)


@pytest.mark.parametrize("operation", ["credit", "debit"])
def test_payment_engine_retry_without_reference_replays_same_transaction(monkeypatch, operation):
    db = FakeDB([{"_id": "customer", "balance": 100.0}], ledger_mode="ok")
    monkeypatch.setattr(canonical, "db", db)
    kwargs = dict(user_id="customer", amount=10, tx_type=engine.TransactionType.ADMIN_CREDIT,
                  description="Manual adjustment", idempotency_key="same-client-request")
    fn = engine.credit_wallet if operation == "credit" else engine.debit_wallet
    first = run(fn(**kwargs))
    second = run(fn(**kwargs))
    assert first.success and second.success
    assert first.transaction_id == second.transaction_id
    assert len(db.transactions.docs) == 1
    assert len(db.wallet_ledger_entries.docs) == 2
    assert db.users.docs[0]["balance"] == (110 if operation == "credit" else 90)


def matches(doc, query):
    for key, expected in query.items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, value in expected.items():
                if op == '$ne' and (value in actual if isinstance(actual, list) else actual == value):
                    return False
                if op == '$gte' and (actual is None or actual < value):
                    return False
                if op == '$gt' and (actual is None or actual <= value):
                    return False
                if op == '$lt' and (actual is None or actual >= value):
                    return False
                if op == '$in' and actual not in value:
                    return False
        elif isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


class Crash(BaseException):
    pass


class MemoryCollection(FakeCollection):
    fail_after_balance = False
    fail_before_balance = False
    fail_complete = False

    async def find_one(self, query, projection=None):
        await asyncio.sleep(0)
        for doc in self.docs:
            if matches(doc, query):
                result = copy.deepcopy(doc)
                if projection and projection.get('_id') == 0:
                    result.pop('_id', None)
                return result
        return None

    async def insert_one(self, doc):
        from pymongo.errors import DuplicateKeyError
        await asyncio.sleep(0)
        for existing in self.docs:
            for key in ('_id', 'idempotency_key'):
                if key in doc and existing.get(key) == doc[key]:
                    raise DuplicateKeyError('duplicate operation')
        return await super().insert_one(doc)

    async def update_one(self, query, update, upsert=False):
        await asyncio.sleep(0)
        if self.fail_before_balance and 'balance_blz' in update.get('$inc', {}):
            self.fail_before_balance = False
            raise Crash('crash before balance write')
        if self.fail_complete and update.get('$set', {}).get('status') == 'completed':
            self.fail_complete = False
            raise Crash('crash before completion write')
        for doc in self.docs:
            if not matches(doc, query):
                continue
            before = copy.deepcopy(doc)
            self._apply_update(doc, update)
            if self.fail_after_balance and 'balance_blz' in update.get('$inc', {}):
                self.fail_after_balance = False
                raise Crash('balance written, response lost')
            return SimpleNamespace(modified_count=int(doc != before), matched_count=1)
        if upsert:
            doc = {**copy.deepcopy(query), **copy.deepcopy(update.get('$setOnInsert', {}))}
            self._apply_update(doc, update)
            self.docs.append(doc)
            return SimpleNamespace(modified_count=0, matched_count=0, upserted_id=doc.get('_id'))
        return SimpleNamespace(modified_count=0, matched_count=0)

    async def find_one_and_update(self, query, update, return_document=None):
        await asyncio.sleep(0)
        for doc in self.docs:
            if matches(doc, query):
                self._apply_update(doc, update)
                return copy.deepcopy(doc)
        return None

    async def delete_one(self, query):
        await asyncio.sleep(0)
        for i, doc in enumerate(self.docs):
            if matches(doc, query):
                self.docs.pop(i)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


@pytest.fixture
def admin_env(monkeypatch):
    admin = {'_id': ObjectId(), 'role': 'admin', 'email': 'admin@example.invalid',
             'password_hash': 'test-hash', 'balance': 50., 'balance_blz': 20.}
    target = {'_id': ObjectId(), 'id': 'legacy-customer', 'role': 'user',
              'email': 'customer@example.invalid', 'balance': 100., 'balance_blz': 10.}
    db = FakeDB([admin, target], ledger_mode='ok')
    db.users = MemoryCollection([admin, target])
    db.payment_idempotency = MemoryCollection()
    db.transactions = MemoryCollection()
    db.wallet_repair_actions = MemoryCollection()
    db.otp_codes = MemoryCollection()
    monkeypatch.setattr(canonical, 'db', db)
    monkeypatch.setattr(admin_wallet, 'db', db)

    async def current(_):
        return admin

    async def audit(*args, **kwargs):
        return None

    monkeypatch.setattr(admin_wallet, 'get_current_user', current)
    monkeypatch.setattr(admin_wallet, 'verify_password', lambda password, hashed: password == 'correct-password')
    monkeypatch.setattr(admin_wallet, 'log_audit', audit)
    request = Request({'type': 'http', 'headers': [], 'client': ('127.0.0.1', 1)})
    return db, admin, target, request


def command(target, **kwargs):
    return admin_wallet.CreditReq(user_id=str(target['_id']), reason='Verified correction',
                                  admin_password='correct-password', idempotency_key='client-intent-1', **kwargs)


@pytest.mark.parametrize('amounts', [dict(amount_eur=-1), dict(amount_blz=-1), dict(amount_eur=float('nan')),
                                    dict(amount_blz=float('inf')), dict(amount_eur=0.001), {},
                                    dict(amount_eur=1, amount_blz=1), dict(amount_eur=100001)])
def test_invalid_or_mixed_assets_fail_validation_before_any_effect(amounts):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        admin_wallet.SelfTopupReq(reason='Correction', **amounts)


def test_admin_credit_replays_and_uses_canonical_object_id(admin_env):
    db, admin, target, req = admin_env
    payload = command(target, amount_eur=12.50)
    payload.user_id = 'legacy-customer'
    first = run(admin_wallet.credit_user(payload, req))
    second = run(admin_wallet.credit_user(payload, req))
    assert first['tx_id'] == second['tx_id']
    assert db.users.docs[1]['balance'] == 112.5
    assert len(db.wallet_ledger_entries.docs) == 2


@pytest.mark.parametrize('change', [{'amount_eur': 20}, {'amount_eur': 0, 'amount_blz': 10},
                                  {'amount_eur': 6000}, {'reason': 'different reason'}])
def test_same_key_cannot_change_intent_or_bypass_approval_threshold(admin_env, change):
    db, admin, target, req = admin_env
    payload = command(target, amount_eur=10)
    run(admin_wallet.credit_user(payload, req))
    other = admin_wallet.CreditReq(**{**payload.model_dump(), **change})
    with pytest.raises(HTTPException) as exc:
        run(admin_wallet.credit_user(other, req))
    assert exc.value.status_code == 409
    assert db.users.docs[1]['balance'] == 110
    assert not db.wallet_repair_actions.docs


def test_admin_role_and_password_are_required(admin_env):
    db, admin, target, req = admin_env
    payload = command(target, amount_eur=10)
    payload.admin_password = ''
    with pytest.raises(HTTPException):
        run(admin_wallet.credit_user(payload, req))
    payload.admin_password = 'correct-password'
    admin['role'] = 'user'
    with pytest.raises(HTTPException):
        run(admin_wallet.credit_user(payload, req))
    assert db.users.docs[1]['balance'] == 100
    assert not db.payment_idempotency.docs


@pytest.mark.parametrize('direction', ['credit', 'debit'])
def test_blz_parallel_retries_mutate_once_and_keep_eur_unchanged(admin_env, direction):
    db, admin, target, req = admin_env
    payload = command(target, amount_blz=4)
    fn = admin_wallet.credit_user if direction == 'credit' else admin_wallet.debit_user

    async def race():
        return await asyncio.gather(*(fn(payload, req) for _ in range(5)), return_exceptions=True)

    outcomes = run(race())
    assert any(isinstance(result, dict) and result['ok'] for result in outcomes)
    replay = run(fn(payload, req))
    assert replay['ok']
    assert db.users.docs[1]['balance_blz'] == (14 if direction == 'credit' else 6)
    assert db.users.docs[1]['balance'] == 100
    assert len(db.transactions.docs) == 1
    assert db.transactions.docs[0]['currency'] == 'BLZ'
    assert db.transactions.docs[0]['status'] == 'completed'


@pytest.mark.parametrize('failure', ['users', 'transactions', 'payment_idempotency'])
def test_blz_retry_finishes_journal_after_crash_without_second_credit(admin_env, failure):
    db, admin, target, req = admin_env
    payload = command(target, amount_blz=5)
    if failure == 'users':
        db.users.fail_after_balance = True
    else:
        getattr(db, failure).fail_complete = True
    with pytest.raises(Crash):
        run(admin_wallet.credit_user(payload, req))
    assert db.users.docs[1]['balance_blz'] == 15
    assert run(admin_wallet.credit_user(payload, req))['ok']
    assert db.users.docs[1]['balance_blz'] == 15
    assert len(db.transactions.docs) == 1
    assert db.transactions.docs[0]['status'] == 'completed'


def test_ambiguous_pre_marker_crash_fails_closed(admin_env):
    db, admin, target, req = admin_env
    db.users.fail_before_balance = True
    payload = command(target, amount_blz=5)
    with pytest.raises(Crash):
        run(admin_wallet.credit_user(payload, req))
    with pytest.raises(HTTPException) as exc:
        run(admin_wallet.credit_user(payload, req))
    assert exc.value.status_code == 409
    assert db.users.docs[1]['balance_blz'] == 10


def test_parallel_distinct_blz_debits_never_go_negative(admin_env):
    db, admin, target, req = admin_env
    first = command(target, amount_blz=7)
    second = first.model_copy(update={'idempotency_key': 'second-intent'})

    async def race():
        return await asyncio.gather(admin_wallet.debit_user(first, req), admin_wallet.debit_user(second, req), return_exceptions=True)

    outcomes = run(race())
    assert sum(isinstance(result, dict) for result in outcomes) == 1
    assert db.users.docs[1]['balance_blz'] == 3
    failed = first if isinstance(outcomes[0], Exception) else second
    db.users.docs[1]['balance_blz'] = 30
    with pytest.raises(HTTPException):
        run(admin_wallet.debit_user(failed, req))
    assert db.users.docs[1]['balance_blz'] == 30


def test_self_topup_reports_canonical_failure(admin_env, monkeypatch):
    db, admin, target, req = admin_env

    async def failed(**kwargs):
        return SimpleNamespace(success=False, error='reconciliation required', status='reconciliation_required')

    monkeypatch.setattr(admin_wallet, 'credit_wallet', failed)
    payload = admin_wallet.SelfTopupReq(amount_eur=5, reason='Correction', idempotency_key='self-intent', admin_password='correct-password')
    with pytest.raises(HTTPException) as exc:
        run(admin_wallet.self_topup(payload, req))
    assert exc.value.status_code == 409


def test_large_credit_uses_existing_queue_and_independent_admin(admin_env, monkeypatch):
    db, admin, target, req = admin_env
    result = run(admin_wallet.credit_user(command(target, amount_eur=6000), req))
    assert result['pending_approval']
    assert db.users.docs[1]['balance'] == 100
    approval = admin_wallet.RepairApproveReq(repair_id=result['repair_id'], reason='Evidence checked', admin_password='correct-password')
    with pytest.raises(HTTPException) as exc:
        run(admin_wallet.approve_repair(approval, req))
    assert exc.value.status_code == 403
    reviewer = {**admin, '_id': ObjectId(), 'email': 'reviewer@example.invalid'}
    db.users.docs.append(copy.deepcopy(reviewer))

    async def current(_):
        return reviewer

    monkeypatch.setattr(admin_wallet, 'get_current_user', current)
    assert run(admin_wallet.approve_repair(approval, req))['ok']
    assert run(admin_wallet.approve_repair(approval, req))['idempotent_replay']
    assert db.users.docs[1]['balance'] == 6100
    assert len(db.transactions.docs) == 1


def test_same_otp_cannot_authorize_two_parallel_requests(admin_env):
    from datetime import datetime, timedelta, timezone
    db, admin, target, req = admin_env
    db.users.docs[0]['two_factor_enabled'] = True
    db.otp_codes.docs = [{'_id': 'otp-1', 'user_id': str(admin['_id']), 'purpose': 'wallet_repair_stepup',
                         'code': '123456', 'attempts': 0,
                         'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}]

    async def race():
        return await asyncio.gather(*(admin_wallet._verify_admin_step_up(admin, 'correct-password', '123456') for _ in range(2)), return_exceptions=True)

    outcomes = run(race())
    assert sum(result is None for result in outcomes) == 1
    assert len(db.otp_codes.docs) == 0
