import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import type { Card, GameState, QuestionAnswer } from "@/types";

const MAX_QUESTIONS = 999;
const DEFAULT_TIME_LIMIT = 180;

export async function createGame(
  card: Card,
  timeLimitSeconds?: number
): Promise<GameState> {
  const db = await getDb();
  const sessionId = uuidv4();
  const now = Date.now();
  const timeLimit = timeLimitSeconds || DEFAULT_TIME_LIMIT;

  await db.execute({
    sql: `INSERT INTO sessions (session_id, card_json, started_at, max_questions, time_limit_seconds)
          VALUES (?, ?, ?, ?, ?)`,
    args: [sessionId, JSON.stringify(card), now, MAX_QUESTIONS, timeLimit],
  });

  return {
    sessionId,
    card,
    questions: [],
    startedAt: now,
    status: "active",
    questionCount: 0,
    maxQuestions: MAX_QUESTIONS,
    timeLimitSeconds: timeLimit,
  };
}

export async function getGame(sessionId: string): Promise<GameState | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM sessions WHERE session_id = ?",
    args: [sessionId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    sessionId: row.session_id as string,
    card: JSON.parse(row.card_json as string),
    questions: JSON.parse(row.questions_json as string),
    startedAt: row.started_at as number,
    status: row.status as GameState["status"],
    guess: (row.guess as string) || undefined,
    correct: row.correct === null ? undefined : row.correct === 1,
    questionCount: row.question_count as number,
    maxQuestions: row.max_questions as number,
    timeLimitSeconds: row.time_limit_seconds as number,
  };
}

export function isGameExpired(game: GameState): boolean {
  if (game.timeLimitSeconds === 0) return false;
  const elapsed = (Date.now() - game.startedAt) / 1000;
  return elapsed > game.timeLimitSeconds;
}

export async function addQuestion(
  sessionId: string,
  qa: QuestionAnswer
): Promise<{ success: boolean; error?: string }> {
  const game = await getGame(sessionId);
  if (!game) return { success: false, error: "Game not found" };
  if (game.status !== "active")
    return { success: false, error: "Game is no longer active" };
  if (game.questionCount >= game.maxQuestions)
    return { success: false, error: "Maximum questions reached" };

  const db = await getDb();
  const questions = [...game.questions, qa];

  await db.execute({
    sql: `UPDATE sessions SET questions_json = ?, question_count = question_count + 1
          WHERE session_id = ?`,
    args: [JSON.stringify(questions), sessionId],
  });

  return { success: true };
}

export async function submitGuess(
  sessionId: string,
  cardName: string
): Promise<{ correct: boolean; card: Card } | null> {
  const game = await getGame(sessionId);
  if (!game) return null;
  if (game.status !== "active") return null;

  const guess = cardName.trim().toLowerCase();
  const actual = game.card.name.toLowerCase();

  let correct = guess === actual;
  if (!correct && game.card.card_faces) {
    correct = game.card.card_faces.some(
      (face) => face.name.toLowerCase() === guess
    );
  }

  const db = await getDb();
  await db.execute({
    sql: `UPDATE sessions SET status = 'guessed', guess = ?, correct = ?
          WHERE session_id = ?`,
    args: [cardName, correct ? 1 : 0, sessionId],
  });

  return { correct, card: game.card };
}

export async function expireGame(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE sessions SET status = 'timeout' WHERE session_id = ? AND status = 'active'",
    args: [sessionId],
  });
}
