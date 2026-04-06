import type { AtomicQuery, NormalizedCard } from "../types";
import type { TruthValue } from "../truth";

export function resolveDerivedQuery(
  query: AtomicQuery,
  card: NormalizedCard
): TruthValue | null {
  switch (query.kind) {
    // ==================== IS PERMANENT ====================
    case "is_permanent": {
      const nonPermanentTypes = ["instant", "sorcery"];
      const isNonPermanent = card.typeTokens.every(t => nonPermanentTypes.includes(t));
      if (isNonPermanent) return "no";
      // If it has any permanent type, it's a permanent
      const permanentTypes = ["creature", "artifact", "enchantment", "land", "planeswalker", "battle"];
      const hasPermanentType = card.typeTokens.some(t => permanentTypes.includes(t));
      return hasPermanentType ? "yes" : "no";
    }

    // ==================== CREATES TOKENS ====================
    case "creates_tokens": {
      if (!card.oracleTextLower) return "no";
      // Look for "create" + "token" pattern
      if (/\bcreates?\b/.test(card.oracleTextLower) && /\btoken/.test(card.oracleTextLower)) {
        return "yes";
      }
      // Also check for "put a ... token" (older card text)
      if (/\bput\b.*\btoken\b/.test(card.oracleTextLower)) {
        return "yes";
      }
      return "no";
    }

    // ==================== ENTERS TAPPED ====================
    case "enters_tapped": {
      if (!card.oracleTextLower) return "no";
      // Always enters tapped
      if (/enters (the battlefield )?tapped(?!\s*(unless|if))/.test(card.oracleTextLower)) {
        return "yes";
      }
      // Conditionally enters tapped ("enters tapped unless...")
      if (/enters (the battlefield )?tapped (unless|if)/.test(card.oracleTextLower)) {
        return "sometimes";
      }
      // "As ~ enters, you may ... If you don't, it enters tapped"
      if (/enters (the battlefield )?tapped/.test(card.oracleTextLower)) {
        return "sometimes";
      }
      return "no";
    }

    // ==================== CAN ENTER UNTAPPED ====================
    case "can_enter_untapped": {
      if (!card.oracleTextLower) return "yes"; // no text about entering tapped = enters untapped
      if (!card.entersTappedTextPresent) return "yes";
      // If it says "enters tapped unless" or "you may ... if you don't, enters tapped"
      if (/unless|if|you may|reveal/.test(card.oracleTextLower)) {
        return "sometimes";
      }
      // Always tapped
      return "no";
    }

    // ==================== TARGETS ====================
    case "targets": {
      if (!card.oracleTextLower) return "no";
      // Check for "target" in the oracle text
      // But exclude reminder text (text in parentheses)
      const textWithoutReminder = card.allOracleTextCombined
        .replace(/\([^)]*\)/g, "")
        .toLowerCase();
      return /\btarget\b/.test(textWithoutReminder) ? "yes" : "no";
    }

    // ==================== TRIGGERED ABILITY ====================
    case "triggered_ability": {
      if (!card.oracleTextLower) return "no";
      // Triggered abilities start with "when", "whenever", or "at"
      const textWithoutReminder = card.allOracleTextCombined
        .replace(/\([^)]*\)/g, "")
        .toLowerCase();
      if (/\b(when(ever)?|at the beginning)\b/.test(textWithoutReminder)) {
        return "yes";
      }
      return "no";
    }

    // ==================== ACTIVATED ABILITY ====================
    case "activated_ability": {
      if (!card.oracleTextLower) return "no";
      // Activated abilities have a cost : effect pattern
      // Look for "{" followed by ":" or mana/tap symbols followed by ":"
      const textWithoutReminder = card.allOracleTextCombined
        .replace(/\([^)]*\)/g, "");
      // Pattern: line starts with a cost (containing {T}, {mana}, or text) then ":"
      if (/^[^"]*(\{[^}]+\}[^:]*|[^:]+),?\s*:\s/m.test(textWithoutReminder)) {
        return "yes";
      }
      // Also check for simpler pattern: "{something}: "
      if (/\{[^}]+\}\s*.*?:\s/.test(textWithoutReminder)) {
        return "yes";
      }
      return "no";
    }

    // ==================== ETB ABILITY ====================
    case "etb_ability": {
      if (!card.oracleTextLower) return "no";
      const textWithoutReminder = card.allOracleTextCombined
        .replace(/\([^)]*\)/g, "")
        .toLowerCase();
      // "When [this/cardname] enters" — triggered ETB
      if (/when (this creature|this|it|~|[a-z, ]+) enters/.test(textWithoutReminder)) {
        return "yes";
      }
      // "enters the battlefield" in a triggered context
      if (/when.*enters the battlefield/.test(textWithoutReminder)) {
        return "yes";
      }
      return "no";
    }

    // ==================== HAS MANA ABILITY ====================
    case "has_mana_ability": {
      if (!card.oracleTextLower) return "no";
      // Mana abilities add mana: "Add {" pattern
      if (/\badd\s+\{/.test(card.oracleTextLower)) {
        return "yes";
      }
      // Or "add one mana" / "add mana"
      if (/\badd\b.*\bmana\b/.test(card.oracleTextLower)) {
        return "yes";
      }
      return "no";
    }

    // ==================== HAS NON-MANA ABILITY ====================
    case "has_non_mana_ability": {
      if (!card.oracleTextLower) return "no";
      const textWithoutReminder = card.allOracleTextCombined
        .replace(/\([^)]*\)/g, "")
        .toLowerCase()
        .trim();
      if (!textWithoutReminder) return "no";

      // Check if there's any text that isn't just a mana ability
      // Split into lines/abilities
      const lines = textWithoutReminder.split("\n").map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        // Skip lines that are purely mana abilities (cost: Add {mana})
        if (/^[^:]*:\s*add\s+\{/.test(line) && !/[.;]/.test(line.split("add")[0])) {
          continue;
        }
        // Skip keyword-only lines that are just mana-related
        if (/^(add\s|{t}:\s*add)/.test(line)) {
          continue;
        }
        // If we get here, there's a non-mana ability line
        return "yes";
      }
      return "no";
    }

    // ==================== IS MODAL (Layer 2a — pattern is unambiguous) ====================
    case "is_modal": {
      if (!card.oracleTextLower) return "no";
      const text = card.allOracleTextCombined.replace(/\([^)]*\)/g, "").toLowerCase();
      if (/\bchoose\s+(one|two|three|any|up\s+to)\b/.test(text)) return "yes";
      return "no";
    }

    // ==================== Layer 2b — Semantic-derived ====================
    // These require oracle semantic extraction (action vs trigger vs reference).
    // Until that layer is built, return null → refund.
    // DO NOT use naive substring matching here.
    case "draws_cards":
    case "deals_damage":
    case "gains_life":
    case "causes_life_loss":
    case "destroys_permanents":
    case "exiles":
    case "causes_discard":
    case "searches_library":
    case "interacts_with_graveyard":
    case "sacrifice_effect":
      return null; // → refund until oracle-semantics.ts is implemented

    default:
      return null;
  }
}
