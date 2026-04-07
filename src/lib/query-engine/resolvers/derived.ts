import type { AtomicQuery, NormalizedCard } from "../types";
import type { TruthValue } from "../truth";
import { normalizeTargetKinds, matchesTargetKind } from "../target-normalization";

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
    // These use pre-classified oracle semantic summaries (generated by Sonnet).
    // If no semantics available for this card, return null → refund.

    case "draws_cards": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.drawsCards ? "yes" : "no";
    }

    case "deals_damage": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.dealsDamage ? "yes" : "no";
    }

    case "gains_life": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.gainsLife ? "yes" : "no";
    }

    case "causes_life_loss": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.causesLifeLoss ? "yes" : "no";
    }

    case "destroys_permanents": {
      const s = card.semantics;
      if (!s) return null;
      const a = s.actions;
      return (a.destroysCreature || a.destroysArtifact || a.destroysEnchantment ||
              a.destroysLand || a.destroysPermanent) ? "yes" : "no";
    }

    case "exiles": {
      const s = card.semantics;
      if (!s) return null;
      const a = s.actions;
      return (a.exilesCreature || a.exilesArtifact || a.exilesEnchantment ||
              a.exilesLand || a.exilesPermanent || a.exilesFromGraveyard ||
              a.exilesFromLibrary || a.exilesFromHand) ? "yes" : "no";
    }

    case "causes_discard": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.discardsCards ? "yes" : "no";
    }

    case "searches_library": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.searchesLibrary ? "yes" : "no";
    }

    case "interacts_with_graveyard": {
      const s = card.semantics;
      if (!s) return null;
      const a = s.actions;
      return (a.reanimatesSelf || a.reanimatesOther || a.exilesFromGraveyard ||
              s.conditions.caresAboutGraveyard || s.references.mentionsGraveyard) ? "yes" : "no";
    }

    case "sacrifice_effect": {
      const s = card.semantics;
      if (!s) return null;
      return (s.actions.sacrificesOwnPermanent || s.actions.forcesOpponentSacrifice) ? "yes" : "no";
    }

    // ==================== STATIC ABILITY ====================
    case "static_ability": {
      const s = card.semantics;
      if (!s) return null;
      return (s.structure.hasStaticAbility || s.structure.hasReplacementEffect ||
              s.structure.hasPreventionEffect) ? "yes" : "no";
    }

    // ==================== GRANTS ABILITIES ====================
    case "grants_abilities": {
      const s = card.semantics;
      if (!s) return null;
      return (s.actions.grantsKeywords || s.actions.grantsEvasion ||
              s.actions.grantsPTBonus || s.actions.grantsPTPenalty) ? "yes" : "no";
    }

    // ==================== STRUCTURE — specific trigger types ====================
    case "replacement_effect": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasReplacementEffect ? "yes" : "no";
    }
    case "prevention_effect": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasPreventionEffect ? "yes" : "no";
    }
    case "leaves_battlefield_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasLeavesBattlefieldTrigger ? "yes" : "no";
    }
    case "dies_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasDiesTrigger ? "yes" : "no";
    }
    case "attack_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasAttackTrigger ? "yes" : "no";
    }
    case "block_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasBlockTrigger ? "yes" : "no";
    }
    case "upkeep_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasUpkeepTrigger ? "yes" : "no";
    }
    case "combat_damage_trigger": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasCombatDamageTrigger ? "yes" : "no";
    }

    // ==================== COSTS ====================
    case "has_additional_cost": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasAdditionalCost ? "yes" : "no";
    }
    case "has_alternative_cost": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasAlternativeCost ? "yes" : "no";
    }
    case "has_kicker_or_optional_cost": {
      const s = card.semantics;
      if (!s) return null;
      return s.structure.hasOptionalAdditionalCost ? "yes" : "no";
    }

    // ==================== ACTIONS — library manipulation ====================
    case "mills_cards": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.millsCards ? "yes" : "no";
    }
    case "surveils": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.surveils ? "yes" : "no";
    }
    case "scries": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.scries ? "yes" : "no";
    }
    case "looks_at_top_of_library": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.looksAtTopOfLibrary ? "yes" : "no";
    }
    case "shuffles_library": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.shufflesLibrary ? "yes" : "no";
    }

    // ==================== ACTIONS — mana/spells ====================
    case "adds_mana": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.addsMana ? "yes" : "no";
    }
    case "counters_spells": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.countersSpells ? "yes" : "no";
    }
    case "copies_spells": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.copiesSpells ? "yes" : "no";
    }
    case "copies_permanents": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.copiesPermanents ? "yes" : "no";
    }

    // ==================== ACTIONS — tap/untap ====================
    case "taps_things": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.tapsThings ? "yes" : "no";
    }
    case "untaps_things": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.untapsThings ? "yes" : "no";
    }

    // ==================== ACTIONS — P/T modification ====================
    case "grants_pt_bonus": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.grantsPTBonus ? "yes" : "no";
    }
    case "grants_pt_penalty": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.grantsPTPenalty ? "yes" : "no";
    }

    // ==================== ACTIONS — counters ====================
    case "uses_plus_one_counters": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.usesPlusOneCounters ? "yes" : "no";
    }
    case "uses_minus_one_counters": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.usesMinusOneCounters ? "yes" : "no";
    }

    // ==================== ACTIONS — land ====================
    case "fetches_land": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.fetchesLand ? "yes" : "no";
    }
    case "fetches_basic_land": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.fetchesBasicLand ? "yes" : "no";
    }
    case "lets_play_extra_lands": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.letsPlayExtraLands ? "yes" : "no";
    }

    // ==================== ACTIONS — life/turns ====================
    case "pays_life": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.paysLife ? "yes" : "no";
    }
    case "takes_extra_turn": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.takesExtraTurn ? "yes" : "no";
    }

    // ==================== ACTIONS — damage prevention/redirect ====================
    case "prevents_damage": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.preventsDamage ? "yes" : "no";
    }
    case "redirects_damage": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.redirectsDamage ? "yes" : "no";
    }

    // ==================== ACTIONS — animation ====================
    case "animates_self": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.animatesSelf ? "yes" : "no";
    }
    case "animates_other": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.animatesOtherPermanent ? "yes" : "no";
    }

    // ==================== ACTIONS — restrictions/taxes ====================
    case "restricts_actions": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.restrictsActions ? "yes" : "no";
    }
    case "taxes_opponent": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.taxesOpponent ? "yes" : "no";
    }
    case "reduces_costs": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.reducesCosts ? "yes" : "no";
    }

    // ==================== ACTIONS — flicker ====================
    case "flickers_or_blinks": {
      const s = card.semantics;
      if (!s) return null;
      return s.actions.flickersOrBlinks ? "yes" : "no";
    }

    // ==================== CONDITIONS — what the card cares about ====================
    case "cares_about_creatures": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutCreatures ? "yes" : "no";
    }
    case "cares_about_artifacts": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutArtifacts ? "yes" : "no";
    }
    case "cares_about_enchantments": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutEnchantments ? "yes" : "no";
    }
    case "cares_about_lands": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutLands ? "yes" : "no";
    }
    case "cares_about_cards_drawn": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutCardsDrawn ? "yes" : "no";
    }
    case "cares_about_discard": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutDiscard ? "yes" : "no";
    }
    case "cares_about_life_gain_or_loss": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutLifeGainOrLoss ? "yes" : "no";
    }
    case "cares_about_counters": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutCounters ? "yes" : "no";
    }
    case "cares_about_casting_spells": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutCastingSpells ? "yes" : "no";
    }
    case "cares_about_death": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutDeath ? "yes" : "no";
    }
    case "cares_about_combat": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutCombat ? "yes" : "no";
    }
    case "cares_about_power_or_toughness": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutPowerOrToughness ? "yes" : "no";
    }
    case "cares_about_tokens": {
      const s = card.semantics;
      if (!s) return null;
      return s.conditions.caresAboutTokens ? "yes" : "no";
    }

    // ==================== GRANULAR DESTRUCTION ====================
    case "destroys_creature": { const s = card.semantics; if (!s) return null; return s.actions.destroysCreature ? "yes" : "no"; }
    case "destroys_artifact": { const s = card.semantics; if (!s) return null; return s.actions.destroysArtifact ? "yes" : "no"; }
    case "destroys_enchantment": { const s = card.semantics; if (!s) return null; return s.actions.destroysEnchantment ? "yes" : "no"; }
    case "destroys_land": { const s = card.semantics; if (!s) return null; return s.actions.destroysLand ? "yes" : "no"; }

    // ==================== GRANULAR EXILE ====================
    case "exiles_creature": { const s = card.semantics; if (!s) return null; return s.actions.exilesCreature ? "yes" : "no"; }
    case "exiles_from_graveyard": { const s = card.semantics; if (!s) return null; return s.actions.exilesFromGraveyard ? "yes" : "no"; }
    case "exiles_from_hand": { const s = card.semantics; if (!s) return null; return s.actions.exilesFromHand ? "yes" : "no"; }
    case "exiles_from_library": { const s = card.semantics; if (!s) return null; return s.actions.exilesFromLibrary ? "yes" : "no"; }

    // ==================== GRANULAR REANIMATE/BOUNCE ====================
    case "reanimates_self": { const s = card.semantics; if (!s) return null; return s.actions.reanimatesSelf ? "yes" : "no"; }
    case "reanimates_other": { const s = card.semantics; if (!s) return null; return s.actions.reanimatesOther ? "yes" : "no"; }
    case "returns_to_hand": { const s = card.semantics; if (!s) return null; return s.actions.returnsToHand ? "yes" : "no"; }
    case "bounces_creature": { const s = card.semantics; if (!s) return null; return s.actions.bouncesCreature ? "yes" : "no"; }
    case "bounces_permanent": { const s = card.semantics; if (!s) return null; return s.actions.bouncesPermanent ? "yes" : "no"; }

    // ==================== GRANULAR SACRIFICE ====================
    case "sacrifices_own_permanent": { const s = card.semantics; if (!s) return null; return s.actions.sacrificesOwnPermanent ? "yes" : "no"; }
    case "forces_opponent_sacrifice": { const s = card.semantics; if (!s) return null; return s.actions.forcesOpponentSacrifice ? "yes" : "no"; }

    // ==================== GRANULAR DRAW/DISCARD BY WHO ====================
    case "draws_cards_for_controller": { const s = card.semantics; if (!s) return null; return s.actions.drawsCardsForController ? "yes" : "no"; }
    case "draws_cards_for_opponent": { const s = card.semantics; if (!s) return null; return s.actions.drawsCardsForOpponent ? "yes" : "no"; }
    case "discards_for_controller": { const s = card.semantics; if (!s) return null; return s.actions.discardsForController ? "yes" : "no"; }
    case "forces_opponent_discard": { const s = card.semantics; if (!s) return null; return s.actions.forcesOpponentDiscard ? "yes" : "no"; }

    // ==================== GRANULAR LIFE BY WHO ====================
    case "gains_life_for_controller": { const s = card.semantics; if (!s) return null; return s.actions.gainsLifeForController ? "yes" : "no"; }
    case "gains_life_for_opponent": { const s = card.semantics; if (!s) return null; return s.actions.gainsLifeForOpponent ? "yes" : "no"; }
    case "causes_life_loss_for_controller": { const s = card.semantics; if (!s) return null; return s.actions.causesLifeLossForController ? "yes" : "no"; }
    case "causes_life_loss_for_opponent": { const s = card.semantics; if (!s) return null; return s.actions.causesLifeLossForOpponent ? "yes" : "no"; }

    // ==================== GRANULAR GRANTS ====================
    case "grants_keywords": { const s = card.semantics; if (!s) return null; return s.actions.grantsKeywords ? "yes" : "no"; }
    case "grants_evasion": { const s = card.semantics; if (!s) return null; return s.actions.grantsEvasion ? "yes" : "no"; }

    // ==================== P/T MODIFICATION ====================
    case "modifies_power": { const s = card.semantics; if (!s) return null; return s.actions.modifiesPower ? "yes" : "no"; }
    case "modifies_toughness": { const s = card.semantics; if (!s) return null; return s.actions.modifiesToughness ? "yes" : "no"; }

    // ==================== COUNTERS/MANA ====================
    case "adds_other_counters": { const s = card.semantics; if (!s) return null; return s.actions.addsOtherCounters ? "yes" : "no"; }
    case "filters_mana": { const s = card.semantics; if (!s) return null; return s.actions.filtersMana ? "yes" : "no"; }
    case "can_add_any_color": { const s = card.semantics; if (!s) return null; return s.actions.canAddAnyColor ? "yes" : "no"; }
    case "can_add_multiple_colors": { const s = card.semantics; if (!s) return null; return s.actions.canAddMultipleColors ? "yes" : "no"; }

    // ==================== SPECIAL ====================
    case "makes_monarch": { const s = card.semantics; if (!s) return null; return s.actions.makesMonarch ? "yes" : "no"; }
    case "creates_emblem": { const s = card.semantics; if (!s) return null; return s.actions.createsEmblem ? "yes" : "no"; }
    case "phase_out": { const s = card.semantics; if (!s) return null; return s.actions.phaseOut ? "yes" : "no"; }

    // ==================== REMAINING CONDITIONS ====================
    case "cares_about_nonbasic_lands": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutNonbasicLands ? "yes" : "no"; }
    case "cares_about_instants_and_sorceries": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutInstantsAndSorceries ? "yes" : "no"; }
    case "cares_about_enter_battlefield": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutEnterBattlefield ? "yes" : "no"; }
    case "cares_about_leave_battlefield": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutLeaveBattlefield ? "yes" : "no"; }
    case "cares_about_damage": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutDamage ? "yes" : "no"; }
    case "cares_about_tapped_untapped": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutTappedUntappedState ? "yes" : "no"; }
    case "cares_about_colors": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutColors ? "yes" : "no"; }
    case "cares_about_mana_spent": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutManaSpent ? "yes" : "no"; }
    case "cares_about_equipment": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutEquipment ? "yes" : "no"; }
    case "cares_about_auras": { const s = card.semantics; if (!s) return null; return s.conditions.caresAboutAuras ? "yes" : "no"; }

    // ==================== PARAMETERIZED TARGETING ====================
    case "targets_kind": {
      const s = card.semantics;
      if (!s) return null;
      const rawKinds = s.targeting.targetKinds || [];
      if (rawKinds.length === 0) return "no";
      const normalized = normalizeTargetKinds(rawKinds);
      const queryValue = (query as { kind: "targets_kind"; value: string }).value.toLowerCase();
      return matchesTargetKind(normalized, queryValue) ? "yes" : "no";
    }

    default:
      return null;
  }
}
