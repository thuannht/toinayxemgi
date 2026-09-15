// CS:GO Panorama timing reconstructed from popup_capability_decodable.js/.css.
// Reference: https://github.com/Desynci/CSGO_Panorama_Code.pbin
export const OPENING_DELAY_MS = 2400;
export const SPIN_DURATION_MS = 6000;
export const TICK_SECONDS = [
  0, 0.063, 0.125, 0.188, 0.25, 0.313, 0.375, 0.438, 0.5, 0.563, 0.625, 0.688, 0.75, 0.813, 0.875,
  0.938, 1, 1.063, 1.125, 1.188, 1.25, 1.313, 1.375, 1.483, 1.351, 1.62, 1.701, 1.786, 1.872, 2.003,
  2.154, 2.313, 2.466, 2.615, 2.773, 2.941, 3.104, 3.339, 3.63, 3.953, 4.385, 5.004,
].sort((a, b) => a - b);

export function caseEase(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 30; i++) {
    const t = (lo + hi) / 2,
      u = 1 - t,
      x = 3 * u * u * t * 0.075 + 3 * u * t * t * 0.165 + t * t * t;
    if (x < p) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2,
    u = 1 - t;
  return 3 * u * u * t * 0.82 + 3 * u * t * t + t * t * t;
}

export function stopFraction(random = Math.random) {
  return (Math.floor(random() * 81) + 10) / 100;
}

export function chooseUniform<T>(items: T[], random = Math.random): T {
  if (!items.length) throw new Error('No eligible items');
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('Random draw must be in [0,1)');
  return items[Math.min(items.length - 1, Math.floor(draw * items.length))];
}

/** Tier weights: blue 80%, purple 16%, red 3.5%, gold 0.5%. */
export const RARITY_WEIGHTS = [0.8, 0.16, 0.035, 0.005] as const;

type RareItem = { rarity: number };

function shuffleInPlace<T>(items: T[], random = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Random subset of `size` that keeps catalog rarity mix.
 * When size >= number of tiers present, every tier gets at least one item
 * so gacha weights (RARITY_WEIGHTS) still apply.
 */
export function samplePoolByRarity<T extends RareItem>(
  population: T[],
  size: number,
  random = Math.random,
): T[] {
  if (size <= 0) return [];
  if (size >= population.length) return shuffleInPlace([...population], random);

  const byTier: T[][] = [[], [], [], []];
  for (const item of population) {
    if (item.rarity >= 0 && item.rarity <= 3) byTier[item.rarity].push(item);
  }
  const present = [0, 1, 2, 3].filter((t) => byTier[t].length > 0);
  if (!present.length) return [];

  const total = population.length;
  const ideal = byTier.map((pool) => (pool.length / total) * size);
  const counts = ideal.map((x) => Math.floor(x));
  let remain = size - counts.reduce((a, b) => a + b, 0);
  const fracOrder = ideal
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remain; k++) counts[fracOrder[k].i]++;

  if (size >= present.length) {
    for (const tier of present) {
      if (counts[tier] > 0) continue;
      const donor = [...present]
        .filter((i) => counts[i] > 1)
        .sort((a, b) => counts[b] - counts[a])[0];
      if (donor === undefined) break;
      counts[donor]--;
      counts[tier]++;
    }
  }

  for (let t = 0; t < 4; t++) counts[t] = Math.min(counts[t], byTier[t].length);

  let sum = counts.reduce((a, b) => a + b, 0);
  while (sum < size) {
    const tier = present.find((i) => counts[i] < byTier[i].length);
    if (tier === undefined) break;
    counts[tier]++;
    sum++;
  }

  const picked: T[] = [];
  for (let t = 0; t < 4; t++) {
    if (counts[t] <= 0) continue;
    const pool = shuffleInPlace([...byTier[t]], random);
    picked.push(...pool.slice(0, counts[t]));
  }
  return shuffleInPlace(picked, random);
}

export function chooseWeightedByRarity<T extends RareItem>(items: T[], random = Math.random): T {
  if (!items.length) throw new Error('No eligible items');
  const byTier: T[][] = [[], [], [], []];
  for (const item of items) {
    if (item.rarity >= 0 && item.rarity <= 3) byTier[item.rarity].push(item);
  }
  const present = RARITY_WEIGHTS.map((w, tier) => ({ tier, w, pool: byTier[tier] })).filter((x) => x.pool.length);
  if (!present.length) throw new Error('No eligible tiers');
  const weightSum = present.reduce((s, x) => s + x.w, 0);
  let draw = random() * weightSum;
  if (!Number.isFinite(draw) || draw < 0) throw new Error('Random draw must be in [0,1)');
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

// Cosmetic motion is independent of reward selection.
export function createSpinProfile(random = Math.random) {
  return {
    durationMs: 7500 + Math.floor(random() * 2001),
    tiles: 30 + Math.floor(random() * 11),
    friction: 2.7 + random() * 0.6,
  };
}

export function spinProgress(progress: number, friction: number) {
  const p = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - p, friction);
}
