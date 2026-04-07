// Centralized LLM cost logging — tracks every API call for cost analysis

export interface LlmCostEntry {
  sessionId: string | null;
  callType: string;  // "translator", "sonnet_fallback", "hint", "summary", "share_summary", "v1_question"
  model: string;     // "haiku", "sonnet"
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export async function logLlmCost(entry: LlmCostEntry): Promise<void> {
  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO llm_cost_logs (session_id, call_type, model, input_tokens, output_tokens, latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entry.sessionId, entry.callType, entry.model,
        entry.inputTokens, entry.outputTokens, entry.latencyMs,
        Date.now(),
      ],
    });
  } catch (e) {
    console.error("[LLM Cost] Failed to log:", e);
  }
}
