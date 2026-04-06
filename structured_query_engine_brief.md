# Structured Query Engine — Design Brief

## What This Project Is

MTG Guessr (play.mtgguessr.io) is a web-based "20 Questions" game for Magic: The Gathering cards. A random card is selected, and the player asks natural-language yes/no questions to identify it. An LLM (currently Claude Haiku) answers each question using the card's structured data. When the player thinks they know the card, they can ask "is it [card name]?" and the game ends.

## Current Architecture

**Stack:** Next.js (App Router), TypeScript, Turso (libSQL) for card data and game sessions, Claude API (Haiku) for answering questions.

**Current question-answering flow:**
1. Player types a natural-language question (e.g., "is it a creature?", "does it have flying?", "CMC 3 or more?")
2. The question is sent to `POST /api/question`
3. The API retrieves the game session (which contains the full card data as JSON)
4. The full card data + a system prompt + the entire Q&A history is sent to Claude Haiku
5. Haiku returns "Yes.", "No.", or "Sometimes." (plus occasionally a brief qualifier)
6. The answer is stored in the session and returned to the client

**System prompt** instructs the LLM to:
- Answer only with Yes/No
- Never reveal the card name unprompted
- Append `[CORRECT_GUESS]` if the player correctly names the card
- Use MTG rules knowledge (type hierarchy, guild names, etc.)
- Remind the player if they contradict earlier answers

**Card data available per card (from Scryfall Oracle Cards + Default Cards bulk downloads):**
```
name, mana_cost, cmc, type_line, oracle_text, colors, color_identity,
keywords, power, toughness, loyalty, rarity, artist, flavor_text,
legalities (JSON object per format), card_faces (for DFCs),
produced_mana, all_sets (JSON array of every set name),
all_years (JSON array of every print year)
```

## The Problem

The LLM gives wrong factual answers. This is the #1 source of player frustration and the main blocker for growth. Examples from real games:

