// Post-validation for oracle semantic summaries
// Catches contradictions and schema violations

// Complete keyword abilities list from MTG Comprehensive Rules §702
// Source: https://mtg.wiki/page/Keyword_ability
const VALID_KEYWORDS = new Set([
  // Evergreen
  "deathtouch", "defender", "double strike", "enchant", "equip",
  "first strike", "flash", "flying", "haste", "hexproof",
  "indestructible", "lifelink", "menace", "protection", "reach",
  "trample", "vigilance", "ward",
  // Retired evergreen
  "fear", "intimidate", "shroud",
  // Deciduous
  "cycling", "kicker", "prowess",
  // Historic/set-specific keyword abilities
  "absorb", "affinity", "afterlife", "aftermath", "amplify",
  "annihilator", "aura swap", "awaken", "backup", "banding",
  "bargain", "battle cry", "bestow", "blitz", "boast",
  "bushido", "buyback", "cascade", "casualty", "champion",
  "changeling", "cipher", "cleave", "cloak", "companion",
  "compleated", "conspire", "convoke", "craft", "crew",
  "cumulative upkeep", "dash", "daybound", "decayed", "delve",
  "demonstrate", "dethrone", "devoid", "devour", "disguise",
  "disturb", "dredge", "echo", "embalm", "emerge",
  "encore", "enlist", "entwine", "epic", "escalate",
  "escape", "eternalize", "evoke", "evolve", "exalted",
  "exhaust", "exploit", "extort", "fabricate", "fading",
  "flanking", "flashback", "for mirrodin!", "forecast", "foretell",
  "fortify", "freerunning", "frenzy", "fuse", "gift",
  "graft", "gravestorm", "haunt", "hidden agenda", "hideaway",
  "horsemanship", "impending", "improvise", "infect", "ingest",
  "jump-start", "level up", "living metal", "living weapon",
  "madness", "melee", "mentor", "miracle", "modular",
  "morph", "more than meets the eye", "multikicker", "mutate", "myriad",
  "nightbound", "ninjutsu", "offering", "offspring", "outlast",
  "overload", "partner", "persist", "phasing", "plot",
  "poisonous", "provoke", "prototype", "prowl", "rampage",
  "ravenous", "read ahead", "rebound", "reconfigure", "recover",
  "reinforce", "renown", "replicate", "retrace", "riot",
  "ripple", "saddle", "scavenge", "shadow", "skulk",
  "soulbond", "soulshift", "spectacle", "splice", "split second",
  "spree", "squad", "storm", "sunburst", "surge",
  "suspend", "totem armor", "toxic", "training", "transfigure",
  "transmute", "tribute", "umbra armor", "undaunted", "undying",
  "unearth", "unleash", "vanishing", "wither",
  // Landwalk variants
  "landwalk", "islandwalk", "swampwalk", "mountainwalk", "forestwalk", "plainswalk",
]);

export interface ValidationIssue {
  field: string;
  severity: "error" | "warning";
  message: string;
}

