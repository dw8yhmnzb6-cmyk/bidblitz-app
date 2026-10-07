(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzFarmAccountSync = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function progressTuple(state) {
    if (!state || typeof state !== 'object') return [0, 0, 0];
    const buildings = state.buildings && typeof state.buildings === 'object'
      ? Object.values(state.buildings).reduce((sum, value) => sum + (Number.isInteger(value) && value >= 0 ? value : 0), 0)
      : 0;
    const animals = state.animals && typeof state.animals === 'object'
      ? Object.values(state.animals).reduce((sum, herd) => sum + (Number.isInteger(herd?.count) && herd.count >= 0 ? herd.count : 0), 0)
      : 0;
    const inventory = state.inventory && typeof state.inventory === 'object'
      ? Object.values(state.inventory).reduce((sum, value) => sum + (Number.isInteger(value) && value >= 0 ? value : 0), 0)
      : 0;
    return [
      Number.isInteger(state.day) && state.day >= 0 ? state.day : 0,
      Number.isInteger(state.xp) && state.xp >= 0 ? state.xp : 0,
      Number.isInteger(state.harvests) && state.harvests >= 0 ? state.harvests : 0,
      Number.isInteger(state.completedOrders) && state.completedOrders >= 0 ? state.completedOrders : 0,
      Number.isInteger(state.unlockedPlots) && state.unlockedPlots >= 0 ? state.unlockedPlots : 0,
      buildings,
      animals,
      inventory,
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