### Outright hallucinations
- **Thought-Knot Seer** ({3}{C}): Said generic mana and colorless mana "are the same thing"
- **Skyclave Apparition** (2/3): Said power is NOT less than 3 (it's 2)
- **Goblin Masons** ("destroy target Wall"): Said it targets lands, not creatures
- **Chord of Calling** ({X}{G}{G}{G}): Said the mana cost is NOT {X}{G}{G}{G}, then later admitted it was

### Contradictions in long conversations
- **Seat of the Synod**: Said it produces colored mana (Q6), then said it doesn't produce any color (Q29)
- **Chord of Calling**: Denied {X}{G}{G}{G} cost, then admitted it was correct 10 questions later

### Misunderstanding MTG rules
- **Thassa, God of the Sea**: Said it's "sometimes" a permanent (it's always a permanent — it's always an enchantment)
- **Maze of Ith**: Said it doesn't "remove from combat" (it functionally does by untapping and preventing damage)
- **Mana Drain**: Said it "sometimes" targets a permanent (spells on the stack aren't permanents yet)

### Wrong set/year information
- **Lightning Bolt**: Said it was in Tenth Edition (our data said Ravnica: Clue Edition, training knowledge guessed wrong)
- **Jeska's Will**: Said it was from 2024, from Murders at Karlov Manor (it's from Commander Legends 2020)
- **Rishadan Port**: Said it was from Tempest (it's from Mercadian Masques)

### Quality difference between models
- **Sonnet**: ~46% player win rate, generally accurate, occasional errors. ~$0.04/game
- **Haiku**: ~27% player win rate, frequent factual errors. ~$0.004/game
- We switched to Haiku to save money during a traffic spike and quality dropped noticeably

## The Proposed Solution

**Replace direct LLM answering with a two-step process:**

### Step 1: LLM translates the natural-language question into a structured query
The LLM's only job is to convert the player's question into a machine-readable query against the card data. This is a much simpler task than answering the question correctly — it's pattern matching, not MTG rules reasoning.

### Step 2: The structured query is executed against the card data deterministically
A code-based engine evaluates the query against the actual card fields and returns a guaranteed-correct yes/no answer.

### Step 3: Fallback for untranslatable questions
If the LLM cannot translate a question into a structured query (subjective questions like "is it good?", "does it see competitive play?", art-related questions), it should return a signal indicating this. **The system should then respond with "I'm not sure how to answer that — try rephrasing! (This question wasn't counted)"** rather than falling back to the LLM answering directly.

The rationale for refusing rather than falling back: wrong answers are worse than "try rephrasing." If the LLM can't structure the query, the question is probably ambiguous/complex — exactly the cases where the LLM gives wrong answers. A wrong answer sends the player down a wrong path for the rest of the game.

## Card Data Schema

Here are the actual fields available and their types:

```typescript
interface Card {
  name: string;                    // "Lightning Bolt"
  mana_cost: string | null;        // "{R}" — uses {W}, {U}, {B}, {R}, {G}, {C}, {X}, {1}, {2}, etc.
  cmc: number;                     // 1
  type_line: string;               // "Instant" or "Legendary Creature — Human Wizard"
  oracle_text: string | null;      // "Lightning Bolt deals 3 damage to any target."
  colors: string[];                // ["R"]
  color_identity: string[];        // ["R"]
  keywords: string[];              // ["Flying", "Trample", "Cascade"]
  power: string | null;            // "3" or "*" or null (non-creatures)
  toughness: string | null;        // "4" or "*" or null
  loyalty: string | null;          // "3" (planeswalkers only)
  rarity: string;                  // "common", "uncommon", "rare", "mythic"
  artist: string;                  // "Christopher Rush"
  flavor_text: string | null;      // flavor text
  legalities: Record<string, string>; // {"standard": "legal", "modern": "banned", ...}
  card_faces: CardFace[] | null;   // for double-faced cards
  produced_mana: string[] | null;  // ["R", "G"] — what mana the card can produce
  all_sets: string[];              // ["Limited Edition Alpha", "Revised Edition", ...]
  all_years: string[];             // ["1993", "1995", "2010", ...]
}
```

## Common Question Patterns

Based on thousands of real player questions, here are the most common patterns and how they map to card data:

### Directly queryable (should be ~80% of questions):
| Question Pattern | Card Field | Operation |
|---|---|---|
| "is it a creature?" | type_line | contains "Creature" |
| "is it a permanent?" | type_line | NOT contains "Instant" AND NOT contains "Sorcery" |
| "is it an instant?" | type_line | contains "Instant" |
| "is it legendary?" | type_line | contains "Legendary" |
| "is it blue?" / "is it white?" | colors | contains "U" / "W" |
| "is it monocolor?" | colors | length === 1 |
| "is it colorless?" | colors | length === 0 |
| "is it multicolor?" / "is it gold?" | colors | length > 1 |
| "is it Golgari?" | colors | equals ["B", "G"] (order independent) |
| "CMC 3?" / "mana value 3?" | cmc | equals 3 |
| "CMC 3 or more?" | cmc | >= 3 |
| "does it cost {1}{R}{R}?" / "1RR?" | mana_cost | equals "{1}{R}{R}" |
| "does it have X in the cost?" | mana_cost | contains "{X}" |
| "power 3?" | power | equals "3" |
| "power 3 or less?" | power | <= 3 (numeric comparison) |
| "toughness greater than power?" | toughness, power | toughness > power |
| "does it have flying?" | keywords | contains "Flying" |
| "any keywords?" | keywords | length > 0 |
| "is it rare?" | rarity | equals "rare" |
| "does it target?" | oracle_text | contains "target" |
| "does it draw cards?" | oracle_text | contains "draw" |
| "does it involve the graveyard?" | oracle_text | contains "graveyard" |
| "does it have an ETB effect?" | oracle_text | contains "enters" or "enters the battlefield" |
| "is it legal in Modern?" | legalities.modern | equals "legal" |
| "is it banned in Commander?" | legalities.commander | equals "banned" |
| "was it printed in Alpha?" | all_sets | contains "Limited Edition Alpha" |
| "was it printed before 2010?" | all_years | any year < 2010 |
| "is it [card name]?" | name | equals (case insensitive) or face name matches |
| "does it have 'bolt' in the name?" | name | contains "bolt" (case insensitive) |
| "is it an artifact?" | type_line | contains "Artifact" |
| "is it an aura?" | type_line | contains "Aura" |
| "is it a goblin?" | type_line | contains "Goblin" |
| "does it make tokens?" | oracle_text | contains "token" |
| "does it sacrifice?" | oracle_text | contains "sacrifice" or "Sacrifice" |
| "does it have a tap ability?" | oracle_text | contains "{T}" |
| "does it produce mana?" | produced_mana | length > 0, or oracle_text contains "Add" |

### Needs inference / functional understanding:
| Question Pattern | How to Answer |
|---|---|
| "does it remove from combat?" | oracle_text analysis — untap + prevent damage = yes |
| "is it removal?" | oracle_text contains "destroy" or "exile" targeting |
| "does it ramp?" | oracle_text involves searching for lands or adding mana |
| "is it a board wipe?" | oracle_text affects "all" or "each" creatures/permanents |

### Subjective / external knowledge (should refuse):
| Question Pattern | Why It Can't Be Queried |
|---|---|
| "is it good in commander?" | requires metagame knowledge |
| "does it see competitive play?" | requires tournament data |
| "is it part of a combo?" | requires external combo database |
| "is the art creepy?" | requires image understanding |
| "would this go in an aristocrats deck?" | requires archetype knowledge |

## Key Design Considerations

1. **The LLM translation must handle typos and informal language.** Players type "creatuer", "monocular" (meaning monocolor), "CMC" and "mana value" interchangeably, "1RR" meaning "{1}{R}{R}", etc.

2. **Guild/faction names must be mapped.** "Is it Golgari?" → colors contains B and G. "Is it Esper?" → colors contains W, U, and B. The full mapping: Azorius=WU, Dimir=UB, Rakdos=BR, Gruul=RG, Selesnya=GW, Orzhov=WB, Izzet=UR, Golgari=BG, Boros=RW, Simic=UG. Three-color: Esper=WUB, Grixis=UBR, Jund=BRG, Naya=RGW, Bant=GWU, Abzan=WBG, Jeskai=URW, Sultai=BUG, Mardu=RWB, Temur=GUR.

3. **"Sometimes" answers are important.** Thassa is sometimes a creature (depends on devotion). The card data doesn't directly encode this — the oracle text says "As long as your devotion to blue is less than five, Thassa isn't a creature." The query engine needs to handle cards whose type changes conditionally.

4. **Double-faced cards** have different properties on each face. "Is it a creature?" might be true for one face but not the other. The `card_faces` array contains per-face data.

5. **The question history matters for context.** "blue?" by itself is ambiguous (color? produces blue mana?), but if the previous questions were about colors, it means "is it blue?" The LLM translator should use conversation context.

6. **Negation matters.** "Is it NOT a creature?" and "Is it a creature?" need opposite answers. The LLM must correctly identify negation.

7. **Power/toughness have special values.** Some cards have `*` for power or toughness (variable). Numeric comparisons should handle this gracefully.

8. **The refund mechanic.** If the LLM can't translate a question, the question should not count against the player. The response should indicate this so the client doesn't increment the question counter.

9. **Correct guess detection.** The current system uses `[CORRECT_GUESS]` tag from the LLM. With the structured engine, exact name matching can be done deterministically — if the question contains the card's name (or a DFC face name) as a substring and the query evaluates to true, it's a correct guess. This should be more reliable than LLM-based detection.

10. **Qualifier responses.** Sometimes "Yes" or "No" is misleading. The engine should be able to return "Sometimes" for cards with conditional properties (like Thassa's creature status). This might require a small set of special-case rules or oracle text pattern matching.

## Performance Requirements

- Game start must be < 2 seconds (currently solved with caching)
- Question response must be < 3 seconds (current Haiku latency is ~500ms, structured queries would be near-instant but the LLM translation adds latency)
- The system should work with Haiku (cheapest model) for the translation step

## Current Codebase Structure

```
src/
  lib/
    claude.ts          — Current LLM answering (SYSTEM_PROMPT, answerQuestion, cardToContext)
    db.ts              — Turso database connection
    cards.ts           — Card queries (getRandomCard, getCardById, searchCardNames)
    game-store.ts      — Session management (createGame, getGame, addQuestion, submitGuess)
  app/
    api/
      question/route.ts — Current question endpoint
      game/route.ts     — Game start endpoint
      guess/route.ts    — Guess submission endpoint
```

The new structured query engine should be implementable as a new module (e.g., `src/lib/query-engine.ts`) and a new or modified API route, without changing the card data layer or game state management.

## Success Criteria

1. Questions about card attributes (type, color, CMC, P/T, keywords, mana cost) are answered with 100% accuracy
2. Questions about sets/years are answered with 100% accuracy using the all_sets/all_years data
3. Subjective questions get a clean "try rephrasing" response instead of a wrong answer
4. Player win rate improves from ~27% (Haiku direct) toward the ~46% we saw with Sonnet
5. API cost stays at Haiku level (~$0.004/game) since the LLM is only doing translation, not answering
6. Response latency stays under 3 seconds
