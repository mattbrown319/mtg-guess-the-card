import type { NormalizedCard, EngineResult, StructuredQueryEnvelope } from "./types";
import { evaluate } from "./evaluator";
import { validateEnvelope } from "./validator";
import { translateQuestion } from "./translator";
import { askSonnet } from "./sonnet-fallback";
import { logLlmCost } from "@/lib/llm-cost-logger";

interface QuestionContext {
  question: string;
  answer: string;
}

export interface QueryLogEntry {
  sessionId: string;
  cardName: string;
  question: string;
  translatedQuery: string | null;
  queryKind: string | null;
  validationErrors: string | null;
  outcome: string;
  reasonCode: string | null;
  usedContext: boolean;
  translateLatencyMs: number | null;
  totalLatencyMs: number;
}

async function persistSonnetLog(entry: {
  sessionId: string;
  cardName: string;
  question: string;
  triggerReason: string;
  cardContext: string;
  rawOutput: string;
  parsedOutcome: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}): Promise<void> {
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO sonnet_fallback_logs (session_id, card_name, question, trigger_reason, card_context, raw_output, parsed_outcome, input_tokens, output_tokens, latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entry.sessionId, entry.cardName, entry.question, entry.triggerReason,
        entry.cardContext, entry.rawOutput, entry.parsedOutcome,
        entry.inputTokens, entry.outputTokens, entry.latencyMs, Date.now(),
      ],
    });
  } catch (e) {
    console.error("[QE] Failed to persist sonnet fallback log:", e);
  }
}

async function persistLog(entry: QueryLogEntry): Promise<void> {
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO query_logs (session_id, card_name, question, translated_query, query_kind, validation_errors, outcome, reason_code, used_context, translate_latency_ms, total_latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entry.sessionId, entry.cardName, entry.question,
        entry.translatedQuery, entry.queryKind, entry.validationErrors,
        entry.outcome, entry.reasonCode, entry.usedContext ? 1 : 0,
        entry.translateLatencyMs, entry.totalLatencyMs, Date.now(),
      ],
    });
  } catch (e) {
    console.error("[QE] Failed to persist log:", e);
  }
}

