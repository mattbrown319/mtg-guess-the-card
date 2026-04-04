export interface Card {
  id: string;
  oracle_id: string;
  name: string;
  layout: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  oracle_text: string | null;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  rarity: string;
  set_code: string;
  set_name: string;
  released_at: string;
  artist: string;
  edhrec_rank: number | null;
  flavor_text: string | null;
  image_uri_normal: string | null;
  image_uri_art_crop: string | null;
  legalities: Record<string, string>;
  card_faces: CardFace[] | null;
  produced_mana: string[] | null;
  all_sets: string[] | null;
  all_years: string[] | null;
}

export interface CardFace {
  name: string;
  mana_cost: string;
  type_line: string;
  oracle_text: string;
  colors: string[];
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  image_uri_normal: string | null;
  image_uri_art_crop: string | null;
}

export interface GameState {
  sessionId: string;
  card: Card;
  questions: QuestionAnswer[];
  startedAt: number;
  status: "active" | "guessed" | "timeout";
  guess?: string;
  correct?: boolean;
  questionCount: number;
  maxQuestions: number;
  timeLimitSeconds: number;
}

export interface QuestionAnswer {
  question: string;
  answer: string;
}

export interface StartGameRequest {
  format?: string;
  popularityTier?: string;
  cardType?: string;
  timeLimitSeconds?: number;
}

export interface StartGameResponse {
  sessionId: string;
  timeLimitSeconds: number;
  maxQuestions: number;
}

export interface AskQuestionRequest {
  sessionId: string;
  question: string;
}

export interface AskQuestionResponse {
  answer: string;
  questionNumber: number;
  questionsRemaining: number;
}

export interface GuessRequest {
  sessionId: string;
  cardName: string;
}

export interface GuessResponse {
  correct: boolean;
  card: Card;
  questionsAsked: number;
}
