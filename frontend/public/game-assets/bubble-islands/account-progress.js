(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzBubbleProgressSync = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const LEVELS = 20;
  const clone = value => JSON.parse(JSON.stringify(value));

  function validSummary(value) {
    if (!value || value.version !== 1 || !Number.isInteger(value.unlocked) || value.unlocked < 1 || value.unlocked > LEVELS) return false;
    if (!Array.isArray(value.best) || value.best.length !== LEVELS || !value.best.every(n => Number.isInteger(n) && n >= 0 && n <= 1e9)) return false;
    if (!Array.isArray(value.stars) || value.stars.length !== LEVELS || !value.stars.every(n => Number.isInteger(n) && n >= 0 && n <= 3)) return false;
    let completed = 0, gap = false;
    for (let index = 0; index < LEVELS; index++) {
      if (value.best[index] === 0) {
        if (value.stars[index] !== 0) return false;
        gap = true;
      } else {
        if (gap || value.stars[index] < 1) return false;
        completed = index + 1;
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
    if (remote.unlocked > next.unlocked) {
      next.unlocked = remote.unlocked;
      changed = true;
    }
    for (let index = 0; index < LEVELS; index++) {
      if (remote.best[index] > next.best[index]) {
        next.best[index] = remote.best[index];
        changed = true;
      }
      if (remote.stars[index] > next.stars[index]) {
        next.stars[index] = remote.stars[index];
        changed = true;
      }
    }
    return { profile: next, changed };
  }

  return { validSummary, summary, merge };
}));