export function validateSemantics(summary: Record<string, unknown>, cardName: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const s = summary as any;

  // === Structural consistency ===

  if (s.targeting?.hasTargeting === false && s.targeting?.targetKinds?.length > 0) {
    issues.push({ field: "targeting", severity: "error", message: "targetKinds is non-empty but hasTargeting is false" });
  }

  if (s.targeting?.hasTargeting === true && (!s.targeting?.targetKinds || s.targeting.targetKinds.length === 0)) {
    issues.push({ field: "targeting", severity: "warning", message: "hasTargeting is true but targetKinds is empty" });
  }

  if (s.structure?.hasManaAbility === true && s.actions?.addsMana === false) {
    issues.push({ field: "structure.hasManaAbility", severity: "warning", message: "hasManaAbility is true but addsMana is false" });
  }

  if (s.structure?.hasTriggeredAbility === false) {
    if (s.structure?.hasEnterBattlefieldTrigger || s.structure?.hasDiesTrigger ||
        s.structure?.hasAttackTrigger || s.structure?.hasUpkeepTrigger ||
        s.structure?.hasLeavesBattlefieldTrigger || s.structure?.hasCombatDamageTrigger ||
        s.structure?.hasBlockTrigger) {
      issues.push({ field: "structure.hasTriggeredAbility", severity: "error", message: "specific trigger is true but hasTriggeredAbility is false" });
    }
  }

  // === Draw card consistency ===

  if (s.actions?.drawsCards === false && (s.actions?.drawsCardsForController || s.actions?.drawsCardsForOpponent)) {
    issues.push({ field: "actions.drawsCards", severity: "error", message: "drawsCardsForController/ForOpponent is true but drawsCards is false" });
  }

  if (s.actions?.drawsCards === true && !s.actions?.drawsCardsForController && !s.actions?.drawsCardsForOpponent) {
    issues.push({ field: "actions.drawsCards", severity: "error", message: "drawsCards is true but neither ForController nor ForOpponent is true" });
  }

  // === Discard consistency ===

  if (s.actions?.discardsCards === false && (s.actions?.discardsForController || s.actions?.forcesOpponentDiscard)) {
    issues.push({ field: "actions.discardsCards", severity: "error", message: "discard sub-field is true but discardsCards is false" });
  }

  // === Life consistency ===

  if (s.actions?.gainsLife === false && (s.actions?.gainsLifeForController || s.actions?.gainsLifeForOpponent)) {
    issues.push({ field: "actions.gainsLife", severity: "error", message: "gainsLife sub-field is true but gainsLife is false" });
  }

  if (s.actions?.causesLifeLoss === false && (s.actions?.causesLifeLossForController || s.actions?.causesLifeLossForOpponent)) {
    issues.push({ field: "actions.causesLifeLoss", severity: "error", message: "causesLifeLoss sub-field is true but causesLifeLoss is false" });
  }

  // === Keyword validation ===

  if (s.actions?.grantedKeywords) {
    for (const kw of s.actions.grantedKeywords) {
      if (!VALID_KEYWORDS.has(kw.toLowerCase())) {
        issues.push({ field: "actions.grantedKeywords", severity: "error", message: `"${kw}" is not a valid MTG keyword. Use grantsEvasion for "can't be blocked" effects.` });
      }
    }
  }

  // === Modal consistency ===

  if (s.structure?.hasModalChoice === true && (s.structure?.modalCount === null || s.structure?.modalCount === 0)) {
    issues.push({ field: "structure.modalCount", severity: "warning", message: "hasModalChoice is true but modalCount is null/0" });
  }

  if (s.structure?.hasModalChoice === false && s.structure?.modalCount > 0) {
    issues.push({ field: "structure.hasModalChoice", severity: "error", message: "modalCount > 0 but hasModalChoice is false" });
  }

  // === Actions that imply references ===

  if (s.actions?.destroysCreature && !s.references?.mentionsCreature) {
    issues.push({ field: "references.mentionsCreature", severity: "warning", message: "destroysCreature is true but mentionsCreature is false" });
  }

  if (s.actions?.searchesLibrary && !s.references?.mentionsLibrary) {
    issues.push({ field: "references.mentionsLibrary", severity: "warning", message: "searchesLibrary is true but mentionsLibrary is false" });
  }

  if ((s.actions?.reanimatesSelf || s.actions?.reanimatesOther || s.actions?.exilesFromGraveyard) && !s.references?.mentionsGraveyard) {
    issues.push({ field: "references.mentionsGraveyard", severity: "warning", message: "graveyard action is true but mentionsGraveyard is false" });
  }

  // === Battlefield consistency ===

  if (s.battlefield?.alwaysEntersTapped && s.battlefield?.canEnterUntapped) {
    issues.push({ field: "battlefield", severity: "error", message: "alwaysEntersTapped and canEnterUntapped are both true" });
  }

  if (s.battlefield?.conditionallyEntersTapped && s.battlefield?.alwaysEntersTapped) {
    issues.push({ field: "battlefield", severity: "error", message: "conditionallyEntersTapped and alwaysEntersTapped are both true" });
  }

  return issues;
}
