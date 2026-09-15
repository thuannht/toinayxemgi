const assert = require('node:assert/strict');

function chooseUniform(items, random = Math.random) {
  if (!items.length) throw new Error('No eligible items');
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random draw must be in [0,1)');
  return items[Math.min(items.length - 1, Math.floor(draw * items.length))];
}

const RARITY_WEIGHTS = [0.8, 0.16, 0.035, 0.005];

function chooseWeightedByRarity(items, random = Math.random) {
  const byTier = [[], [], [], []];
  for (const item of items) byTier[item.rarity].push(item);
  const present = RARITY_WEIGHTS.map((w, tier) => ({ tier, w, pool: byTier[tier] })).filter((x) => x.pool.length);
  const weightSum = present.reduce((s, x) => s + x.w, 0);
  let draw = random() * weightSum;
  let chosen = present[present.length - 1];
  for (const entry of present) {
    draw -= entry.w;
    if (draw < 0) {
      chosen = entry;
      break;
    }
  }
  return chooseUniform(chosen.pool, random);
}

assert.equal(chooseUniform(['a', 'b', 'c'], () => 0), 'a');
assert.equal(chooseUniform(['a', 'b', 'c'], () => 0.99), 'c');
assert.throws(() => chooseUniform([]));

const pool = [
  { rarity: 0, id: 'b1' },
  { rarity: 0, id: 'b2' },
  { rarity: 1, id: 'p1' },
  { rarity: 2, id: 'r1' },
  { rarity: 3, id: 'g1' },
];
assert.equal(chooseWeightedByRarity(pool, () => 0).rarity, 0);
assert.equal(chooseWeightedByRarity(pool, () => 0.85).rarity, 1);
console.log('PASS: chooseUniform + chooseWeightedByRarity');
