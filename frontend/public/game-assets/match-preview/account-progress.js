(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzMatchProgressSync = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const LEVELS = 30;
  const clone = value => JSON.parse(JSON.stringify(value));

  function validSummary(value) {
    if (!value || value.version !== 1 || !Number.isInteger(value.unlocked) || value.unlocked < 1 || value.unlocked > LEVELS) return false;
    if (!Array.isArray(value.best) || value.best.length !== LEVELS || !value.best.every(n => Number.isInteger(n) && n >= 0 && n <= 1e9)) return false;
    if (!Array.isArray(value.stars) || value.stars.length !== LEVELS || !value.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3)) return false;
    let completed = 0, gap = false;
    for (let i = 0; i < LEVELS; i++) {
      if (value.best[i] === 0) {
        if (value.stars[i] !== 0) return false;
        gap = true;
      } else {
        if (gap || value.stars[i] < 1) return false;
        completed = i + 1;
      }
    }
    const expected = completed ? Math.min(LEVELS, completed + 1) : 1;
    return value.unlocked === expected;
  }

  function summary(profile) {
    return {
      version: 1,
      unlocked: profile.unlocked,
      best: profile.best.slice(0, LEVELS),
      stars: profile.stars.slice(0, LEVELS),
    };
  }

  function merge(profile, remote) {
    if (!validSummary(remote)) return { profile, changed: false };
    const next = clone(profile);
    let changed = false;
    if (remote.unlocked > next.unlocked) { next.unlocked = remote.unlocked; changed = true; }
    for (let i = 0; i < LEVELS; i++) {
      if (remote.best[i] > next.best[i]) { next.best[i] = remote.best[i]; changed = true; }
      if (remote.stars[i] > next.stars[i]) { next.stars[i] = remote.stars[i]; changed = true; }
    }
    if (changed && Number.isInteger(next.revision) && next.revision < 1e9) next.revision++;
    return { profile: next, changed };
  }

  return { validSummary, summary, merge };
}));
