export interface CardAttributes {
  colors: string[] | null;
  colorIdentity: string[] | null;
  types: string[] | null;
  subtypes: string[] | null;
  supertypes: string[] | null;
  cmc: number | null;
  manaCost: string | null;
  power: string | null;
  toughness: string | null;
  keywords: string[] | null;
  abilities: string[] | null;
  rarity: string | null;
  isMulticolor: boolean | null;
}

export function emptyAttributes(): CardAttributes {
  return {
    colors: null,
    colorIdentity: null,
    types: null,
    subtypes: null,
    supertypes: null,
    cmc: null,
    manaCost: null,
    power: null,
    toughness: null,
    keywords: null,
    abilities: null,
    rarity: null,
    isMulticolor: null,
  };
}

export function mergeAttributes(
  existing: CardAttributes,
  incoming: Partial<CardAttributes>
): CardAttributes {
  const result = { ...existing };

  for (const key of Object.keys(incoming) as (keyof CardAttributes)[]) {
    const val = incoming[key];
    if (val === null || val === undefined) continue;

    if (Array.isArray(val)) {
      const existingArr = result[key] as string[] | null;
      if (existingArr === null) {
        (result[key] as string[]) = val as string[];
      } else {
        // Union arrays
        const set = new Set([...(existingArr as string[]), ...(val as string[])]);
        (result[key] as string[]) = Array.from(set);
      }
    } else {
      // Scalar — overwrite
      (result as Record<string, unknown>)[key] = val;
    }
  }

  return result;
}
