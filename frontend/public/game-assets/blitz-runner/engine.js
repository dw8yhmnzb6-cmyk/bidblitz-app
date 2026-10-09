(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BidBlitzRunner = factory();
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const LANES = 3, LEVEL_COUNT = 15;
  const copy = value => JSON.parse(JSON.stringify(value));
  const levels = Array.from({ length: LEVEL_COUNT }, (_, index) => ({
    number: index + 1,
    zone: index < 5 ? 'Neon Harbor' : index < 10 ? 'Skyline Grid' : 'Aurora Circuit',
    distance: 24 + index * 2,
    starTarget: 7 + Math.floor(index / 2),
  }));

  function random(state) {
    let x = state.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rng = x >>> 0;
    return state.rng / 4294967296;
  }

  function buildCourse(state) {
    const spec = levels[state.level - 1];
    const course = [];
    let previousObstacle = -1;
    for (let index = 0; index < spec.distance; index++) {
      let obstacle = random(state) < 0.72 ? Math.floor(random(state) * LANES) : -1;
      if (obstacle === previousObstacle && random(state) < 0.55) {
        obstacle = (obstacle + 1 + Math.floor(random(state) * 2)) % LANES;
      }
      previousObstacle = obstacle;
      const safeLanes = [0, 1, 2].filter(lane => lane !== obstacle);
      const shard = random(state) < 0.84
        ? safeLanes[Math.floor(random(state) * safeLanes.length)]
        : -1;
      course.push({ obstacle, shard });
    }
    return course;
  }

  function createGame(level = 1, seed = 123456) {
    if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) throw new Error('Ungültiges Level.');
    const state = {
      version: 1,
      level,
      rng: (seed >>> 0) || 123456,
      lane: 1,
      position: 0,
      shards: 0,
      score: 0,
      status: 'playing',
      turns: 0,
    };
    state.course = buildCourse(state);
    return state;
  }

  function advance(original, direction) {
    if (!original || original.status !== 'playing') return { ok: false, state: original };
    if (!Number.isInteger(direction) || direction < -1 || direction > 1) return { ok: false, state: original };
    if (!Array.isArray(original.course) || original.position < 0 || original.position >= original.course.length) {
      return { ok: false, state: original };
    }

    const state = copy(original);
    state.lane = Math.max(0, Math.min(LANES - 1, state.lane + direction));
    const segment = state.course[state.position];
    state.turns += 1;

    if (segment.obstacle === state.lane) {
      state.status = 'lost';
      return {
        ok: true,
        state,
        collision: true,
        collected: false,
        segment: state.position,
      };
    }

    const collected = segment.shard === state.lane;
    if (collected) {
      state.shards += 1;
      state.score += 100;
    }
    state.score += 10;
    state.position += 1;
    if (state.position >= state.course.length) state.status = 'won';

    return {
      ok: true,
      state,
      collision: false,
      collected,
      segment: state.position - 1,
    };
  }

  function starsFor(game) {
    if (!game || game.status !== 'won') return 0;
    const target = levels[game.level - 1].starTarget;
    if (game.shards >= Math.ceil(target * 1.5)) return 3;
    if (game.shards >= target) return 2;
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
      const validInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
      if (!profile || profile.version !== 1 || !validInt(profile.unlocked, 1, LEVEL_COUNT)) return null;
      if (!Array.isArray(profile.best) || profile.best.length !== LEVEL_COUNT || !profile.best.every(value => validInt(value, 0, 1e9))) return null;
      if (!Array.isArray(profile.stars) || profile.stars.length !== LEVEL_COUNT || !profile.stars.every(value => validInt(value, 0, 3))) return null;
      const game = profile.active;
      if (!game || game.version !== 1 || !validInt(game.level, 1, profile.unlocked) || !validInt(game.rng, 1, 4294967295)) return null;
      if (!validInt(game.lane, 0, LANES - 1) || !validInt(game.position, 0, levels[game.level - 1].distance)) return null;
      if (!validInt(game.shards, 0, levels[game.level - 1].distance) || !validInt(game.score, 0, 1e9) || !validInt(game.turns, 0, 1e9)) return null;
      if (!['playing', 'won', 'lost'].includes(game.status)) return null;
      if (!Array.isArray(game.course) || game.course.length !== levels[game.level - 1].distance) return null;
      if (!game.course.every(segment =>
        segment && validInt(segment.obstacle, -1, LANES - 1) &&
        validInt(segment.shard, -1, LANES - 1) &&
        (segment.obstacle < 0 || segment.shard !== segment.obstacle)
      )) return null;
      if (game.status === 'won' && game.position !== game.course.length) return null;
      if (game.status === 'playing' && game.position >= game.course.length) return null;
      return profile;
    } catch {
      return null;
    }
  }

  return {
    LANES, LEVEL_COUNT, levels,
    createGame, advance, starsFor, initial, begin, complete, decode,
  };
}));