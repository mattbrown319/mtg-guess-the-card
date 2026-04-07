import Anthropic from "@anthropic-ai/sdk";
import type { StructuredQueryEnvelope } from "./types";
import { TRANSLATOR_SYSTEM_PROMPT } from "./translator-prompt";

const client = new Anthropic();

export interface TranslationResult {
  envelope: StructuredQueryEnvelope | null;
  rawOutput: string;
  parseError?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function translateQuestion(
  question: string,
  context: { question: string; answer: string }[]
): Promise<TranslationResult> {
  const t0 = Date.now();

  // Build context string from last 5 Q&A pairs
  const contextLines = context.slice(-5).map(
    (qa, i) => `Q${i + 1}: "${qa.question}" → ${qa.answer}`
  ).join("\n");

  const userMessage = contextLines
    ? `Previous questions:\n${contextLines}\n\nNew question: "${question}"`
    : `Question: "${question}"`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: TRANSLATOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawOutput = textBlock?.text || "";
    const latencyMs = Date.now() - t0;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    // Try to parse JSON from the response
    // The model might wrap it in markdown code blocks
    let jsonStr = rawOutput.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr) as StructuredQueryEnvelope;

      // Ensure meta exists
      if (!parsed.meta) {
        parsed.meta = {
          supported: true,
          usedContext: false,
          warnings: [],
          translatorModel: "haiku",
        };
      }
      parsed.meta.translatorModel = "haiku";

      return { envelope: parsed, rawOutput, latencyMs, inputTokens, outputTokens };
    } catch (e) {
      return {
        envelope: null,
        rawOutput,
        parseError: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
        latencyMs,
        inputTokens,
        outputTokens,
      };
    }
  } catch (e) {
    return {
      envelope: null,
      rawOutput: "",
      parseError: `API error: ${e instanceof Error ? e.message : String(e)}`,
      latencyMs: Date.now() - t0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
