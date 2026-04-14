# Translation Cache Plan

## Why
Translation (Haiku) is 94% of runtime cost (~$0.09/game). Most questions are repeated across players ("is it a creature?", "does it have flying?"). Caching translations eliminates redundant API calls.

## V1 Design

### Storage
- **In-memory Map** for fast lookups
- **Turso table** as persistent backing store
- On startup: load all active entries into memory
- On miss: call Haiku, validate, store in memory + Turso

### Cache Key
`v{schemaVersion}::{normalizedQuestion}`

Normalization: lowercase, trim whitespace, strip trailing punctuation.

### What to Cache
Cache ONLY if ALL are true:
- `usedContext === false`
- Translation validated successfully
- Query kind is NOT unsupported/subjective/unreliable/ambiguous
- Question length >= 5 characters (skip fragments like "red?", "3?")

### What NOT to Cache
- Context-dependent questions (usedContext === true)
- Unsupported/subjective/unreliable/ambiguous results
- Ultra-short fragments
- Failed/malformed translations

### Turso Table
```sql
CREATE TABLE translation_cache (
  normalized_question TEXT PRIMARY KEY,
  translated_query TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active'
)
```

### Cache Invalidation
- Bump schema_version when adding query kinds or changing translation rules
- Entries with old schema_version are ignored (stale)
- Manual delete/disable for specific bad entries via status field

### Metrics to Log
- Hit rate vs miss rate
- Total Haiku calls saved
- Most-hit cached questions

### Expected Impact
- 70-80% of Haiku calls eliminated after warmup
- Per-game cost drops from ~$0.09 to ~$0.02-0.03
- At 1000 games/day: $93/day → ~$25/day

## Implementation Steps
1. Add translation_cache table to db.ts
2. Create cache module (load, get, set, invalidate)
3. Wire into translator.ts (check cache before calling Haiku)
4. Add hit/miss logging
5. Test with existing translator test suite
6. Deploy

## Not in V1 (add later if needed)
- Probation periods for new entries
- LRU/LFU eviction
- Confidence scores
- Bad-hit correlation
- Automatic re-translation of stale entries
