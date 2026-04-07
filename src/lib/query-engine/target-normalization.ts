// Normalizes raw targetKinds strings from Sonnet classification into structured objects.
// Based on MTG Comprehensive Rules:
//   Rule 115.2: Only permanents (battlefield), spells (stack), and players are default targets
//   Rule 110.1: Permanent = card/token on the battlefield
//   Rule 112.1: Spell = card on the stack
//   "target creature" = battlefield; "target creature card" = graveyard; "target creature spell" = stack
//   "any target" = creature, player, planeswalker, or battle (rule 115.4)

export type TargetZone = "battlefield" | "stack" | "graveyard" | "exile" | "ante" | null;

export type TargetBaseKind =
  | "creature" | "artifact" | "enchantment" | "land" | "planeswalker" | "battle"
  | "permanent" | "spell" | "player" | "opponent" | "card" | "token"
  | "instant" | "sorcery" | "ability" | "any_target";

export interface NormalizedTargetKind {
  raw: string;
  baseKinds: TargetBaseKind[];
  zone: TargetZone;
  constraints: string[];
}

// Mapping from raw Sonnet-generated targetKinds to normalized form.
// Sources: MTG Comprehensive Rules §109.2, §110.1, §112.1, §115.2, §115.4
// Verified against https://mtg.wiki/page/Target, /page/Permanent, /page/Spell
const RAW_TO_NORMALIZED: Record<string, NormalizedTargetKind> = {
  // === Battlefield permanents ===
  "creature":                   { raw: "creature",                   baseKinds: ["creature"],             zone: "battlefield", constraints: [] },
  "artifact":                   { raw: "artifact",                   baseKinds: ["artifact"],             zone: "battlefield", constraints: [] },
  "enchantment":                { raw: "enchantment",                baseKinds: ["enchantment"],          zone: "battlefield", constraints: [] },
  "land":                       { raw: "land",                       baseKinds: ["land"],                 zone: "battlefield", constraints: [] },
  "planeswalker":               { raw: "planeswalker",               baseKinds: ["planeswalker"],         zone: "battlefield", constraints: [] },
  "permanent":                  { raw: "permanent",                  baseKinds: ["permanent"],            zone: "battlefield", constraints: [] },
  "nonland permanent":          { raw: "nonland permanent",          baseKinds: ["permanent"],            zone: "battlefield", constraints: ["nonland"] },
  "nonland_permanent":          { raw: "nonland_permanent",          baseKinds: ["permanent"],            zone: "battlefield", constraints: ["nonland"] },
  "noncreature permanent":      { raw: "noncreature permanent",      baseKinds: ["permanent"],            zone: "battlefield", constraints: ["noncreature"] },
  "colorless nonland permanent":{ raw: "colorless nonland permanent", baseKinds: ["permanent"],            zone: "battlefield", constraints: ["colorless", "nonland"] },
  "nonbasic land":              { raw: "nonbasic land",              baseKinds: ["land"],                 zone: "battlefield", constraints: ["nonbasic"] },
  "artifact creature":          { raw: "artifact creature",          baseKinds: ["artifact", "creature"], zone: "battlefield", constraints: [] },
  "creature you control":       { raw: "creature you control",       baseKinds: ["creature"],             zone: "battlefield", constraints: ["you_control"] },
  "tapped_creature":            { raw: "tapped_creature",            baseKinds: ["creature"],             zone: "battlefield", constraints: ["tapped"] },
  "tapped creature":            { raw: "tapped creature",            baseKinds: ["creature"],             zone: "battlefield", constraints: ["tapped"] },
  "token":                      { raw: "token",                      baseKinds: ["token"],                zone: "battlefield", constraints: [] },

  // === Stack (spells and abilities) ===
  "spell":                      { raw: "spell",                      baseKinds: ["spell"],                zone: "stack",       constraints: [] },
  "noncreature spell":          { raw: "noncreature spell",          baseKinds: ["spell"],                zone: "stack",       constraints: ["noncreature"] },
  "creature spell":             { raw: "creature spell",             baseKinds: ["spell"],                zone: "stack",       constraints: ["creature"] },
  "ability":                    { raw: "ability",                    baseKinds: ["ability"],              zone: "stack",       constraints: [] },

  // === Graveyard (cards) ===
  "creature card in graveyard":                  { raw: "creature card in graveyard",                  baseKinds: ["creature"],            zone: "graveyard", constraints: [] },
  "creature_card_in_graveyard":                  { raw: "creature_card_in_graveyard",                  baseKinds: ["creature"],            zone: "graveyard", constraints: [] },
  "artifact card in graveyard":                  { raw: "artifact card in graveyard",                  baseKinds: ["artifact"],            zone: "graveyard", constraints: [] },
  "land card in graveyard":                      { raw: "land card in graveyard",                      baseKinds: ["land"],                zone: "graveyard", constraints: [] },
  "land_cards_in_graveyard":                     { raw: "land_cards_in_graveyard",                     baseKinds: ["land"],                zone: "graveyard", constraints: [] },
  "instant or sorcery card in graveyard":        { raw: "instant or sorcery card in graveyard",        baseKinds: ["instant", "sorcery"],   zone: "graveyard", constraints: [] },
  "instant_or_sorcery_card_in_graveyard":        { raw: "instant_or_sorcery_card_in_graveyard",        baseKinds: ["instant", "sorcery"],   zone: "graveyard", constraints: [] },
  "instant card in graveyard":                   { raw: "instant card in graveyard",                   baseKinds: ["instant"],             zone: "graveyard", constraints: [] },
  "sorcery card in graveyard":                   { raw: "sorcery card in graveyard",                   baseKinds: ["sorcery"],             zone: "graveyard", constraints: [] },
  "card in graveyard":                           { raw: "card in graveyard",                           baseKinds: ["card"],                zone: "graveyard", constraints: [] },
  "permanent card in graveyard":                 { raw: "permanent card in graveyard",                 baseKinds: ["card"],                zone: "graveyard", constraints: ["permanent_type"] },

  // === Players ===
  "player":                     { raw: "player",                     baseKinds: ["player"],               zone: null,          constraints: [] },
  "opponent":                   { raw: "opponent",                   baseKinds: ["player", "opponent"],    zone: null,          constraints: [] },

  // === "Any target" = creature, player, planeswalker, battle (rule 115.4) ===
  "any target":                 { raw: "any target",                 baseKinds: ["any_target"],           zone: null,          constraints: [] },
  "any_target":                 { raw: "any_target",                 baseKinds: ["any_target"],           zone: null,          constraints: [] },
  "any":                        { raw: "any",                        baseKinds: ["any_target"],           zone: null,          constraints: [] },

  // === Rare/edge cases ===
  "card in ante":               { raw: "card in ante",               baseKinds: ["card"],                zone: "ante",        constraints: [] },
};

