import test from "node:test";
import assert from "node:assert/strict";
import { createAdminWalletAttempt } from "../src/utils/adminWalletAttempt.mjs";

const intent = { operation: "credit", user_id: "customer", amount_eur: 10, amount_blz: 0, reason: "Correction" };
function fixture() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  let sequence = 0;
  return { storage, values, manager: () => createAdminWalletAttempt(storage, "admin:send", () => `key-${++sequence}`) };
}
test("retry and page reload reuse the acknowledged intent until completion", () => {
  const { manager } = fixture();
  const attempt = manager();
  const key = attempt.begin(intent);
  assert.equal(attempt.begin(intent), key);
  assert.equal(manager().begin(intent), key);
  attempt.complete(key);
  assert.notEqual(manager().begin(intent), key);
});
test("changing recipient, asset, amount, operation or reason cannot resubmit an uncertain booking", () => {
  for (const change of [{ user_id: "other" }, { amount_eur: 20 }, { amount_blz: 1 }, { operation: "debit" }, { reason: "Other" }]) {
    const { manager } = fixture();
    manager().begin(intent);
    assert.throws(() => manager().begin({ ...intent, ...change }), /noch offen/);
  }
});
test("credentials never enter the stored intent and may change for a retry", () => {
  const { manager, values } = fixture();
  const key = manager().begin({ ...intent, admin_password: "secret-password", otp_code: "123456" });
  assert.equal(manager().begin({ ...intent, admin_password: "new-password", otp_code: "654321" }), key);
  assert.doesNotMatch([...values.values()].join(""), /password|secret|otp|123456/);
});
test("storage errors prevent sending a request without a recoverable key", () => {
  const { storage } = fixture();
  storage.setItem = () => { throw new Error("storage unavailable"); };
  assert.throws(() => createAdminWalletAttempt(storage, "admin").begin(intent), /storage unavailable/);
});
test("an old response cannot clear a newer pending request", () => {
  const { manager } = fixture();
  const attempt = manager();
  const old = attempt.begin(intent);
  attempt.complete(old);
  const next = attempt.begin(intent);
  attempt.complete(old);
  assert.equal(attempt.read().key, next);
});
