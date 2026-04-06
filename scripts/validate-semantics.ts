// Post-validation for oracle semantic summaries
// Catches contradictions and schema violations

const VALID_KEYWORDS = new Set([
  "flying", "first strike", "double strike", "deathtouch", "haste",
  "hexproof", "indestructible", "lifelink", "menace", "reach",
  "trample", "vigilance", "ward", "flash", "defender", "prowess",
  "shroud", "fear", "intimidate", "skulk", "shadow", "horsemanship",
  "protection", "banding", "flanking", "rampage", "phasing",
  "landwalk", "islandwalk", "swampwalk", "mountainwalk", "forestwalk", "plainswalk",
  "wither", "infect", "persist", "undying", "cascade", "storm",
  "affinity", "convoke", "delve", "dredge", "devoid", "annihilator",
  "modular", "ninjutsu", "bushido", "soulshift", "splice",
  "absorb", "changeling", "totem armor", "bestow", "outlast",
  "dash", "exploit", "renown", "skulk", "emerge", "partner",
  "companion", "mutate", "escape", "foretell", "daybound", "nightbound",
  "disturb", "cleave", "training", "compleated", "reconfigure",
  "blitz", "casualty", "enlist", "read ahead", "prototype",
  "craft", "discover", "disguise", "cloak", "saddle", "offspring",
  "riot", "adapt", "afterlife", "spectacle", "extort",
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

  if (s.targeting?.targetsOnCastOrActivation === false && s.targeting?.targetKinds?.length > 0) {
    issues.push({ field: "targeting", severity: "error", message: "targetKinds is non-empty but targetsOnCastOrActivation is false" });
  }

  if (s.targeting?.targetsOnCastOrActivation === true && (!s.targeting?.targetKinds || s.targeting.targetKinds.length === 0)) {
    issues.push({ field: "targeting", severity: "warning", message: "targetsOnCastOrActivation is true but targetKinds is empty" });
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
