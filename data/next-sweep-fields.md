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

- `fetchesBasicLand` — EXISTING FIELD, needs reclassification. Sonnet said `false` for Scalding Tarn because oracle says "Island or Mountain card" not "basic land". But Island/Mountain ARE basic land types. All 10 fetchlands likely wrong. Fix classification prompt to clarify that searching for a card by basic land type name (Plains, Island, Swamp, Mountain, Forest) counts as fetching a basic land.
- `fetchedLandTypes: string[]` — NEW FIELD. Which specific land types does it search for? e.g. Scalding Tarn → `["Island", "Mountain"]`, Verdant Catacombs → `["Swamp", "Forest"]`. Enables answering "does it fetch mountains?" deterministically.
## Medium Priority (competitive/metagame data from external sources)

- `appearedInProTourTop8: boolean` — has this card appeared in a Pro Tour / Mythic Championship top 8 deck? (requires MTGTop8/Melee data)
- `competitiveFormats: string[]` — which competitive formats has this card seen significant play in? (requires metagame data)

## Lower Priority (nice to have)

- `numberOfAbilities: number` — how many distinct abilities does the card have?
- `rulesTextLength: "none" | "short" | "medium" | "long"` — rough categorization of text complexity
- `requiresSpecificBoardState: boolean` — does it need other things in play to function? (equipment needs creatures, tribal payoffs need tribe members, etc.)
