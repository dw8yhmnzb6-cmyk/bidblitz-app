(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzFarmAccountSync = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function progressTuple(state) {
    if (!state || typeof state !== 'object') return [0, 0, 0];
    return [
      Number.isInteger(state.day) ? state.day : 0,
      Number.isInteger(state.xp) ? state.xp : 0,
      Number.isInteger(state.harvests) ? state.harvests : 0,
    ];
  }

  function compareProgress(left, right) {
    const a = progressTuple(left);
    const b = progressTuple(right);
    for (let i = 0; i < a.length; i++) {
      if (a[i] > b[i]) return 1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  function chooseNewer(local, remote) {
    return compareProgress(local, remote) >= 0 ? 'local' : 'remote';
  }

  return { progressTuple, compareProgress, chooseNewer };
}));
