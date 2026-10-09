const assert = require('node:assert/strict');
const path = require('node:path');
const vectors = require(path.resolve(__dirname, '../../backend/data/runner_integrity_vectors.json'));
const engine = require(path.resolve(__dirname, '../public/game-assets/blitz-runner/engine.js'));

for (const vector of vectors) {
  let state = engine.createGame(vector.level, vector.seed);
  for (const direction of vector.actions) {
    const result = engine.advance(state, direction);
    assert.equal(result.ok, true, `level ${vector.level}: action rejected`);
    state = result.state;
  }
  assert.equal(state.status, 'won', `level ${vector.level}: expected win`);
  assert.equal(state.score, vector.score, `level ${vector.level}: score mismatch`);
  assert.equal(state.shards, vector.shards, `level ${vector.level}: shard mismatch`);
  assert.equal(engine.starsFor(state), vector.stars, `level ${vector.level}: stars mismatch`);
}

console.log(`Runner integrity vectors match browser engine (${vectors.length} cases).`);
