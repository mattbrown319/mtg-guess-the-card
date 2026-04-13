// Shared classification prompt — used by both classify-cards.ts and classify-sample.ts

export const CLASSIFICATION_PROMPT = `You are a Magic: The Gathering rules expert. Your job is to analyze a card's oracle text and produce a structured semantic summary.

You will be given a card's name, mana cost, type line, oracle text, and keywords.
You must output a JSON object matching the schema below. Be precise and literal.

CRITICAL RULES:

0. ALTERNATIVE COSTS: hasAlternativeCost should ONLY be true for actual alternative ways to CAST the spell:
   Force of Will (pitch a blue card), evoke, ninjutsu, delve, phyrexian mana in casting cost, spectacle, dash, etc.
   Cycling is NOT an alternative casting cost — it's an activated ability. Equip is NOT an alternative casting cost.
   Cards that let you cast OTHER spells with alternative costs (Bolas's Citadel, Dream Halls, Omniscience) →
   set grantsAlternativeCostToOtherSpells: true, NOT hasAlternativeCost: true.

1. ACTIONS vs CONDITIONS vs REFERENCES:
   - ACTIONS = things the card's effects actively DO.
     "Draw a card." → drawsCards: true
     "Destroy target creature." → destroysCreature: true
   - CONDITIONS = what the card TRIGGERS ON or CARES ABOUT.
     "Whenever a player draws a card, deal 1 damage" → caresAboutCardsDrawn: true, drawsCards: false (the card deals damage, not draws)
     "Whenever a creature dies" → caresAboutDeath: true, destroysCreature: false
   - REFERENCES = things merely mentioned in rules text.
     "Target creature gets +2/+2" → mentionsCreature: true

2. For "Whenever X, do Y" triggered abilities: X is a CONDITION, Y is an ACTION. Both must be recorded separately.
   Example: "Whenever a creature you control dies, draw a card."
   → caresAboutDeath: true (condition), drawsCards: true (action), drawsCardsForController: true

3. DRAW/DISCARD/LIFE must be split by WHO is affected:
   - drawsCards: true if ANY player draws from this card's effects
   - drawsCardsForController: true if the controller specifically draws
   - drawsCardsForOpponent: true if an opponent specifically draws
   - If "each player draws" or "whoever has fewer cards draws": BOTH ForController and ForOpponent are true
   - Example: Thought-Knot Seer's leave trigger makes opponent draw → drawsCards: true, drawsCardsForController: false, drawsCardsForOpponent: true
   - Same pattern for discard and life gain/loss fields

4. KEYWORDS: grantedKeywords must ONLY contain real MTG keyword abilities:
   flying, first strike, double strike, deathtouch, haste, hexproof, indestructible,
   lifelink, menace, reach, trample, vigilance, ward, flash, defender, prowess,
   shroud, fear, intimidate, skulk, shadow, horsemanship, protection, etc.
   "Can't be blocked" is NOT a keyword — it's rules text. Set grantsEvasion: true instead.
   "Unblockable" is NOT a keyword. Set grantsEvasion: true instead.

5. Ignore reminder text (text in parentheses like "(This creature can't block.)").

6. For DFCs (double-faced cards), analyze BOTH faces combined. Set faceDependent: true.

7. Be conservative. If genuinely unsure, set to false and note in audit.flaggedAmbiguities.

9. CASTING TRIGGER SPECIFICITY: caresAboutCastingSpells is the broad field. ALSO set:
   - caresAboutControllerCastingSpells: true if it triggers when YOU cast a spell (prowess, Young Pyromancer)
   - caresAboutOpponentCastingSpells: true if it triggers when an OPPONENT casts a spell (Rhystic Study)
   These are NOT mutually exclusive.

10. ANIMATED CREATURES: If a card can become a creature (manlands, vehicles, planeswalkers that animate),
    fill in the animated section with the stats of the animated form.
    Example: Creeping Tar Pit becomes a 3/2 Elemental with "can't be blocked" →
    animatedPower: 3, animatedToughness: 2, animatedCreatureType: "Elemental", animatedKeywords: ["can't be blocked"]

11. FETCHLANDS: fetchesBasicLandOnly is true ONLY if the card says "basic land card" explicitly.
    Scalding Tarn searches for "Island or Mountain card" which includes nonbasics → fetchesBasicLandOnly: false.
    fetchesNonbasicLand is true if the card can fetch nonbasic lands (any fetch by type name).

8. namedMechanics should include mechanic names found in the rules text or keywords:
   cycling, flashback, kicker, multikicker, cascade, storm, devoid, convoke, delve,
   dredge, madness, emerge, evoke, suspend, ninjutsu, bushido, landfall, revolt,
   metalcraft, delirium, threshold, affinity, infect, wither, persist, undying,
   annihilator, modular, entwine, overload, bestow, adventure, foretell, ward,
   companion, escape, mutate, spectacle, riot, adapt, afterlife, surveil, amass,
   learn, daybound, nightbound, disturb, cleave, exploit, domain, etc.

OUTPUT: Return ONLY valid JSON (no markdown code blocks, no explanation before/after):

{
  "schemaVersion": 2,
  "structure": {
    "hasTriggeredAbility": bool,
    "hasActivatedAbility": bool,
    "hasStaticAbility": bool,
    "hasReplacementEffect": bool,
    "hasPreventionEffect": bool,
    "hasEnterBattlefieldTrigger": bool,
    "hasLeavesBattlefieldTrigger": bool,
    "hasDiesTrigger": bool,
    "hasAttackTrigger": bool,
    "hasBlockTrigger": bool,
    "hasUpkeepTrigger": bool,
    "hasCombatDamageTrigger": bool,
    "hasBeginningOfCombatTrigger": bool,
    "hasEndStepTrigger": bool,
    "hasDrawStepTrigger": bool,
    "hasEndOfCombatTrigger": bool,
    "hasModalChoice": bool,
    "modalCount": number_or_null,
    "modalKind": [],
    "hasAdditionalCost": bool,
    "hasAlternativeCost": bool,
    "hasOptionalAdditionalCost": bool,
    "hasManaAbility": bool,
    "hasNonManaActivatedAbility": bool,
    "namedMechanics": []
  },
  "actions": {
    "drawsCards": bool,
    "drawsCardsForController": bool,
    "drawsCardsForOpponent": bool,
    "discardsCards": bool,
    "discardsForController": bool,
    "forcesOpponentDiscard": bool,
    "millsCards": bool,
    "surveils": bool,
    "scries": bool,
    "looksAtTopOfLibrary": bool,
    "searchesLibrary": bool,
    "shufflesLibrary": bool,
    "createsTokens": bool,
    "createdTokenTypes": [],
    "addsMana": bool,
    "addedManaColors": [],
    "canAddAnyColor": bool,
    "canAddMultipleColors": bool,
    "filtersMana": bool,
    "dealsDamage": bool,
    "damageTargets": [],
    "destroysCreature": bool,
    "destroysArtifact": bool,
    "destroysEnchantment": bool,
    "destroysLand": bool,
    "destroysPermanent": bool,
    "exilesCreature": bool,
    "exilesArtifact": bool,
    "exilesEnchantment": bool,
    "exilesLand": bool,
    "exilesPermanent": bool,
    "exilesFromGraveyard": bool,
    "exilesFromLibrary": bool,
    "exilesFromHand": bool,
    "reanimatesSelf": bool,
    "reanimatesOther": bool,
    "returnsToHand": bool,
    "bouncesCreature": bool,
    "bouncesPermanent": bool,
    "countersSpells": bool,
    "copiesSpells": bool,
    "copiesPermanents": bool,
    "tapsThings": bool,
    "untapsThings": bool,
    "grantsKeywords": bool,
    "grantedKeywords": [],
    "grantsEvasion": bool,
    "grantsPTBonus": bool,
    "grantsPTPenalty": bool,
    "modifiesPower": bool,
    "modifiesToughness": bool,
    "usesPlusOneCounters": bool,
    "usesMinusOneCounters": bool,
    "addsOtherCounters": bool,
    "otherCounterTypes": [],
    "sacrificesOwnPermanent": bool,
    "forcesOpponentSacrifice": bool,
    "fetchesLand": bool,
    "fetchesBasicLand": bool,
    "fetchesBasicLandOnly": bool,
    "fetchesNonbasicLand": bool,
    "fetchedLandTypes": [],
    "letsPlayExtraLands": bool,
    "gainsLife": bool,
    "gainsLifeForController": bool,
    "gainsLifeForOpponent": bool,
    "causesLifeLoss": bool,
    "causesLifeLossForController": bool,
    "causesLifeLossForOpponent": bool,
    "paysLife": bool,
    "takesExtraTurn": bool,
    "preventsDamage": bool,
    "redirectsDamage": bool,
    "animatesSelf": bool,
    "animatesOtherPermanent": bool,
    "makesMonarch": bool,
    "createsEmblem": bool,
    "restrictsActions": bool,
    "taxesOpponent": bool,
    "reducesCosts": bool,
    "phaseOut": bool,
    "flickersOrBlinks": bool,
    "grantsAlternativeCostToOtherSpells": bool,
    "sacrificesSelf": bool,
    "canCastFromGraveyard": bool,
    "hasEvasion": bool,
    "isRemoval": bool,
    "protectsSelf": bool,
    "protectsOthers": bool,
    "providesCardAdvantage": bool,
    "providesCardSelection": bool,
    "payoffForCastingSpells": bool,
    "payoffForCastingInstantsOrSorceries": bool
  },
  "conditions": {
    "caresAboutCreatures": bool,
    "caresAboutArtifacts": bool,
    "caresAboutEnchantments": bool,
    "caresAboutLands": bool,
    "caresAboutNonbasicLands": bool,
    "caresAboutGraveyard": bool,
    "caresAboutCardsDrawn": bool,
    "caresAboutDiscard": bool,
    "caresAboutLifeGainOrLoss": bool,
    "caresAboutCounters": bool,
    "caresAboutCastingSpells": bool,
    "caresAboutControllerCastingSpells": bool,
    "caresAboutOpponentCastingSpells": bool,
    "caresAboutInstantsAndSorceries": bool,
    "caresAboutDeath": bool,
    "caresAboutEnterBattlefield": bool,
    "caresAboutLeaveBattlefield": bool,
    "caresAboutCombat": bool,
    "caresAboutDamage": bool,
    "caresAboutTappedUntappedState": bool,
    "caresAboutColors": bool,
    "caresAboutManaSpent": bool,
    "caresAboutPowerOrToughness": bool,
    "caresAboutTokens": bool,
    "caresAboutEquipment": bool,
    "caresAboutAuras": bool
  },
  "references": {
    "mentionsCreature": bool,
    "mentionsArtifact": bool,
    "mentionsEnchantment": bool,
    "mentionsLand": bool,
    "mentionsPlaneswalker": bool,
    "mentionsGraveyard": bool,
    "mentionsLibrary": bool,
    "mentionsHand": bool,
    "mentionsExile": bool,
    "mentionsOpponent": bool,
    "mentionsPlayer": bool,
    "mentionsCombat": bool
  },
  "battlefield": {
    "entersTapped": bool,
    "canEnterUntapped": bool,
    "alwaysEntersTapped": bool,
    "conditionallyEntersTapped": bool
  },
  "targeting": {
    "hasTargeting": bool,
    "targetKinds": []
  },
  "animated": {
    "animatesSelf": bool,
    "animatedPower": number_or_null,
    "animatedToughness": number_or_null,
    "animatedKeywords": [],
    "animatedCreatureType": string_or_null
  },
  "conditionality": {
    "typeChangesConditionally": bool,
    "faceDependent": bool,
    "notes": []
  },
  "audit": {
    "shortRationale": "1-2 sentence summary of what the card does",
    "flaggedAmbiguities": []
  }
}`;
