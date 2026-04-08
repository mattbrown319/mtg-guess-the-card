# Name Guess System Design

## Problem
"Is it daretti?" returns "No" for Daretti, Scrap Savant because the engine only does exact full-name matching.

## Solution: Two-Tier Alias System

### Tier 1: Winning aliases (game ends)
- Full normalized card name
- DFC face names

### Tier 2: Entity aliases (answer "Yes." but game continues)
- Pre-comma names for comma-separated legendary names (automatic, uniqueness-checked against pool)
- Manual override list for non-comma legendaries and special cases

### Matching flow
1. Normalize player guess (lowercase, strip punctuation, trim)
2. Check Tier 1 → "Yes." + CORRECT_GUESS + end game
3. Check Tier 2 → "Yes." + IDENTIFIED_BUT_INCOMPLETE + continue
4. No match → fall through to Haiku translator as normal

### Alias generation (computed at startup, cached)
- **Rule A (automatic):** For cards with comma in name, extract pre-comma portion. Only include if unique across the iconic card pool. "Daretti" is unique → include. "Teferi" appears 3 times → exclude.
- **Rule B (automatic):** DFC face names as Tier 1 winning aliases.
- **Rule C (manual):** Override list for non-comma legendaries and special cases. Examples: karn, gitrog, fblthp, griselbrand, etc.

### What we explicitly DON'T do
- No substring matching
- No prefix matching
- No first-word extraction (except via manual overrides)
- No fuzzy/typo matching (v1 — add later based on player data)
- No generic noun aliases (scarab, lightning, monster, bolt, grand, etc.)

### Normalization rules
- Lowercase
- Trim whitespace
- Collapse repeated spaces
- Remove commas, apostrophes, hyphens, periods, question marks

### Collisions in current pool (pre-comma names appearing 2+ times)
- Teferi (3), Nicol Bolas (3)
- Ugin (2), Thalia (2), Karn (2), Jace (2), Emrakul (2), Elspeth (2)

These are excluded from automatic Tier 2 generation.

### v2 improvements (later)
- Fuzzy matching for typos (edit distance with conservative thresholds)
- Auto-detect entity names from non-comma legendaries
- Expand override list based on player data from sonnet_fallback_logs
