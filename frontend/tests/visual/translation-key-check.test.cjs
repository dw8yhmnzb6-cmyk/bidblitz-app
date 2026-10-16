const test = require("node:test");
const assert = require("node:assert/strict");
const { findVisibleTranslationKey } = require("./translation-key-check.cjs");

test("prices, decimal increments and domains are not untranslated keys", () => {
  for (const text of ["1.499,00 €", "+0.01", "12.50 EUR", "bidblitz.ae", "www.bidblitz.ae"]) {
    assert.equal(findVisibleTranslationKey(text), null, text);
  }
});
test("actual untranslated keys on auction and taxi screens remain errors", () => {
  for (const key of ["auction.bid_now", "auction.shipping_worldwide_free", "taxi.book_ride", "nav.home", "common.loading", "wallet.balance"]) {
    assert.equal(findVisibleTranslationKey("Text " + key + " danach"), key);
  }
});
