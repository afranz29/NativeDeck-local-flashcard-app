import type { Card } from "./db";

/** Consecutive correct answers needed to consider a card mastered. */
export const MASTERY_TARGET = 3;

export type Direction = "term-to-def" | "def-to-term" | "random";
export type QuestionType = "multiple-choice" | "true-false";

export interface MultipleChoiceQuestion {
  kind: "multiple-choice";
  card: Card;
  promptSide: "term" | "definition";
  answerSide: "term" | "definition";
  /** Shuffled, includes the correct answer. 2-4 entries. */
  choices: string[];
}

export interface TrueFalseQuestion {
  kind: "true-false";
  card: Card;
  term: string;
  termImage?: string;
  definition: string;
  definitionImage?: string;
  /** Whether the displayed term/definition pair is a genuine match. */
  isTrue: boolean;
}

export type Question = MultipleChoiceQuestion | TrueFalseQuestion;

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestion(
  card: Card,
  pool: Card[],
  direction: Direction,
  allowedTypes: QuestionType[]
): Question {
  const type =
    allowedTypes.length <= 1
      ? allowedTypes[0] ?? "multiple-choice"
      : allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
  return type === "true-false"
    ? buildTrueFalseQuestion(card, pool)
    : buildMultipleChoiceQuestion(card, pool, direction);
}

function buildMultipleChoiceQuestion(
  card: Card,
  pool: Card[],
  direction: Direction
): MultipleChoiceQuestion {
  const resolved =
    direction === "random" ? (Math.random() < 0.5 ? "term-to-def" : "def-to-term") : direction;
  const promptSide: "term" | "definition" = resolved === "term-to-def" ? "term" : "definition";
  const answerSide: "term" | "definition" = resolved === "term-to-def" ? "definition" : "term";
  const correct = (answerSide === "term" ? card.term : card.definition).trim();

  const distractorPool = pool
    .filter((c) => c.id !== card.id)
    .map((c) => (answerSide === "term" ? c.term : c.definition).trim())
    .filter((t) => t.length > 0 && t !== correct);
  const distractors = shuffle([...new Set(distractorPool)]).slice(0, 3);

  return {
    kind: "multiple-choice",
    card,
    promptSide,
    answerSide,
    choices: shuffle([correct, ...distractors]),
  };
}

function buildTrueFalseQuestion(card: Card, pool: Card[]): TrueFalseQuestion {
  const isTrue = Math.random() < 0.5;
  if (isTrue) {
    return {
      kind: "true-false",
      card,
      term: card.term,
      termImage: card.termImage,
      definition: card.definition,
      definitionImage: card.definitionImage,
      isTrue: true,
    };
  }

  const others = pool.filter(
    (c) => c.id !== card.id && c.definition.trim().length > 0 && c.definition.trim() !== card.definition.trim()
  );
  if (others.length === 0) {
    // No valid distractor definition exists in this set — fall back to a true statement.
    return {
      kind: "true-false",
      card,
      term: card.term,
      termImage: card.termImage,
      definition: card.definition,
      definitionImage: card.definitionImage,
      isTrue: true,
    };
  }

  const other = others[Math.floor(Math.random() * others.length)];
  return {
    kind: "true-false",
    card,
    term: card.term,
    termImage: card.termImage,
    definition: other.definition,
    definitionImage: other.definitionImage,
    isTrue: false,
  };
}
