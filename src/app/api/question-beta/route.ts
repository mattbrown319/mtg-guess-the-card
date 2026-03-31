import { NextRequest, NextResponse } from "next/server";
import { getGame, addQuestion } from "@/lib/game-store";
import { getHint, generateSummary } from "@/lib/claude";
import { answerQuestionBeta } from "@/lib/claude-beta";
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
  const { sessionId, question, requestHint, requestSummary, requestShareSummary } = body;

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

  // Handle summary requests
  if (requestSummary) {
    const summary = await generateSummary(game.questions);
    return NextResponse.json({ summary });
  }

  if (requestShareSummary) {
    const { generateShareSummary } = await import("@/lib/claude");
    const shareSummary = await generateShareSummary(game.questions);
    return NextResponse.json({ shareSummary });
  }

  // Handle hint requests
  if (requestHint) {
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

  // Intercept give-up attempts
  const lower = question.trim().toLowerCase();
  const giveUpPhrases = ["i give up", "i quit", "i don't know", "idk", "no idea", "i surrender"];
  if (giveUpPhrases.some((phrase) => lower.includes(phrase))) {
    return NextResponse.json({
      answer: "Don't give up! Use the guess button to submit your best guess, or keep asking questions!",
      attrs: {},
      questionNumber: game.questionCount,
      questionsRemaining: game.maxQuestions - game.questionCount,
      notCounted: true,
    });
  }

  let answer: string;
  let attrs: Record<string, unknown> = {};
  try {
    const result = await answerQuestionBeta(game.card, question.trim(), game.questions);
    answer = result.answer;
    attrs = result.attrs;
  } catch (err: unknown) {
    console.error("Claude API error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error calling AI";
    return NextResponse.json(
      { error: `AI service error: ${message}` },
      { status: 502 }
    );
  }

  // Check for correct guess
  const correctGuess = answer.includes("[CORRECT_GUESS]");
  const cleanAnswer = answer.replace("[CORRECT_GUESS]", "").trim();

  const addResult = await addQuestion(sessionId, {
    question: question.trim(),
    answer: cleanAnswer,
  });

  if (!addResult.success) {
    return NextResponse.json({ error: addResult.error }, { status: 400 });
  }

  if (correctGuess) {
    const { submitGuess } = await import("@/lib/game-store");
    await submitGuess(sessionId, game.card.name);
    return NextResponse.json({
      answer: cleanAnswer,
      attrs,
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
    answer: cleanAnswer,
    attrs,
    questionNumber: game.questionCount + 1,
    questionsRemaining: game.maxQuestions - game.questionCount - 1,
  });
}
