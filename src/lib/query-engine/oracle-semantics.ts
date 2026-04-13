// Oracle Semantic Summary — generated once per card at build time by Sonnet/Opus
// Runtime resolvers query this deterministically. No LLM calls at runtime.

export interface OracleSemanticSummary {
  schemaVersion: 1 | 2;

  // ============================================================
  // STRUCTURE — ability shapes and structural facts
  // ============================================================
  structure: {
    hasTriggeredAbility: boolean;
    hasActivatedAbility: boolean;
    hasStaticAbility: boolean;
    hasReplacementEffect: boolean;
    hasPreventionEffect: boolean;

    hasEnterBattlefieldTrigger: boolean;
    hasLeavesBattlefieldTrigger: boolean;
    hasDiesTrigger: boolean;
    hasAttackTrigger: boolean;
    hasBlockTrigger: boolean;
    hasUpkeepTrigger: boolean;
    hasCombatDamageTrigger: boolean;
    hasBeginningOfCombatTrigger?: boolean;
    hasEndStepTrigger?: boolean;
    hasDrawStepTrigger?: boolean;
    hasEndOfCombatTrigger?: boolean;

    hasModalChoice: boolean;
    modalCount: number | null; // number of modes, null if not modal
    modalKind: string[]; // "choose_one", "choose_two", "bulleted_modes", "spree", etc.

    hasAdditionalCost: boolean;
    hasAlternativeCost: boolean;
    hasOptionalAdditionalCost: boolean; // kicker, entwine, etc.

    hasManaAbility: boolean;
    hasNonManaActivatedAbility: boolean;

    namedMechanics: string[]; // cycling, flashback, kicker, landfall, cascade, etc.
  };

  // ============================================================
  // ACTIONS — what the card's effects DO
  // ============================================================
  actions: {
    // Card draw — split by who draws
    drawsCards: boolean;              // any player draws from this card's effects
    drawsCardsForController: boolean; // the controller specifically draws
    drawsCardsForOpponent: boolean;   // an opponent specifically draws

    // Discard — split by who discards
    discardsCards: boolean;              // any player discards from this card's effects
    discardsForController: boolean;      // controller discards (as cost or effect)
    forcesOpponentDiscard: boolean;      // opponent is forced to discard

    // Mill
    millsCards: boolean;
    surveils: boolean;
    scries: boolean;
    looksAtTopOfLibrary: boolean;
    searchesLibrary: boolean;
    shufflesLibrary: boolean;

    // Tokens
    createsTokens: boolean;
    createdTokenTypes: string[]; // "Treasure", "1/1 white Soldier", "Food", etc.

    // Mana
    addsMana: boolean;
    addedManaColors: string[]; // "W", "U", "B", "R", "G", "C"
    canAddAnyColor: boolean;
    canAddMultipleColors: boolean;
    filtersMana: boolean;

    // Damage
    dealsDamage: boolean;
    damageTargets: string[]; // "creature", "player", "opponent", "any_target", etc.

    // Destruction
    destroysCreature: boolean;
    destroysArtifact: boolean;
    destroysEnchantment: boolean;
    destroysLand: boolean;
    destroysPermanent: boolean; // "nonland permanent" etc.

    // Exile
    exilesCreature: boolean;
    exilesArtifact: boolean;
    exilesEnchantment: boolean;
    exilesLand: boolean;
    exilesPermanent: boolean;
    exilesFromGraveyard: boolean;
    exilesFromLibrary: boolean;
    exilesFromHand: boolean;

    // Return / reanimate
    reanimatesSelf: boolean; // returns itself from graveyard to battlefield
    reanimatesOther: boolean; // returns other cards from graveyard to battlefield
    returnsToHand: boolean; // returns things to hand (from graveyard or battlefield)
    bouncesCreature: boolean; // returns creature to hand from battlefield
    bouncesPermanent: boolean;

    // Counter
    countersSpells: boolean;

    // Copy
    copiesSpells: boolean;
    copiesPermanents: boolean;

    // Tap/untap
    tapsThings: boolean;
    untapsThings: boolean;

    // Keywords/stats
    grantsKeywords: boolean;
    grantedKeywords: string[]; // ONLY real MTG keywords: flying, trample, haste, etc. NOT "unblockable" (that's rules text, not a keyword)
    grantsEvasion: boolean; // grants "can't be blocked" or similar evasion that isn't a keyword
    grantsPTBonus: boolean;
    grantsPTPenalty: boolean;
    modifiesPower: boolean;
    modifiesToughness: boolean;
    usesPlusOneCounters: boolean;
    usesMinusOneCounters: boolean;
    addsOtherCounters: boolean;
    otherCounterTypes: string[]; // "loyalty", "charge", "time", etc.

    // Sacrifice
    sacrificesOwnPermanent: boolean;
    forcesOpponentSacrifice: boolean;

    // Land
    fetchesLand: boolean;
    fetchesBasicLand: boolean;
    fetchesBasicLandOnly?: boolean;
    fetchesNonbasicLand?: boolean;
    fetchedLandTypes?: string[];
    letsPlayExtraLands: boolean;

    // Life — split by who is affected
    gainsLife: boolean;                  // any player gains life
    gainsLifeForController: boolean;     // controller gains life
    gainsLifeForOpponent: boolean;       // opponent gains life
    causesLifeLoss: boolean;             // any player loses life
    causesLifeLossForController: boolean; // controller loses/pays life
    causesLifeLossForOpponent: boolean;  // opponent loses life
    paysLife: boolean;                   // controller pays life as a cost

    // Special
    takesExtraTurn: boolean;
    preventsDamage: boolean;
    redirectsDamage: boolean;
    animatesSelf: boolean; // becomes a creature
    animatesOtherPermanent: boolean;
    makesMonarch: boolean;
    createsEmblem: boolean;

    // Restrictions
    restrictsActions: boolean; // prevents casting, attacking, etc.
    taxesOpponent: boolean; // makes opponent pay extra
    reducesCosts: boolean; // makes spells cheaper

    // Phase/flicker
    phaseOut: boolean;
    flickersOrBlinks: boolean; // exile and return

    // v2 additions
    grantsAlternativeCostToOtherSpells?: boolean;
    sacrificesSelf?: boolean;
    canCastFromGraveyard?: boolean;
    hasEvasion?: boolean;
    isRemoval?: boolean;
    protectsSelf?: boolean;
    protectsOthers?: boolean;
    providesCardAdvantage?: boolean;
    providesCardSelection?: boolean;
    payoffForCastingSpells?: boolean;
    payoffForCastingInstantsOrSorceries?: boolean;
  };

