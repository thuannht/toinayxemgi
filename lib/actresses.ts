import raw from '../public/actresses.json';
import rarityMap from '../public/rarity-map.json';

export type Actress = {
  name: string;
  href: string;
  videos: number;
  debut: number;
  index: number;
  image_file: string;
  rarity: number;
};

type ActressRaw = {
  name: string;
  href: string;
  videos: number;
  debut: number;
  index: number;
  image_file: string;
};

const rarityByIndex = new Map<number, number>();
for (const [tier, indexes] of Object.entries(rarityMap as Record<string, number[]>)) {
  const rarity = Number(tier);
  for (const index of indexes) rarityByIndex.set(index, rarity);
}

export const actresses: Actress[] = (raw as ActressRaw[]).map((item) => {
  const rarity = rarityByIndex.get(item.index);
  if (rarity === undefined) throw new Error(`Missing rarity for actress index ${item.index}`);
  return { ...item, rarity };
});
