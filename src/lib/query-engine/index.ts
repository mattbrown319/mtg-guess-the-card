import type { NormalizedCard, EngineResult, StructuredQueryEnvelope } from "./types";
import { evaluate } from "./evaluator";
import { validateEnvelope } from "./validator";
import { translateQuestion } from "./translator";

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
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "TRANSLATION_FAILED",
    };
  }

  // Step 3: Validate
  const validation = validateEnvelope(translation.envelope);
  if (!validation.valid) {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Validation failed: ${validation.errors.join("; ")} (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query),
        queryKind: translation.envelope.query.kind,
        validationErrors: validation.errors.join("; "), outcome: "refund",
        reasonCode: "SEMANTIC_VALIDATION_FAILED", usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "SEMANTIC_VALIDATION_FAILED",
      translatedQuery: translation.envelope,
    };
  }

  // Step 4: Check for unsupported
  if (translation.envelope.query.kind === "unsupported" || !translation.envelope.meta.supported) {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Unsupported query (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query), queryKind: "unsupported",
        validationErrors: null, outcome: "refund",
        reasonCode: "UNSUPPORTED_QUERY_KIND", usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "UNSUPPORTED_QUERY_KIND",
      translatedQuery: translation.envelope,
    };
  }

  // Step 5: Evaluate
  const truthValue = evaluate(translation.envelope.query, card);

  if (truthValue === null) {
    const totalMs = Date.now() - t0;
    console.log(`[QE] Evaluator returned null for kind=${translation.envelope.query.kind} (${totalMs}ms)`);
    if (sessionId) {
      persistLog({
        sessionId, cardName: card.name, question,
        translatedQuery: JSON.stringify(translation.envelope.query),
        queryKind: translation.envelope.query.kind, validationErrors: null,
        outcome: "refund", reasonCode: "UNKNOWN_QUERY_KIND",
        usedContext: translation.envelope.meta?.usedContext || false,
        translateLatencyMs: translation.latencyMs, totalLatencyMs: totalMs,
      });
    }
    return {
      outcome: "refund",
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "UNKNOWN_QUERY_KIND",
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
