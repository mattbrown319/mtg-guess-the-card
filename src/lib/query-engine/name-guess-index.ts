// Two-tier name guess system
// Tier 1 (winning): exact full name match → game ends
// Tier 2 (entity): partial name match → "Yes." but game continues

export interface NameGuessMatch {
  outcome: "correct_guess" | "identified_but_incomplete" | "no_match";
  matchedAlias?: string;
  tier?: "winning" | "entity";
}

interface NameGuessEntry {
  cardName: string; // original card name
  tier: "winning" | "entity";
}

// Manual entity aliases for non-comma legendaries and special cases.
// Add to this list based on player data / sonnet_fallback_logs.
const MANUAL_ENTITY_ALIASES: Record<string, string> = {
  // Non-comma legendaries
  "karn": "Karn",
  "griselbrand": "Griselbrand",
  "gitrog": "The Gitrog Monster",
  "fblthp": "Fblthp, the Lost",
  "questing beast": "Questing Beast",
  "progenitus": "Progenitus",
  "hazoret": "Hazoret the Fervent",
  "geist": "Geist of Saint Traft",
  "vendilion clique": "Vendilion Clique",
  "maelstrom wanderer": "Maelstrom Wanderer",
  "wrenn and six": "Wrenn and Six",
  "wrenn": "Wrenn and Six",
  "dack fayden": "Dack Fayden",
  "dack": "Dack Fayden",
  "garruk": "Garruk Wildspeaker",
  "ajani": "Ajani Goldmane",
  "liliana": "Liliana of the Veil",
  "boseiju": "Boseiju, Who Endures",
  "otawara": "Otawara, Soaring City",
  "karakas": "Karakas",
  "urborg": "Urborg, Tomb of Yawgmoth",
  "lurrus": "Lurrus of the Dream-Den",
  "yorion": "Yorion, Sky Nomad",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,'.?\-—]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let cachedIndex: Map<string, NameGuessEntry> | null = null;
let cachedCardNames: string[] | null = null;

export function buildNameGuessIndex(cardNames: string[]): Map<string, NameGuessEntry> {
  // Return cached if card list hasn't changed
  if (cachedIndex && cachedCardNames === cardNames) return cachedIndex;

  const index = new Map<string, NameGuessEntry>();

  // Tier 1: full normalized card names
  for (const name of cardNames) {
    const norm = normalize(name);
    index.set(norm, { cardName: name, tier: "winning" });

    // DFC: handle "Name A // Name B" — each face is a winning alias
    if (name.includes(" // ")) {
      for (const face of name.split(" // ")) {
        const faceNorm = normalize(face.trim());
        if (!index.has(faceNorm)) {
          index.set(faceNorm, { cardName: name, tier: "winning" });
        }
      }
    }
  }

  // Tier 2: pre-comma names (automatic, uniqueness-checked)
  const preCommaCount = new Map<string, string[]>();
  for (const name of cardNames) {
    const commaIdx = name.indexOf(",");
    if (commaIdx === -1) continue;
    const preComma = normalize(name.substring(0, commaIdx));
    if (preComma.length < 2) continue;
    const existing = preCommaCount.get(preComma) || [];
    existing.push(name);
    preCommaCount.set(preComma, existing);
  }

  for (const [alias, cards] of preCommaCount) {
    if (cards.length === 1 && !index.has(alias)) {
      // Unique pre-comma name — safe as Tier 2
      index.set(alias, { cardName: cards[0], tier: "entity" });
    }
    // If multiple cards share this pre-comma name (e.g. "teferi"), skip it
  }

  // Tier 2: manual entity aliases
  for (const [alias, cardNameOrPrefix] of Object.entries(MANUAL_ENTITY_ALIASES)) {
    const norm = normalize(alias);
    if (index.has(norm)) continue; // don't override existing aliases

    // Find matching card(s) in the pool
    // Try exact match first, then prefix match for partial names like "Karn"
    const exactMatch = cardNames.find(n => n === cardNameOrPrefix);
    if (exactMatch) {
      index.set(norm, { cardName: exactMatch, tier: "entity" });
      continue;
    }

    // Prefix match: "Karn" matches "Karn Liberated", "The Gitrog Monster" matches exactly
    const prefixMatches = cardNames.filter(n =>
      n === cardNameOrPrefix ||
      n.startsWith(cardNameOrPrefix + " ") ||
      n.startsWith(cardNameOrPrefix + ",")
    );
    if (prefixMatches.length === 1) {
      index.set(norm, { cardName: prefixMatches[0], tier: "entity" });
    }
    // If multiple matches (e.g. "Karn" matches "Karn Liberated" AND "Karn, the Great Creator"),
    // skip — ambiguous, same as pre-comma uniqueness check
  }

  cachedIndex = index;
  cachedCardNames = cardNames;
  return index;
}

export function checkNameGuessV2(
  cardName: string,
  playerQuestion: string,
  index: Map<string, NameGuessEntry>
): NameGuessMatch {
  const q = playerQuestion.trim().toLowerCase();

  // Strip common prefixes
  let guess = q;
  for (const prefix of ["is it ", "is this ", "it's ", "its ", "is the card "]) {
    if (guess.startsWith(prefix)) {
      guess = guess.slice(prefix.length);
      break;
    }
  }
  // Strip trailing ?
  guess = guess.replace(/\?+$/, "").trim();

  // Normalize
  const norm = normalize(guess);
  if (norm.length < 2) return { outcome: "no_match" };

  const entry = index.get(norm);
  if (!entry) return { outcome: "no_match" };

  // Check if this alias belongs to the current card
  const entryCardNorm = normalize(entry.cardName);
  const currentCardNorm = normalize(cardName);

  if (entryCardNorm !== currentCardNorm) {
    // Alias exists but for a different card — this is a wrong guess
    // But only return "no" if it's a Tier 1 (definitive wrong guess)
    // For Tier 2 entity aliases, also return no since it's the wrong entity
    return { outcome: "no_match" };
  }

  if (entry.tier === "winning") {
    return {
      outcome: "correct_guess",
      matchedAlias: norm,
      tier: "winning",
    };
  }

  return {
    outcome: "identified_but_incomplete",
    matchedAlias: norm,
    tier: "entity",
  };
}
