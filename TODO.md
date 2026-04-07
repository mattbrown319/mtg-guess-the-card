# TODO — Post v3.0 Launch

## PRIORITY — Fetchland / Land Search Bugs
- [ ] **Scalding Tarn "does it search up a basic land?" → No (WRONG)**. Sonnet classified `fetchesBasicLand: false` because oracle text says "Island or Mountain card" not "basic land". But Island/Mountain ARE basic land types. Need to fix classification for all 10 fetchlands + any other cards that search for lands by type name.
- [ ] **"does it search up a swamp?" → Yes for Scalding Tarn (WRONG)**. Translated to generic `searches_library`/`fetches_land` which lost specificity. Need a way to answer "does it fetch specifically [land type]?" — probably a parameterized `fetches_land_type` query kind that checks which specific types the card searches for. Requires new semantic field or oracle text parsing.
- [ ] **"does it make blue mana?" → No for fetchlands (misleading)**. Scryfall `produced_mana: []` is technically correct (fetchlands don't produce mana themselves) but terrible for gameplay. Players think of Scalding Tarn as "makes blue and red mana." Need to decide: override produced_mana for fetchlands, or handle this in the Sonnet fallback, or add a "effectively produces" semantic field.

## Bugs / Fixes
- [ ] Railway auto-deploy not working (manually running `railway up` each time)
- [ ] Year shorthand ambiguity ("2024?" after "before 2020?" mistranslated as `>=` instead of `=`)
- [ ] "does it have more than one ability?" translates to `keyword_count_compare` — keywords ≠ abilities

## Architecture
- [ ] Apply targeting normalization pattern (baseKinds/zone/constraints) to `createdTokenTypes` and `damageTargets`
- [ ] Next Sonnet sweep: new fields tracked in `data/next-sweep-fields.md` (card advantage, card selection, sacrifices self, can cast from graveyard, has evasion, is removal, protects self/others)
- [ ] Price questions: give specific message ("I can't answer questions about price") instead of generic refund, track separately
- [ ] Pro tour data: MTG Melee API (2022+) and MTGTop8 scrapers for `appearedInProTourTop8` field
- [ ] Sonnet → semantic data feedback loop: periodically review `sonnet_fallback_logs`, promote common patterns to deterministic query kinds
- [ ] Immobilizing Ink edge case: "has activated ability" may misfire on cards that grant abilities vs have them (affects non-iconic cards only for now)
- [ ] Player nudge system: remind players when they contradict earlier answers (v1 LLM had this)

## Card Pool
- [ ] Add ~90 more interesting cards to get back to ~1000 (enchantments underrepresented at 7%)
- [ ] Consider adding more iconic creatures, enchantments, and planeswalkers

## Monitoring
- [ ] Build cost dashboard / summary queries for `llm_cost_logs`
- [ ] Periodically audit `sonnet_fallback_logs` for accuracy and patterns

## Future Features (from earlier backlog)
- [ ] Funnel visualization
- [ ] Report runs
- [ ] Streamer mode
- [ ] Quiz builder
- [ ] Vote weighting
- [ ] Set filtering
