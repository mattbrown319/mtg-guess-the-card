import type { NormalizedCard, EngineResult, StructuredQueryEnvelope } from "./types";
import { evaluate } from "./evaluator";
import { validateEnvelope } from "./validator";
import { translateQuestion } from "./translator";

interface QuestionContext {
  question: string;
  answer: string;
}

export async function processQuestion(
  card: NormalizedCard,
  question: string,
  context: QuestionContext[]
): Promise<EngineResult> {
  const t0 = Date.now();

  // Step 1: Check for direct name guess (deterministic, no LLM needed)
  const nameGuessResult = checkNameGuess(card, question);
  if (nameGuessResult) {
    console.log(`[QE] Name guess: "${question}" → ${nameGuessResult.outcome} (${Date.now() - t0}ms)`);
    return nameGuessResult;
  }

  // Step 2: Translate via Haiku
  const translation = await translateQuestion(question, context);
  const tTranslate = Date.now();

  if (!translation.envelope) {
    console.log(`[QE] Translation failed: ${translation.parseError} (${tTranslate - t0}ms)`);
    console.log(`[QE] Raw output: ${translation.rawOutput.slice(0, 200)}`);
    return {
      outcome: "refund",
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "TRANSLATION_FAILED",
    };
  }

  // Step 3: Validate
  const validation = validateEnvelope(translation.envelope);
  if (!validation.valid) {
    console.log(`[QE] Validation failed: ${validation.errors.join("; ")} (${Date.now() - t0}ms)`);
    console.log(`[QE] Query was: ${JSON.stringify(translation.envelope.query)}`);
    return {
      outcome: "refund",
      playerMessage: "I'm not sure how to answer that — try rephrasing! (This question wasn't counted.)",
      reasonCode: "SEMANTIC_VALIDATION_FAILED",
      translatedQuery: translation.envelope,
    };
  }

  // Step 4: Check for unsupported
  if (translation.envelope.query.kind === "unsupported" || !translation.envelope.meta.supported) {
    console.log(`[QE] Unsupported query (${Date.now() - t0}ms)`);
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
    console.log(`[QE] Evaluator returned null for kind=${translation.envelope.query.kind} (${Date.now() - t0}ms)`);
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
