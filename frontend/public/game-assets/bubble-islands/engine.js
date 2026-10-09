(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzBubbleIslands = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const ROWS = 7, COLS = 7, SIZE = ROWS * COLS, COLORS = 5, LEVEL_COUNT = 20;
  const copy = value => JSON.parse(JSON.stringify(value));
  const levels = Array.from({ length: LEVEL_COUNT }, (_, index) => ({
    number: index + 1,
    island: index < 5 ? 'Coral Bay' : index < 10 ? 'Emerald Clouds' : index < 15 ? 'Sunset Reef' : 'Aurora Isles',
    moves: 18 + Math.floor(index / 5) * 2,
    target: 800 + index * 140,
  }));

  function random(state) {
    let x = state.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rng = x >>> 0;
    return state.rng / 4294967296;
  }

  function neighbours(index) {
    if (!Number.isInteger(index) || index < 0 || index >= SIZE) return [];
    const row = Math.floor(index / COLS), col = index % COLS, result = [];
    if (row > 0) result.push(index - COLS);
    if (row < ROWS - 1) result.push(index + COLS);
    if (col > 0) result.push(index - 1);
    if (col < COLS - 1) result.push(index + 1);
    return result;
  }

  function group(board, start) {
    if (!Array.isArray(board) || board.length !== SIZE || !Number.isInteger(start) || start < 0 || start >= SIZE) return [];
    const color = board[start];
    if (!Number.isInteger(color) || color < 0 || color >= COLORS) return [];
    const seen = new Set([start]), queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const next of neighbours(queue[cursor])) {
        if (!seen.has(next) && board[next] === color) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return queue;
  }

  function groups(board) {
    const found = [], seen = new Set();
    for (let index = 0; index < SIZE; index++) {
      if (seen.has(index) || board[index] < 0) continue;
      const cells = group(board, index);
      cells.forEach(cell => seen.add(cell));
      if (cells.length >= 2) found.push(cells);
    }
    return found;
  }

  function hasMove(board) {
    return groups(board).length > 0;
  }

  function generate(state) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const board = Array.from({ length: SIZE }, () => Math.floor(random(state) * COLORS));
      if (hasMove(board)) return board;
    }
    throw new Error('Kein spielbares Bubble-Feld erzeugt.');
  }

  function createGame(level = 1, seed = 123456) {
    if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) throw new Error('Ungültiges Level.');
    const state = {
      version: 1,
      level,
      rng: (seed >>> 0) || 123456,
      moves: levels[level - 1].moves,
      score: 0,
      turns: 0,
      status: 'playing',
    };
    state.board = generate(state);
    return state;
  }

  function collapse(board) {
    const next = board.slice();

    for (let col = 0; col < COLS; col++) {
      const values = [];
      for (let row = ROWS - 1; row >= 0; row--) {
        const value = next[row * COLS + col];
        if (value >= 0) values.push(value);
      }
      for (let row = ROWS - 1, cursor = 0; row >= 0; row--, cursor++) {
        next[row * COLS + col] = cursor < values.length ? values[cursor] : -1;
      }
    }

    const columns = [];
    for (let col = 0; col < COLS; col++) {
      const values = Array.from({ length: ROWS }, (_, row) => next[row * COLS + col]);
      if (values.some(value => value >= 0)) columns.push(values);
    }
    while (columns.length < COLS) columns.push(Array(ROWS).fill(-1));

    const compact = Array(SIZE).fill(-1);
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) compact[row * COLS + col] = columns[col][row];
    }
    return compact;
  }

  function updateStatus(state) {
    const target = levels[state.level - 1].target;
    if (state.score >= target) state.status = 'won';
    else if (state.moves <= 0 || !hasMove(state.board)) state.status = 'lost';
    else state.status = 'playing';
  }

  function pop(original, index) {
    if (!original || original.status !== 'playing') return { ok: false, state: original, removed: [] };
    const cells = group(original.board, index);
    if (cells.length < 2) return { ok: false, state: original, removed: [] };

    const state = copy(original);
    for (const cell of cells) state.board[cell] = -1;
    state.board = collapse(state.board);
    state.moves -= 1;
    state.turns += 1;
    state.score += cells.length * cells.length * 10;
    updateStatus(state);
    return { ok: true, state, removed: cells.slice(), gained: cells.length * cells.length * 10 };
  }

  function starsFor(game) {
    const target = levels[game.level - 1].target;
    if (game.score < target) return 0;
    if (game.score >= target * 1.8) return 3;
    if (game.score >= target * 1.35) return 2;
    return 1;
  }

  function initial(seed = 123456) {
    return {
      version: 1,
      unlocked: 1,
      best: Array(LEVEL_COUNT).fill(0),
      stars: Array(LEVEL_COUNT).fill(0),
      active: createGame(1, seed),
    };
  }

  function begin(profile, level, seed) {
    if (!profile || !Number.isInteger(level) || level < 1 || level > profile.unlocked || level > LEVEL_COUNT) {
      return { ok: false, profile };
    }
    const next = copy(profile);
    next.active = createGame(level, seed);
    return { ok: true, profile: next };
  }

  function complete(profile, game) {
    const next = copy(profile);
    next.active = copy(game);
    if (game.status === 'won') {
      const index = game.level - 1;
      next.best[index] = Math.max(next.best[index], game.score);
      next.stars[index] = Math.max(next.stars[index], starsFor(game));
      next.unlocked = Math.max(next.unlocked, Math.min(LEVEL_COUNT, game.level + 1));
    }
    return next;
  }

  function decode(text) {
    try {
      const profile = JSON.parse(text);
      if (!profile || profile.version !== 1) return null;
      const validInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
      if (!validInt(profile.unlocked, 1, LEVEL_COUNT)) return null;
      if (!Array.isArray(profile.best) || profile.best.length !== LEVEL_COUNT || !profile.best.every(value => validInt(value, 0, 1e9))) return null;
      if (!Array.isArray(profile.stars) || profile.stars.length !== LEVEL_COUNT || !profile.stars.every(value => validInt(value, 0, 3))) return null;
      const game = profile.active;
      if (!game || game.version !== 1 || !validInt(game.level, 1, profile.unlocked) || !validInt(game.rng, 1, 4294967295)) return null;
      if (!validInt(game.moves, 0, 100) || !validInt(game.score, 0, 1e9) || !validInt(game.turns, 0, 1e9)) return null;
      if (!['playing', 'won', 'lost'].includes(game.status)) return null;
      if (!Array.isArray(game.board) || game.board.length !== SIZE || !game.board.every(value => validInt(value, -1, COLORS - 1))) return null;
      const expected = copy(game);
      updateStatus(expected);
      if (expected.status !== game.status) return null;
      return profile;
    } catch {
      return null;
    }
  }

  return {
    ROWS, COLS, SIZE, COLORS, LEVEL_COUNT, levels,
    neighbours, group, groups, hasMove, createGame, collapse, pop,
    starsFor, initial, begin, complete, decode,
  };
}));
