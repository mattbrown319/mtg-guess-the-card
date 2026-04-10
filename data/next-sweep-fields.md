# New Fields for Next Sonnet 1000-Card Sweep

These fields don't exist in the current OracleSemanticSummary schema.
Add them to the schema and classification prompt before the next run.

## High Priority (triggered by actual player questions or Sonnet fallbacks)

- `providesCardAdvantage: boolean | "sometimes"` — does the card generate more resources than it costs? (draw 2 for 1 card spent = yes, cantrip = sometimes, 1-for-1 removal = no)
- `providesCardSelection: boolean` — does it filter/improve card quality without necessarily gaining cards? (scry, surveil, looting, top-of-library manipulation)
- `sacrificesSelf: boolean` — does the card sacrifice itself as part of its ability? Distinct from sacrificing other permanents.
- `canCastFromGraveyard: boolean` — does it let you cast spells from the graveyard? (flashback, Lurrus, Yawgmoth's Will, etc.)
- `hasEvasion: boolean` — broader than any single keyword. Flying, menace, shadow, fear, intimidate, "can't be blocked", horsemanship, skulk, etc.
- `isRemoval: boolean` — high-level "does it remove things from the battlefield" (destroy, exile, bounce, tuck, etc.)
- `protectsSelf: boolean` — can it protect itself? (hexproof, indestructible, regenerate, ward on itself, phase out, etc.)
- `protectsOthers: boolean` — can it protect other things? (grants hexproof/indestructible, gives protection, etc.)

## High Priority — Activation Cost Properties (from Priest of Forgotten Gods game)

- `requiresTapToActivate: boolean` — does the activated ability require tapping as part of its cost? ({T} in cost)
- `requiresManaToActivate: boolean` — does the activated ability require spending mana?
- `sacrificesOtherPermanent: boolean` — does it specifically sacrifice OTHER permanents (not itself)? Distinct from `sacrificesSelf`.
- `numberOfCreaturesToSacrifice: number | null` — how many creatures need to be sacrificed? (Priest = 2)

## High Priority — Fetchland / Land Search Fixes

- `fetchesBasicLandOnly: boolean` — NEW FIELD, replaces current `fetchesBasicLand`. True only if the card explicitly says "basic land card" (Evolving Wilds, Fabled Passage, Prismatic Vista, Terramorphic Expanse). False for fetchlands that search by land type name (Scalding Tarn searches "Island or Mountain card" which can fetch nonbasics like Volcanic Island or Steam Vents). Current `fetchesBasicLand` is false for all 10 fetchlands which is correct — they CAN fetch basics but also nonbasics. "Does it fetch a basic?" for Scalding Tarn should be "Sometimes."
- `fetchesNonbasicLand: boolean` — can it fetch nonbasic lands? Scalding Tarn = true (searches "Island or Mountain card" which includes nonbasic Islands like Volcanic Island). Fabled Passage = false (explicitly "basic land card"). "Does it search up nonbasic lands?" was answered Yes for Fabled Passage because Haiku fell back to generic `fetches_land`.
- `fetchedLandTypes: string[]` — NEW FIELD. Which specific land types does it search for? e.g. Scalding Tarn → `["Island", "Mountain"]`, Verdant Catacombs → `["Swamp", "Forest"]`, Evolving Wilds → `["Plains", "Island", "Swamp", "Mountain", "Forest"]`. Enables answering "does it fetch mountains?" deterministically.
## High Priority — Alternative Cost Fixes (from Unearth game)

- `grantsAlternativeCostToOtherSpells: boolean` — does this card let you cast OTHER spells with an alternative cost? (Bolas's Citadel, Dream Halls, Omniscience, Aluren, cascade cards, Isochron Scepter, Golos, etc.) Distinct from `hasAlternativeCost` which is about the card itself.
- Classification prompt fix needed: cycling is NOT an alternative casting cost — it's an activated ability. Equip is NOT an alternative casting cost. hasAlternativeCost should only be true for actual alternative ways to CAST the spell (Force of Will pitch, evoke, ninjutsu, delve, phyrexian mana in casting cost, spectacle, etc.)

## High Priority — Spell Casting Trigger Specificity (from Seeker of the Way game)

- `caresAboutControllerCastingSpells: boolean` — triggers when YOU cast a spell (prowess, Seeker of the Way, Young Pyromancer)
- `caresAboutOpponentCastingSpells: boolean` — triggers when OPPONENT casts a spell (Rhystic Study, Eidolon of Rhetoric)
- Note: current `caresAboutCastingSpells` is true for both and can't distinguish. "Does it trigger when an opponent casts a spell?" answered Yes for Seeker of the Way (WRONG — it triggers on controller's spells only).

## High Priority — Trigger Timing (from Underworld Breach game)

- `hasBeginningOfCombatTrigger: boolean` — triggers "at the beginning of combat on your turn" (Legion Warboss, Rabble Rousing)
- `hasEndStepTrigger: boolean` — triggers "at the beginning of the end step" or "at end of turn" (Underworld Breach, Wilderness Reclamation)
- `hasDrawStepTrigger: boolean` — triggers "at the beginning of your draw step" (Mana Vault)
- `hasEndOfCombatTrigger: boolean` — triggers "at end of combat" (Aurelia)
- Note: we already have upkeep_trigger, attack_trigger, block_trigger, combat_damage_trigger, dies_trigger, etb_ability, leaves_battlefield_trigger. These new ones fill the remaining MTG trigger timing gaps.

## High Priority — Ability Details (from Sonnet fallback log review)

- `numberOfActivatedAbilities: number` — how many activated abilities does the card have?
- `hasHybridMana: boolean` — does the mana cost contain hybrid mana symbols like {W/U}?
- `coloredPipsInCost: number` — how many colored pips in the mana cost? (Mantis Rider = 3)
- `manaToActivate: string | null` — what mana is required to activate? (Wayfarer's Bauble = "{2}")
- `manaProducedAmount: number | null` — how much mana does it produce per activation? (Mana Vault = 3, Sol Ring = 2). Sonnet got Mana Vault WRONG on "can it produce 2 colorless?" — said No when it produces 3.

## Medium Priority (competitive/metagame data from external sources)

- `appearedInProTourTop8: boolean` — has this card appeared in a Pro Tour / Mythic Championship top 8 deck? (requires MTGTop8/Melee data)
- `competitiveFormats: string[]` — which competitive formats has this card seen significant play in? (requires metagame data)

## Lower Priority (nice to have)

- `numberOfAbilities: number` — how many distinct abilities does the card have?
- `rulesTextLength: "none" | "short" | "medium" | "long"` — rough categorization of text complexity
- `requiresSpecificBoardState: boolean` — does it need other things in play to function? (equipment needs creatures, tribal payoffs need tribe members, etc.)
