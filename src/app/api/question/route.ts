import { NextRequest, NextResponse } from "next/server";
import { getGame, addQuestion, isGameExpired, expireGame } from "@/lib/game-store";
import { answerQuestion, getHint } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rate-limit";

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
  const { sessionId, question, requestHint, requestSummary } = body;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  const game = await getGame(sessionId);
  if (!game) {
    return NextResponse.json(
      { error: "Game not found. It may have expired." },
      { status: 404 }
    );
  }

  // Handle summary requests — allowed even after game ends
  if (requestSummary) {
    const { generateSummary } = await import("@/lib/claude");
    const summary = await generateSummary(game.questions);
    return NextResponse.json({ summary });
  }

  // Handle hint requests — allowed as long as game was active at some point
  if (requestHint) {
    const hint = await getHint(game.card, game.questions);
    // Store hint in Q&A log
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

  if (isGameExpired(game)) {
    await expireGame(sessionId);
    return NextResponse.json(
      { error: "Time's up!", expired: true },
      { status: 400 }
    );
  }

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "Please ask a question." },
      { status: 400 }
    );
  }

  if (question.length > 500) {
    return NextResponse.json(
      { error: "Question too long." },
      { status: 400 }
    );
  }

  // Intercept give-up / name-guess attempts before they reach the LLM
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

  let answer: string;
  try {
    answer = await answerQuestion(game.card, question.trim(), game.questions);
  } catch (err: unknown) {
    console.error("Claude API error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error calling AI";
    return NextResponse.json(
      { error: `AI service error: ${message}` },
      { status: 502 }
    );
  }

  const result = await addQuestion(sessionId, {
    question: question.trim(),
    answer,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    answer,
    questionNumber: game.questionCount + 1,
    questionsRemaining: game.maxQuestions - game.questionCount - 1,
  });
}