export async function processQuestion(
  card: NormalizedCard,
  question: string,
  context: QuestionContext[],
  sessionId?: string
): Promise<EngineResult> {
  const t0 = Date.now();

  // Step 1: Check for direct name guess (deterministic, no LLM needed)
  const nameGuessResult = checkNameGuess(card, question);
  if (nameGuessResult) {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Name guess: "${question}" → ${nameGuessResult.outcome} (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: null, queryKind: "name_equals_local",
        validationErrors: null, outcome: nameGuessResult.outcome,
        reasonCode: nameGuessResult.reasonCode || null,
        usedContext: false, translateLatencyMs: null, totalLatencyMs: totalMs,
      });
    }
    return nameGuessResult;
  }

  // Step 2: Translate via Haiku
  const translation = await translateQuestion(question, context);
  const tTranslate = Date.now();

  // Log translator cost
  if (translation.inputTokens > 0) {
    logLlmCost({
      sessionId: sessionId || null,
      callType: "translator",
      model: "haiku",
      inputTokens: translation.inputTokens,
      outputTokens: translation.outputTokens,
      latencyMs: translation.latencyMs,
    });
  }

  if (!translation.envelope) {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Translation failed: ${translation.parseError} (${totalMs}ms)`);
    console.log(`[QE] Raw output: ${translation.rawOutput.slice(0, 200)}`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: translation.rawOutput.slice(0, 500), queryKind: null,
        validationErrors: translation.parseError || null, outcome: "refund",
        reasonCode: "TRANSLATION_FAILED", usedContext: context.length > 0,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
      reasonCode: "TRANSLATION_FAILED",
    };
  }

  // Step 3: Validate
  const validation = validateEnvelope(translation.envelope);
  if (!validation.valid) {
    if (validation.isNearMiss) {
      // Near miss: known kind but bad params — fall back to Sonnet
      console.log(`[QE] Validation near-miss: ${validation.errors.join("; ")} — falling back to Sonnet`);
      const sonnetResult = await askSonnet(card, question);
      const totalMs = Date.now() - t0;
      logLlmCost({ sessionId: sessionId || null, callType: "sonnet_fallback_near_miss", model: "sonnet", inputTokens: sonnetResult.inputTokens, outputTokens: sonnetResult.outputTokens, latencyMs: sonnetResult.latencyMs });

      console.log(`[QE] Sonnet fallback (near-miss): "${question}" → ${sonnetResult.outcome} (${sonnetResult.latencyMs}ms)`);

      if (sessionId) {
        persistLog({
          sessionId, cardName: card.name, question,
          translatedQuery: JSON.stringify(translation.envelope.query),
          queryKind: "sonnet_fallback",
          validationErrors: validation.errors.join("; "), outcome: sonnetResult.outcome,
          reasonCode: "VALIDATION_NEAR_MISS_FALLBACK", usedContext: translation.envelope.meta?.usedContext || false,
          translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
        });
        persistSonnetLog({
          sessionId, cardName: card.name, question,
          triggerReason: "VALIDATION_NEAR_MISS: " + validation.errors.join("; "),
          cardContext: sonnetResult.cardContext,
          rawOutput: sonnetResult.rawOutput,
          parsedOutcome: sonnetResult.outcome,
          inputTokens: sonnetResult.inputTokens,
          outputTokens: sonnetResult.outputTokens,
          latencyMs: sonnetResult.latencyMs,
        });
      }

      if (sonnetResult.outcome === "refund") {
        return {
          outcome: "refund",
          playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
          reasonCode: "SONNET_FALLBACK_FAILED",
          translatedQuery: translation.envelope,
        };
      }

      return {
        outcome: sonnetResult.outcome,
        playerMessage: sonnetResult.answer,
        truthValue: sonnetResult.outcome as "yes" | "no" | "sometimes",
        reasonCode: "VALIDATION_NEAR_MISS_FALLBACK",
        translatedQuery: translation.envelope,
      };
    }

    // Hard fail: malformed structure — refund
    const totalMs = Date.now() - t0;
    console.log(`[QE] Validation hard fail: ${validation.errors.join("; ")} (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query),
        queryKind: translation.envelope.query.kind,
        validationErrors: validation.errors.join("; "), outcome: "refund",
        reasonCode: "VALIDATION_HARD_FAIL", usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
      reasonCode: "VALIDATION_HARD_FAIL",
      translatedQuery: translation.envelope,
    };
  }

  // Step 4a: Subjective questions — refund without hitting Sonnet
  if (translation.envelope.query.kind === "subjective") {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Subjective question — refunding (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query), queryKind: "subjective",
        validationErrors: null, outcome: "refund",
        reasonCode: "SUBJECTIVE_QUESTION", usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
      reasonCode: "SUBJECTIVE_QUESTION",
      translatedQuery: translation.envelope,
    };
  }

  // Step 4b: Unsupported factual questions — fall back to Sonnet
  if (translation.envelope.query.kind === "unsupported" || !translation.envelope.meta.supported) {
    console.log(`[QE] Unsupported query — falling back to Sonnet`);
    const sonnetResult = await askSonnet(card, question);
    const totalMs = Date.now() - t0;
    logLlmCost({ sessionId: sessionId || null, callType: "sonnet_fallback_unsupported", model: "sonnet", inputTokens: sonnetResult.inputTokens, outputTokens: sonnetResult.outputTokens, latencyMs: sonnetResult.latencyMs });

    console.log(`[QE] Sonnet fallback: "${question}" → ${sonnetResult.outcome} (${sonnetResult.latencyMs}ms, ${sonnetResult.inputTokens}+${sonnetResult.outputTokens} tokens)`);

    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query), queryKind: "sonnet_fallback",
        validationErrors: null, outcome: sonnetResult.outcome,
        reasonCode: "SONNET_FALLBACK_UNSUPPORTED", usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
      persistSonnetLog({
        sessionId, cardName: card.name, question,
        triggerReason: "UNSUPPORTED_QUERY_KIND",
        cardContext: sonnetResult.cardContext,
        rawOutput: sonnetResult.rawOutput,
        parsedOutcome: sonnetResult.outcome,
        inputTokens: sonnetResult.inputTokens,
        outputTokens: sonnetResult.outputTokens,
        latencyMs: sonnetResult.latencyMs,
      });
    }

    if (sonnetResult.outcome === "refund") {
      return {
        outcome: "refund",
        playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
        reasonCode: "SONNET_FALLBACK_FAILED",
        translatedQuery: translation.envelope,
      };
    }

    return {
      outcome: sonnetResult.outcome,
      playerMessage: sonnetResult.answer,
      truthValue: sonnetResult.outcome as "yes" | "no" | "sometimes",
      reasonCode: "SONNET_FALLBACK_UNSUPPORTED",
      translatedQuery: translation.envelope,
    };
  }

  // Step 5: Evaluate
  const truthValue = evaluate(translation.envelope.query, card);

  // If evaluator returns null (no semantic data), fall back to Sonnet
  if (truthValue === null) {
    console.log(`[QE] Evaluator null for kind=${translation.envelope.query.kind} — falling back to Sonnet`);
    const sonnetResult = await askSonnet(card, question);
    const totalMs = Date.now() - t0;
    logLlmCost({ sessionId: sessionId || null, callType: "sonnet_fallback_null_eval", model: "sonnet", inputTokens: sonnetResult.inputTokens, outputTokens: sonnetResult.outputTokens, latencyMs: sonnetResult.latencyMs });

    console.log(`[QE] Sonnet fallback: "${question}" → ${sonnetResult.outcome} (${sonnetResult.latencyMs}ms, ${sonnetResult.inputTokens}+${sonnetResult.outputTokens} tokens)`);

    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query),
        queryKind: "sonnet_fallback", validationErrors: null,
        outcome: sonnetResult.outcome, reasonCode: "SONNET_FALLBACK_NULL_EVAL",
        usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
      persistSonnetLog({
        sessionId, cardName: card.name, question,
        triggerReason: "NULL_EVALUATOR_" + translation.envelope.query.kind,
        cardContext: sonnetResult.cardContext,
        rawOutput: sonnetResult.rawOutput,
        parsedOutcome: sonnetResult.outcome,
        inputTokens: sonnetResult.inputTokens,
        outputTokens: sonnetResult.outputTokens,
        latencyMs: sonnetResult.latencyMs,
      });
    }

    if (sonnetResult.outcome === "refund") {
      return {
        outcome: "refund",
        playerMessage: "I'm not sure about that — try asking something else or rephrasing.",
        reasonCode: "SONNET_FALLBACK_FAILED",
        translatedQuery: translation.envelope,
      };
    }

    return {
      outcome: sonnetResult.outcome,
      playerMessage: sonnetResult.answer,
      truthValue: sonnetResult.outcome as "yes" | "no" | "sometimes",
      reasonCode: "SONNET_FALLBACK_NULL_EVAL",
      translatedQuery: translation.envelope,
    };
  }

  const totalMs = Date.now() - t0;
  const outcome = truthValue;
  const playerMessage = truthValue === "yes" ? "Yes."
    : truthValue === "no" ? "No."
    : "Sometimes.";

  console.log(`[QE] "${question}" → ${JSON.stringify(translation.envelope.query)} → ${outcome} (translate: ${translation.latencyMs}ms, total: ${totalMs}ms)`);

  // Check if this was a correct name guess via name_equals
  const isCorrectGuess = translation.envelope.query.kind === "name_equals"
    && truthValue === "yes";

  if (sessionId) {
    persistLog({
      sessionId, cardName: card.name, question,
      translatedQuery: JSON.stringify(translation.envelope.query),
      queryKind: translation.envelope.query.kind, validationErrors: null,
      outcome, reasonCode: isCorrectGuess ? "CORRECT_GUESS" : null,
      usedContext: translation.envelope.meta?.usedContext || false,
      translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
    });
  }

  return {
    outcome,
    playerMessage,
    translatedQuery: translation.envelope,
    truthValue,
    reasonCode: isCorrectGuess ? "CORRECT_GUESS" : undefined,
  };
}

function checkNameGuess(card: NormalizedCard, question: string): EngineResult | null {
  // Quick check: if the question is very short and looks like just a card name
  const q = question.trim().toLowerCase();

  // Strip common prefixes
  let name = q;
  for (const prefix of ["is it ", "is this ", "it's ", "its "]) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  // Strip trailing ?
  name = name.replace(/\?+$/, "").trim();

  // Check if the remaining text matches any card name
  if (card.allFaceNamesLower.some(n => n === name)) {
    return {
      outcome: "yes",
      playerMessage: "Yes.",
      reasonCode: "CORRECT_GUESS",
    };
  }

  // Don't return "no" here — let the translator handle it,
  // since the question might not actually be a name guess
  return null;
}

export { normalizeCard } from "./normalize";
export type { NormalizedCard, EngineResult, StructuredQueryEnvelope } from "./types";
