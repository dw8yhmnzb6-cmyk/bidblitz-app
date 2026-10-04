(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzMatch = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const SIZE = 8, TYPES = 6;
  const copy = x => JSON.parse(JSON.stringify(x));
  const levels = Array.from({ length: 30 }, (_, i) => ({
    number: i + 1, world: i < 10 ? 'Neon Garden' : i < 20 ? 'Ocean Lights' : 'Crystal Peaks',
    moves: 23 + Math.floor(i / 10) * 3, target: 650 + i * 95,
    blue: i < 10 ? 0 : 8 + Math.floor((i - 10) / 2), ice: i < 20 ? 0 : 8 + (i - 20) * 2
  }));
  // Deterministic casual-game RNG. Never suitable for real-money casino use.
  function random(s) { let x = s.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
  const kind = value => Math.floor(value / TYPES);
  const color = value => kind(value) === 4 ? -1 : value % TYPES;
  function groups(board) {
    const result = [];
    for (let axis = 0; axis < 2; axis++) for (let line = 0; line < SIZE; line++) {
      let run = [];
      for (let p = 0; p <= SIZE; p++) {
        const at = axis ? p * SIZE + line : line * SIZE + p;
        if (p < SIZE && (!run.length || color(board[at]) >= 0 && color(board[at]) === color(board[run[0]]))) run.push(at);
        else { if (run.length >= 3) result.push({ cells: run, axis }); run = p < SIZE ? [at] : []; }
      }
    }
    return result;
  }
  function adjacent(a, b) { return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < 64 && b < 64 && Math.abs(a % 8 - b % 8) + Math.abs(Math.floor(a / 8) - Math.floor(b / 8)) === 1; }
  function legal(board, a, b) {
    if (!adjacent(a, b)) return false;
    if (kind(board[a]) === 4 || kind(board[b]) === 4 || (kind(board[a]) && kind(board[b]))) return true;
    const next = board.slice(); [next[a], next[b]] = [next[b], next[a]];
    return groups(next).some(g => g.cells.includes(a) || g.cells.includes(b));
  }
  function hint(board) {
    for (let i = 0; i < 64; i++) for (const j of [i + 1, i + 8]) if (legal(board, i, j)) return [i, j];
    return null;
  }
  function generate(s) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const board = [];
      for (let i = 0; i < 64; i++) {
        const forbidden = new Set();
        if (i % 8 > 1 && board[i - 1] === board[i - 2]) forbidden.add(board[i - 1]);
        if (i >= 16 && board[i - 8] === board[i - 16]) forbidden.add(board[i - 8]);
        const choices = [0, 1, 2, 3, 4, 5].filter(n => !forbidden.has(n));
        board.push(choices[Math.floor(random(s) * choices.length)]);
      }
      if (hint(board)) return board;
    }
    throw new Error('Kein spielbares Feld erzeugt.');
  }
  function createGame(level = 1, seed = 123456) {
    if (!Number.isInteger(level) || level < 1 || level > 30) throw new Error('Ungültiges Level.');
    const spec = levels[level - 1];
    const s = { level, rng: (seed >>> 0) || 123456, moves: spec.moves, score: 0, blue: 0, ice: [], status: 'playing', turns: 0 };
    s.roundId = level + ':' + s.rng;
    s.lifeCharged = false;
    s.board = generate(s);
    const cells = Array.from({ length: 64 }, (_, i) => i);
    for (let n = 0; n < spec.ice; n++) s.ice.push(cells.splice(Math.floor(random(s) * cells.length), 1)[0]);
    return s;
  }
  function updateStatus(s) {
    const spec = levels[s.level - 1];
    s.status = s.score >= spec.target && s.blue >= spec.blue && !s.ice.length ? 'won' : s.moves <= 0 ? 'lost' : 'playing';
  }
  function creations(board, matches, preferred) {
    const clusters = [];
    for (const g of matches) {
      const touching = clusters.filter(c => g.cells.some(i => c.cells.has(i)));
      const c = { cells: new Set(g.cells), groups: [g] };
      for (const old of touching) {
        old.cells.forEach(i => c.cells.add(i)); c.groups.push(...old.groups);
        clusters.splice(clusters.indexOf(old), 1);
      }
      clusters.push(c);
    }
    return clusters.flatMap(c => {
      const long = c.groups.find(g => g.cells.length >= 5);
      const cross = c.groups.some(g => g.axis === 0) && c.groups.some(g => g.axis === 1);
      const four = c.groups.find(g => g.cells.length === 4);
      const type = long ? 4 : cross ? 3 : four ? (four.axis ? 2 : 1) : 0;
      if (!type) return [];
      const eligible = [...c.cells].filter(i => !kind(board[i]));
      const at = preferred.find(i => eligible.includes(i)) ?? eligible[0];
      return at === undefined ? [] : [{ at, value: type === 4 ? 24 : type * TYPES + color(board[at]) }];
    });
  }
  function effect(board, at) {
    const result = [], row = Math.floor(at / 8), col = at % 8, type = kind(board[at]);
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      if ((type === 1 && r === row) || (type === 2 && c === col) ||
          (type === 3 && Math.abs(r-row) <= 1 && Math.abs(c-col) <= 1)) result.push(i);
    }
    if (type === 4) {
      const counts = Array(6).fill(0);
      board.forEach(v => { if (color(v) >= 0) counts[color(v)]++; });
      const selected = counts.indexOf(Math.max(...counts));
      board.forEach((v,i) => { if (color(v) === selected) result.push(i); });
    }
    return result;
  }
  function combination(board, a, b) {
    const ka = kind(board[a]), kb = kind(board[b]);
    const clear = new Set([a,b]);
    if (ka === 4 && kb === 4) return new Set(board.map((_,i) => i));
    if (ka === 4 || kb === 4) {
      const other = ka === 4 ? b : a, target = color(board[other]), special = kind(board[other]);
      board.forEach((v,i) => {
        if (color(v) === target) { clear.add(i); if (special) board[i] = special * TYPES + target; }
      });
    } else if ((ka === 3 && (kb === 1 || kb === 2)) || (kb === 3 && (ka === 1 || ka === 2))) {
      for (let i=0;i<64;i++) if (Math.abs(Math.floor(i/8)-Math.floor(b/8)) <= 1 || Math.abs(i%8-b%8) <= 1) clear.add(i);
    } else if (ka === 3 && kb === 3) {
      for (let i=0;i<64;i++) if (Math.abs(Math.floor(i/8)-Math.floor(b/8)) <= 2 && Math.abs(i%8-b%8) <= 2) clear.add(i);
    } else {
      for (let i=0;i<64;i++) if (Math.floor(i/8) === Math.floor(b/8) || i%8 === b%8) clear.add(i);
    }
    return clear;
  }
  function renew(s) {
    const specials = s.board.filter(v => kind(v));
    s.board = generate(s);
    // Preserve earned special types; adopt the new cell color to avoid instant matches.
    specials.forEach((v,i) => { s.board[i] = kind(v) === 4 ? 24 : kind(v)*TYPES + s.board[i]; });
  }
  function swap(original, a, b) {
    if (original.status !== 'playing' || !legal(original.board, a, b)) return { ok: false, state: original, frames: [] };
    const s = copy(original), frames = [];
    const specialSwap = kind(s.board[a]) === 4 || kind(s.board[b]) === 4 || (kind(s.board[a]) && kind(s.board[b]));
    [s.board[a], s.board[b]] = [s.board[b], s.board[a]];
    s.moves--; s.turns++;
    let pending = specialSwap ? combination(s.board,a,b) : null;
    let combo = 0, match;
    while (((match = groups(s.board)).length || pending) && combo < 25) {
      combo++;
      const created = pending ? [] : creations(s.board,match,combo === 1 ? [b,a] : []);
      const clear = pending || new Set(match.flatMap(g => g.cells));
      // A directly combined color bomb uses the chosen color, not its passive effect.
      const activated = new Set(pending ? [a,b].filter(i => kind(s.board[i]) === 4) : []);
      pending = null;
      const queue = [...clear];
      for (let n=0;n<queue.length;n++) {
        const at = queue[n];
        if (!kind(s.board[at]) || activated.has(at)) continue;
        activated.add(at);
        for (const i of effect(s.board,at)) if (!clear.has(i)) { clear.add(i); queue.push(i); }
      }
      const hit = new Set(clear);
      for (const item of created) clear.delete(item.at);
      frames.push({ board: s.board.slice(), clear: [...clear], created: copy(created), combo });
      s.score += clear.size * 10 * Math.min(combo, 4);
      s.blue += [...clear].filter(i => color(s.board[i]) === 0).length;
      s.ice = s.ice.filter(i => !hit.has(i));
      for (const item of created) s.board[item.at] = item.value;
      for (let col = 0; col < 8; col++) {
        const remaining = [];
        for (let row = 7; row >= 0; row--) if (!clear.has(row * 8 + col)) remaining.push(s.board[row * 8 + col]);
        for (let row = 7, n = 0; row >= 0; row--, n++) s.board[row * 8 + col] = n < remaining.length ? remaining[n] : Math.floor(random(s) * TYPES);
      }
    }
    let reshuffled = false;
    if (groups(s.board).length || !hint(s.board)) { renew(s); reshuffled = true; }
    updateStatus(s);
    return { ok: true, state: s, frames, combo, reshuffled };
  }
  const LIFE_INTERVAL = 30 * 60 * 1000;
  function refreshEnergy(profile, now = Date.now()) {
    const p = copy(profile);
    if (!Number.isSafeInteger(now) || now < 0) throw new Error('Ungültige Zeit.');
    if (!p.energy) p.energy = { count: 5, anchor: now };
    const e = p.energy, effective = Math.max(now, e.anchor);
    if (e.count === 5) e.anchor = effective;
    else {
      const recovered = Math.floor((effective - e.anchor) / LIFE_INTERVAL);
      e.count = Math.min(5, e.count + recovered);
      e.anchor = e.count === 5 ? effective : e.anchor + recovered * LIFE_INTERVAL;
    }
    return p;
  }
  function lifeWait(profile, now = Date.now()) {
    const p = refreshEnergy(profile, now);
    return p.energy.count === 5 ? 0 : Math.max(0, p.energy.anchor + LIFE_INTERVAL - now);
  }
  function spendLife(p, now) {
    if (p.energy.count === 5) p.energy.anchor = Math.max(now, p.energy.anchor);
    p.energy.count = Math.max(0, p.energy.count - 1);
  }
  function begin(profile, level, seed, now = Date.now()) {
    if (!Number.isInteger(level) || level < 1 || level > profile.unlocked) return { ok:false, reason:'Dieses Level ist noch gesperrt.', profile };
    const p = refreshEnergy(profile, now);
    if (p.active.status === 'playing' && p.active.turns > 0 && !p.active.lifeCharged) {
      spendLife(p,now);p.active.lifeCharged=true;p.active.status='lost';p.active.moves=0;p.revision++;
    }
    if (!p.energy.count) return { ok:false, reason:'Deine Leben laden sich wieder auf.', profile:p };
    p.active=createGame(level,seed);p.revision++;
    return {ok:true,profile:p};
  }
  function initial(seed, now = Date.now()) { return { version: 1, revision: 0, coins: 150, unlocked: 1, best: Array(30).fill(0), stars: Array(30).fill(0), active: createGame(1, seed), purchases: [], receipts: [], energy: {count:5,anchor:now} }; }
  function complete(profile, game, now = Date.now()) {
    const p = refreshEnergy(profile, now);
    const charged = game.lifeCharged || (p.active.roundId === game.roundId && p.active.lifeCharged);
    p.active = copy(game); p.active.lifeCharged = Boolean(charged);
    if (game.status === 'lost' && !charged) { spendLife(p,now); p.active.lifeCharged=true; }
    if (game.status === 'won') {
      const i = game.level - 1, first = p.best[i] === 0;
      p.best[i] = Math.max(p.best[i], game.score);
      const spec = levels[i], rating = game.moves >= spec.moves * .5 ? 3 : game.moves >= spec.moves * .2 ? 2 : 1;
      p.stars[i] = Math.max(p.stars[i], rating);
      p.unlocked = Math.max(p.unlocked, Math.min(30, game.level + 1));
      if (first) { const amount = 50 + game.level * 5; p.coins += amount; p.receipts.unshift({ label: 'Level ' + game.level + ' geschafft', amount }); }
    }
    p.receipts = p.receipts.slice(0, 12); p.revision++;
    return p;
  }
  function purchase(profile, product, id) {
    if (typeof id !== 'string' || !id || id.length > 100) return { ok: false, reason: 'Ungültige Referenz.' };
    if (profile.purchases.includes(id)) return { ok: true, duplicate: true, profile };
    const price = product === 'moves' ? 100 : product === 'shuffle' ? 50 : null;
    if (price === null || profile.coins < price) return { ok: false, reason: 'Nicht genug Spielmünzen.' };
    if (profile.active.status === 'won' || (product === 'shuffle' && profile.active.status !== 'playing')) return { ok: false, reason: 'Starte zuerst ein neues Level.' };
    if (product === 'moves' && profile.active.moves > 495) return { ok: false, reason: 'Maximale Zugzahl erreicht.' };
    const p = copy(profile); p.coins -= price;
    if (product === 'moves') { p.active.moves += 5; p.active.status = 'playing'; }
    else renew(p.active);
    p.purchases.push(id); p.receipts.unshift({ label: product === 'moves' ? '5 zusätzliche Züge' : 'Neues Spielfeld', amount: -price }); p.receipts = p.receipts.slice(0, 12); p.revision++;
    return { ok: true, profile: p };
  }
  function decode(text) {
    try {
      const p = JSON.parse(text), s = p.active;
      const int = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
      if (p.version !== 1 || !int(p.revision,0,1e9) || !int(p.coins,0,1e9) || !int(p.unlocked,1,30)) return null;
      if (!Array.isArray(p.best) || p.best.length !== 30 || !p.best.every(x => int(x,0,1e9))) return null;
      if (!Array.isArray(p.stars) || p.stars.length !== 30 || !p.stars.every(x => int(x,0,3))) return null;
      if (!s || !int(s.level,1,p.unlocked) || !int(s.rng,1,4294967295) || !int(s.moves,0,500) || !int(s.score,0,1e9) || !int(s.blue,0,1e9) || !int(s.turns,0,1e9)) return null;
      if (!Array.isArray(s.board) || s.board.length !== 64 || !s.board.every(x => int(x,0,24)) || groups(s.board).length || !hint(s.board)) return null;
      if (!Array.isArray(s.ice) || s.ice.length > levels[s.level-1].ice || !s.ice.every(x=>int(x,0,63)) || new Set(s.ice).size !== s.ice.length) return null;
      const expected = copy(s); updateStatus(expected); if (s.status !== expected.status) return null;
      if (!Array.isArray(p.purchases) || !p.purchases.every(x=>typeof x==='string'&&x.length<=100) || p.purchases.length > 10000) return null;
      if (!Array.isArray(p.receipts) || p.receipts.length > 12 || !p.receipts.every(x=>typeof x.label==='string' && x.label.length < 100 && int(x.amount,-10000,10000))) return null;
      if (p.energy !== undefined && (!p.energy || !int(p.energy.count,0,5) || !Number.isSafeInteger(p.energy.anchor) || p.energy.anchor < 0)) return null;
      if (s.lifeCharged !== undefined && typeof s.lifeCharged !== 'boolean') return null;
      if (s.roundId !== undefined && (typeof s.roundId !== 'string' || s.roundId.length > 100)) return null;
      if (s.roundId === undefined) s.roundId = 'legacy:' + s.level + ':' + s.rng;
      // Completed old attempts have no retroactive life charge.
      if (s.lifeCharged === undefined) s.lifeCharged = s.status === 'lost';
      return p;
    } catch { return null; }
  }
  return { LIFE_INTERVAL, refreshEnergy, lifeWait, begin, levels, kind, color, groups, adjacent, legal, hint, createGame, swap, initial, complete, purchase, decode };
}));
