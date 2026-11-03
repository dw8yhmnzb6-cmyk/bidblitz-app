import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLocale, readStoredLocale, persistLocale } from '../src/config/languagePolicy.mjs';

const registry = JSON.parse(readFileSync(new URL('../src/config/gamesLanguages.json', import.meta.url), 'utf8'));
const codes = registry.map(item => item.code);

test('51 unique options represent 50 languages and four RTL languages', () => {
  assert.equal(new Set(codes).size, 51);
  assert.equal(new Set(codes.map(code => code.split('-')[0])).size, 50);
  assert.deepEqual(registry.filter(item => item.rtl).map(item => item.code).sort(), ['ar', 'fa', 'he', 'ur']);
});

test('every registered preference survives storage and restoration', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  for (const code of codes) {
    assert.equal(persistLocale(storage, 'language', code), true);
    assert.equal(readStoredLocale(storage, 'language', codes), code);
  }
});

test('Chinese scripts remain distinct, including regional and case variants', () => {
  for (const [input, expected] of [['zh-Hant-TW', 'zh-Hant'], ['zh_Hans_CN', 'zh-Hans'], ['zh-TW', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh-CN', 'zh-Hans'], ['ZH-hANT', 'zh-Hant']]) {
    assert.equal(resolveLocale(input, codes), expected);
  }
  assert.equal(resolveLocale('zh-Hant', ['en', 'zh-Hans']), 'en');
});

test('existing regional preferences stay registered and resolve to base copy', () => {
  const supported = [...codes, 'en-US', 'sq-XK', 'ar-AE'];
  for (const code of ['en-US', 'sq-XK', 'ar-AE']) assert.equal(resolveLocale(code, supported), code);
  assert.equal(resolveLocale('en-US', ['de', 'en', 'sq']), 'en');
  assert.equal(resolveLocale('sq-XK', ['de', 'en', 'sq']), 'sq');
  assert.equal(resolveLocale('ja', ['de', 'en', 'sq']), 'en');
});

test('invalid values and unavailable storage use safe defaults', () => {
  for (const input of [null, undefined, '', '<script>', 'de!', 'xx', 123]) assert.equal(resolveLocale(input, codes, 'de'), 'de');
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readStoredLocale(storage, 'language', codes), 'de');
  assert.equal(persistLocale(storage, 'language', 'ja'), false);
});