// "any_target" expands to these baseKinds for matching purposes
const ANY_TARGET_KINDS: TargetBaseKind[] = ["creature", "player", "planeswalker", "battle"];

// Default zone for each base kind when a player asks a plain question like "does it target a creature?"
// Per MTG rules: creature/artifact/enchantment/land/planeswalker/permanent = battlefield
//                spell = stack, player/opponent = null (no zone)
const DEFAULT_ZONES: Partial<Record<string, TargetZone>> = {
  creature: "battlefield",
  artifact: "battlefield",
  enchantment: "battlefield",
  land: "battlefield",
  planeswalker: "battlefield",
  battle: "battlefield",
  permanent: "battlefield",
  token: "battlefield",
  spell: "stack",
  ability: "stack",
  player: null,
  opponent: null,
};

export function normalizeTargetKinds(rawKinds: string[]): NormalizedTargetKind[] {
  return rawKinds.map(raw => {
    const normalized = RAW_TO_NORMALIZED[raw.toLowerCase()];
    if (normalized) return normalized;

    // Fallback: unknown raw value — preserve it with best-effort zone detection
    const lower = raw.toLowerCase();
    const zone: TargetZone = lower.includes("graveyard") ? "graveyard"
      : lower.includes("exile") ? "exile"
      : lower.includes("spell") ? "stack"
      : "battlefield";
    return { raw, baseKinds: ["card" as TargetBaseKind], zone, constraints: [] };
  });
}

/**
 * Check if a card's normalized targets include a given base kind.
 * Uses zone-aware matching: "creature" only matches battlefield creatures,
 * not creature cards in graveyard.
 */
export function matchesTargetKind(
  normalizedTargets: NormalizedTargetKind[],
  queryKind: string
): boolean {
  const defaultZone = DEFAULT_ZONES[queryKind];

  for (const target of normalizedTargets) {
    // Handle "any_target" expansion
    const effectiveBaseKinds = target.baseKinds.includes("any_target")
      ? [...target.baseKinds, ...ANY_TARGET_KINDS]
      : target.baseKinds;

    if (effectiveBaseKinds.includes(queryKind as TargetBaseKind)) {
      // Zone-aware matching: if the query kind has a default zone,
      // only match if the target is in that zone (or zone is null for players)
      if (defaultZone === undefined) {
        // Unknown query kind — match any zone
        return true;
      }
      if (defaultZone === null && target.zone === null) {
        return true;
      }
      if (defaultZone === target.zone) {
        return true;
      }
      // "any_target" has zone null but should match battlefield creatures etc.
      if (target.baseKinds.includes("any_target") && defaultZone === "battlefield") {
        return true;
      }
      if (target.baseKinds.includes("any_target") && defaultZone === null) {
        return true;
      }
    }

    // "permanent" should match specific permanent types on the battlefield
    if (queryKind === "permanent" && target.zone === "battlefield") {
      const permanentTypes: TargetBaseKind[] = ["creature", "artifact", "enchantment", "land", "planeswalker", "battle", "permanent", "token"];
      if (effectiveBaseKinds.some(k => permanentTypes.includes(k))) {
        return true;
      }
    }

    // Specific permanent type should match "permanent" targets
    const permanentSubtypes: string[] = ["creature", "artifact", "enchantment", "land", "planeswalker", "battle"];
    if (permanentSubtypes.includes(queryKind) && target.zone === "battlefield" && effectiveBaseKinds.includes("permanent")) {
      return true;
    }
  }

  return false;
}
