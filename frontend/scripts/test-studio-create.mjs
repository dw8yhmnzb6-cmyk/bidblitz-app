import test from "node:test";
import assert from "node:assert/strict";
import { prepareCreateAttempt, uncertainCreateError } from "../src/config/studioCreatePolicy.mjs";

test("same payload reuses the same idempotency key", () => {
  const first = prepareCreateAttempt(null, '{"title":"A"}');
  const second = prepareCreateAttempt(first, '{"title":"A"}');
  assert.equal(second.key, first.key);
  assert.equal(second.payload, first.payload);
});

test("changed payload receives a new idempotency key", () => {
  const first = prepareCreateAttempt(null, '{"title":"A"}');
  const second = prepareCreateAttempt(first, '{"title":"B"}');
  assert.notEqual(second.key, first.key);
});

test("only uncertain failures keep the same create attempt", () => {
  assert.equal(uncertainCreateError(new TypeError("network")), true);
  assert.equal(uncertainCreateError({ status: 503 }), true);
  assert.equal(uncertainCreateError({ name: "AbortError" }), true);
  assert.equal(uncertainCreateError({ status: 400 }), false);
  assert.equal(uncertainCreateError({ status: 409 }), false);
});