  // ============================================================
  // CONDITIONS — what the card CARES ABOUT / triggers on
  // ============================================================
  conditions: {
    caresAboutCreatures: boolean;
    caresAboutArtifacts: boolean;
    caresAboutEnchantments: boolean;
    caresAboutLands: boolean;
    caresAboutNonbasicLands: boolean;
    caresAboutGraveyard: boolean;
    caresAboutCardsDrawn: boolean;
    caresAboutDiscard: boolean;
    caresAboutLifeGainOrLoss: boolean;
    caresAboutCounters: boolean;
    caresAboutCastingSpells: boolean;
    caresAboutControllerCastingSpells?: boolean;
    caresAboutOpponentCastingSpells?: boolean;
    caresAboutInstantsAndSorceries: boolean;
    caresAboutDeath: boolean;
    caresAboutEnterBattlefield: boolean;
    caresAboutLeaveBattlefield: boolean;
    caresAboutCombat: boolean;
    caresAboutDamage: boolean;
    caresAboutTappedUntappedState: boolean;
    caresAboutColors: boolean;
    caresAboutManaSpent: boolean;
    caresAboutPowerOrToughness: boolean;
    caresAboutTokens: boolean;
    caresAboutEquipment: boolean;
    caresAboutAuras: boolean;
  };

  // ============================================================
  // REFERENCES — things merely mentioned in rules text
  // ============================================================
  references: {
    mentionsCreature: boolean;
    mentionsArtifact: boolean;
    mentionsEnchantment: boolean;
    mentionsLand: boolean;
    mentionsPlaneswalker: boolean;
    mentionsGraveyard: boolean;
    mentionsLibrary: boolean;
    mentionsHand: boolean;
    mentionsExile: boolean;
    mentionsOpponent: boolean;
    mentionsPlayer: boolean;
    mentionsCombat: boolean;
  };

  // ============================================================
  // BATTLEFIELD — entering/state semantics
  // ============================================================
  battlefield: {
    entersTapped: boolean;
    canEnterUntapped: boolean;
    alwaysEntersTapped: boolean;
    conditionallyEntersTapped: boolean;
  };

  // ============================================================
  // TARGETING — what the card targets
  // ============================================================
  targeting: {
    hasTargeting: boolean;
    targetKinds: string[]; // "creature", "player", "spell", "permanent", "card_in_graveyard", etc.
  };

  // ============================================================
  // ANIMATED — stats when card becomes a creature (v2)
  // ============================================================
  animated?: {
    animatesSelf: boolean;
    animatedPower: number | null;
    animatedToughness: number | null;
    animatedKeywords: string[];
    animatedCreatureType: string | null;
  };

  // ============================================================
  // CONDITIONALITY — type/status changes
  // ============================================================
  conditionality: {
    typeChangesConditionally: boolean; // Theros gods
    faceDependent: boolean; // DFC
    notes: string[]; // brief explanations for edge cases
  };

  // ============================================================
  // AUDIT — for debugging and review
  // ============================================================
  audit: {
    shortRationale: string; // 1-2 sentence summary of what the card does
    flaggedAmbiguities: string[]; // things the model wasn't sure about
  };
}
