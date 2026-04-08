# TODO — Post v3.0 Launch

## PRIORITY — Fetchland / Land Search Bugs
- [ ] **"does it search up a swamp?" → Yes for Scalding Tarn (WRONG)**. Translated to generic `searches_library`/`fetches_land` which lost specificity. Need `fetchedLandTypes` field (on next-sweep list) and parameterized `fetches_land_type` query kind.
- [x] ~~fetchesBasicLand classification~~ — Reverted. Current `false` for fetchlands is correct since they CAN fetch nonbasics. Need `fetchesBasicLandOnly` field to distinguish Evolving Wilds (true) from Scalding Tarn (false/sometimes). On next-sweep list.
- [x] ~~"does it make blue mana?" → No for fetchlands~~ — This is actually correct. Fetchlands don't produce mana.

## PRIORITY — Mana Cost Order Bug
- [x] ~~{W}{U}{R} vs {U}{R}{W} string mismatch~~ — Fixed in v3.1.4. Now sorts symbols before comparing.

## PRIORITY — Name Guessing Bug
- [x] ~~"Is it daretti?" → No for Daretti, Scrap Savant~~ — Fixed in v3.1.0. Two-tier alias system: Tier 1 (full name → win), Tier 2 (unique pre-comma + manual overrides → "Yes." but no win).

## Bugs / Fixes
- [ ] Railway auto-deploy not working (manually running `railway up` each time)
- [ ] Year shorthand ambiguity ("2024?" after "before 2020?" mistranslated as `>=` instead of `=`)
- [x] ~~"does it have more than one ability?" → keyword_count_compare~~ — Fixed in v3.1.3. Translator now sends to unsupported.
- [x] ~~Mana Drain "does it target a permanent?" → Yes~~ — Fixed in v2.4.0. Zone-aware targeting normalization.
- [x] ~~API slowdowns leave player staring at frozen screen~~ — Fixed in v3.1.5. Thinking messages + 20s timeout.

## Architecture
- [ ] **Structured abilities model** — currently abilities are flat booleans. Players ask questions about specific ability costs/effects ("does it tap to activate?", "how much mana does it produce?") that flat fields can't answer. Consider modeling abilities as structured objects with cost/effect decomposition. Discussing with ChatGPT. Would solve a whole class of Sonnet fallbacks and avoid errors like Mana Vault "can it produce 2 colorless?" → wrong answer.
- [ ] **Causal/dependency modeling** — currently Haiku defers causal questions ("does it get bigger when you sacrifice artifacts?") to Sonnet. Long-term, could model cause-effect relationships in the schema (event → effect chains). ChatGPT advised against this for v1 — hybrid approach (deterministic for facts, Sonnet for relational reasoning) is correct for now, but worth revisiting as the game matures.
- [ ] Apply targeting normalization pattern (baseKinds/zone/constraints) to `createdTokenTypes` and `damageTargets`
- [ ] Next Sonnet sweep: new fields tracked in `data/next-sweep-fields.md`
- [ ] Price questions: give specific message instead of generic refund, track separately
- [ ] Pro tour data: MTG Melee API (2022+) and MTGTop8 scrapers for `appearedInProTourTop8` field
- [ ] Sonnet → semantic data feedback loop: periodically review `sonnet_fallback_logs`, promote common patterns to deterministic query kinds
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
