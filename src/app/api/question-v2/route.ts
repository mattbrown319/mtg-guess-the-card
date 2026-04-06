import { NextRequest, NextResponse } from "next/server";
import { getGame, addQuestion, submitGuess } from "@/lib/game-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { processQuestion, normalizeCard } from "@/lib/query-engine";
import type { NormalizedCard } from "@/lib/query-engine";

// Cache normalized cards per session to avoid re-normalizing each question
const normalizedCardCache = new Map<string, NormalizedCard>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { sessionId, question, requestHint, requestSummary, requestShareSummary } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const game = await getGame(sessionId);
  if (!game) {
    return NextResponse.json(
      { error: "Game not found. It may have expired." },
      { status: 404 }
    );
  }

  // Pass through hint/summary requests to the old LLM system
  if (requestSummary) {
    const { generateSummary } = await import("@/lib/claude");
    const summary = await generateSummary(game.questions);
    return NextResponse.json({ summary });
  }

  if (requestShareSummary) {
    const { generateShareSummary } = await import("@/lib/claude");
    const shareSummary = await generateShareSummary(game.questions);
    return NextResponse.json({ shareSummary });
  }

  if (requestHint) {
    const { getHint } = await import("@/lib/claude");
    const hint = await getHint(game.card, game.questions);
    await addQuestion(sessionId, {
      question: "[Hint requested]",
      answer: hint,
    });
    return NextResponse.json({ hint });
  }

  if (game.status !== "active") {
    return NextResponse.json(
      { error: "Game is no longer active." },
      { status: 400 }
    );
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "Please ask a question." }, { status: 400 });
  }

  if (question.length > 500) {
    return NextResponse.json({ error: "Question too long." }, { status: 400 });
  }

  // Intercept give-up attempts
  const lower = question.trim().toLowerCase();
  const giveUpPhrases = ["i give up", "i quit", "i don't know", "idk", "no idea", "i surrender"];
  if (giveUpPhrases.some((phrase) => lower.includes(phrase))) {
    return NextResponse.json({
      answer: "Don't give up! Use the guess button to submit your best guess, or keep asking questions!",
      questionNumber: game.questionCount,
      questionsRemaining: game.maxQuestions - game.questionCount,
      notCounted: true,
    });
  }

  // Get or create normalized card
  let normalizedCard = normalizedCardCache.get(sessionId);
  if (!normalizedCard) {
    normalizedCard = normalizeCard(game.card);
    normalizedCardCache.set(sessionId, normalizedCard);
    // Clean up old entries (keep last 100)
    if (normalizedCardCache.size > 100) {
      const firstKey = normalizedCardCache.keys().next().value;
      if (firstKey) normalizedCardCache.delete(firstKey);
    }
  }

  // Process through query engine
  const result = await processQuestion(
    normalizedCard,
    question.trim(),
    game.questions,
    sessionId
  );

  // Handle refund — don't count the question
  if (result.outcome === "refund") {
    return NextResponse.json({
      answer: result.playerMessage,
      questionNumber: game.questionCount,
      questionsRemaining: game.maxQuestions - game.questionCount,
      notCounted: true,
      reasonCode: result.reasonCode,
    });
  }

  // Store the Q&A
  const addResult = await addQuestion(sessionId, {
    question: question.trim(),
    answer: result.playerMessage,
  });

  if (!addResult.success) {
    return NextResponse.json({ error: addResult.error }, { status: 400 });
  }

  // Check for correct name guess
  if (result.reasonCode === "CORRECT_GUESS") {
    await submitGuess(sessionId, game.card.name);

    // Store elapsed time if provided
    const elapsedSeconds = body.elapsedSeconds;
    if (elapsedSeconds !== undefined) {
      const db = await import("@/lib/db").then(m => m.getDb());
      await db.execute({
        sql: "UPDATE sessions SET elapsed_seconds = ? WHERE session_id = ?",
        args: [Math.round(elapsedSeconds), sessionId],
      });
    }

    return NextResponse.json({
      answer: result.playerMessage,
      questionNumber: game.questionCount + 1,
      questionsRemaining: game.maxQuestions - game.questionCount - 1,
      correctGuess: true,
      card: {
        name: game.card.name,
        mana_cost: game.card.mana_cost,
        type_line: game.card.type_line,
        oracle_text: game.card.oracle_text,
        rarity: game.card.rarity,
        set_name: game.card.set_name,
        artist: game.card.artist,
        image_uri_normal: game.card.image_uri_normal,
        image_uri_art_crop: game.card.image_uri_art_crop,
        colors: game.card.colors,
        keywords: game.card.keywords,
        power: game.card.power,
        toughness: game.card.toughness,
      },
    });
  }

  return NextResponse.json({
    answer: result.playerMessage,
    questionNumber: game.questionCount + 1,
    questionsRemaining: game.maxQuestions - game.questionCount - 1,
  });
}
