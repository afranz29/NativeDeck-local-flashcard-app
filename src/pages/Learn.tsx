import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, type Card } from "../lib/db";
import { Markdown } from "../components/Markdown";
import {
  buildQuestion,
  shuffle,
  MASTERY_TARGET,
  type Direction,
  type Question,
  type QuestionType,
} from "../lib/learn";

function feedbackClass(value: string, correctValue: string, selected: string | null): string {
  if (selected === null) {
    return "border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800";
  }
  if (value === correctValue) return "border-green-500 bg-green-50 dark:bg-green-950";
  if (value === selected) return "border-red-500 bg-red-50 dark:bg-red-950";
  return "border-gray-300 dark:border-gray-700 opacity-60";
}

export function Learn() {
  const { setId } = useParams<{ setId: string }>();
  const set = useLiveQuery(() => (setId ? db.sets.get(setId) : undefined), [setId]);
  const allCards = useLiveQuery(
    () => (setId ? db.cards.where("setId").equals(setId).sortBy("order") : []),
    [setId]
  );

  const [direction, setDirection] = useState<Direction>("random");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["multiple-choice"]);
  const [started, setStarted] = useState(false);
  const [roundCards, setRoundCards] = useState<Card[]>([]);
  const [queue, setQueue] = useState<Card[]>([]);
  const [roundTotal, setRoundTotal] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (started && queue.length > 0) {
      setQuestion(buildQuestion(queue[0], roundCards, direction, questionTypes));
      setSelected(null);
    }
    // roundCards/direction/questionTypes are fixed for the life of a round;
    // only `queue` actually changes while playing. Deliberately NOT
    // depending on the live `allCards` query here — it re-fires on every
    // mastery write this page makes, which would otherwise wipe the
    // `selected` feedback state mid-answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, queue, roundCards, direction, questionTypes]);

  if (set === undefined || allCards === undefined) return <p>Loading…</p>;
  if (set === null || !setId) return <p>Set not found.</p>;

  const total = allCards.length;
  const notMastered = allCards.filter((c) => (c.masteryStreak ?? 0) < MASTERY_TARGET);
  const allMastered = total > 0 && notMastered.length === 0;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          This set has no cards yet.
        </p>
        <Link to={`/sets/${setId}/edit`} className="text-sky-500 dark:text-sky-400 hover:underline">
          Add some cards
        </Link>
      </div>
    );
  }

  if (total === 1) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Learn mode needs at least 2 cards to generate questions.
        </p>
        <Link to={`/sets/${setId}/edit`} className="text-sky-500 dark:text-sky-400 hover:underline">
          Add more cards
        </Link>
      </div>
    );
  }

  function toggleQuestionType(type: QuestionType) {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function startSession() {
    const initial = shuffle(notMastered);
    setRoundCards(allCards!);
    setQueue(initial);
    setRoundTotal(initial.length);
    setMasteredCount(0);
    setSelected(null);
    setStarted(true);
  }

  async function resetProgress() {
    if (!allCards) return;
    await Promise.all(allCards.map((c) => db.cards.update(c.id, { masteryStreak: 0 })));
  }

  async function answer(choiceValue: string) {
    if (!question || selected) return;
    setSelected(choiceValue);
    const card = question.card;
    const isCorrect =
      question.kind === "multiple-choice"
        ? choiceValue === (question.answerSide === "term" ? card.term.trim() : card.definition.trim())
        : choiceValue === (question.isTrue ? "true" : "false");
    const newStreak = isCorrect ? (card.masteryStreak ?? 0) + 1 : 0;
    await db.cards.update(card.id, { masteryStreak: newStreak });

    setTimeout(() => {
      setQueue((q) => {
        const rest = q.slice(1);
        if (isCorrect && newStreak >= MASTERY_TARGET) {
          setMasteredCount((m) => m + 1);
          if (rest.length === 0) recordSessionSnapshot();
          return rest;
        }
        return [...rest, { ...card, masteryStreak: newStreak }];
      });
    }, 900);
  }

  async function recordSessionSnapshot() {
    if (!setId || !allCards) return;
    const mastered = allCards.filter((c) => (c.masteryStreak ?? 0) >= MASTERY_TARGET).length;
    await db.sessions.add({
      id: newId(),
      setId,
      completedAt: Date.now(),
      masteredCount: mastered,
      totalCards: allCards.length,
    });
  }

  if (!started) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Link
          to={`/sets/${setId}`}
          className="inline-block text-sm text-gray-500 hover:underline mb-6"
        >
          ← Back to set
        </Link>
        <h1 className="text-2xl font-bold mb-1">{set.title}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {allMastered
            ? "🎉 All cards mastered!"
            : `${notMastered.length} of ${total} card(s) left to master`}
        </p>

        <div className="text-left max-w-xs mx-auto mb-6">
          <p className="text-xs font-medium text-gray-400 mb-2">Question types</p>
          <div className="flex flex-col gap-2 text-sm mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={questionTypes.includes("multiple-choice")}
                onChange={() => toggleQuestionType("multiple-choice")}
              />
              Multiple choice
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={questionTypes.includes("true-false")}
                onChange={() => toggleQuestionType("true-false")}
              />
              True / False
            </label>
          </div>

          <p className="text-xs font-medium text-gray-400 mb-2">Direction (multiple choice)</p>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="direction"
                checked={direction === "term-to-def"}
                onChange={() => setDirection("term-to-def")}
              />
              Term → pick Definition
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="direction"
                checked={direction === "def-to-term"}
                onChange={() => setDirection("def-to-term")}
              />
              Definition → pick Term
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="direction"
                checked={direction === "random"}
                onChange={() => setDirection("random")}
              />
              Randomized both ways
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <button
            onClick={startSession}
            disabled={questionTypes.length === 0}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start learning
          </button>
          {questionTypes.length === 0 && (
            <p className="text-xs text-red-500">Pick at least one question type.</p>
          )}
          {allCards.some((c) => (c.masteryStreak ?? 0) > 0) && (
            <button
              onClick={resetProgress}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Reset progress
            </button>
          )}
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Round complete 🎉</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Mastered all {roundTotal} card(s) in this round.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setStarted(false)}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600"
          >
            Back to start
          </button>
          <Link
            to={`/sets/${setId}`}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Back to set
          </Link>
        </div>
      </div>
    );
  }

  if (!question) return <p>Loading…</p>;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Link to={`/sets/${setId}`} className="text-sm text-gray-500 hover:underline">
          ← Exit
        </Link>
        <span className="text-sm text-gray-500">
          {masteredCount} / {roundTotal} mastered
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 mb-6">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${(masteredCount / roundTotal) * 100}%` }}
        />
      </div>

      {question.kind === "multiple-choice" ? (
        <MultipleChoiceView question={question} selected={selected} onAnswer={answer} />
      ) : (
        <TrueFalseView question={question} selected={selected} onAnswer={answer} />
      )}
    </div>
  );
}

function MultipleChoiceView({
  question,
  selected,
  onAnswer,
}: {
  question: Extract<Question, { kind: "multiple-choice" }>;
  selected: string | null;
  onAnswer: (value: string) => void;
}) {
  const promptText = question.promptSide === "term" ? question.card.term : question.card.definition;
  const promptImage =
    question.promptSide === "term" ? question.card.termImage : question.card.definitionImage;
  const correctText =
    question.answerSide === "term" ? question.card.term.trim() : question.card.definition.trim();

  return (
    <>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-8 mb-4 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          {question.promptSide === "term" ? "Term" : "Definition"}
        </p>
        {promptImage && (
          <img
            src={promptImage}
            alt=""
            className="max-h-48 mx-auto mb-4 rounded-lg object-contain"
          />
        )}
        <div className="text-xl">
          <Markdown text={promptText || "*empty*"} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.choices.map((choice) => (
          <button
            key={choice}
            onClick={() => onAnswer(choice)}
            disabled={selected !== null}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${feedbackClass(choice, correctText, selected)}`}
          >
            <Markdown text={choice} />
          </button>
        ))}
      </div>
    </>
  );
}

function TrueFalseView({
  question,
  selected,
  onAnswer,
}: {
  question: Extract<Question, { kind: "true-false" }>;
  selected: string | null;
  onAnswer: (value: string) => void;
}) {
  const correctValue = question.isTrue ? "true" : "false";

  return (
    <>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-8 mb-4">
        <div className="text-center mb-4">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Term</p>
          {question.termImage && (
            <img
              src={question.termImage}
              alt=""
              className="max-h-32 mx-auto mb-2 rounded-lg object-contain"
            />
          )}
          <div className="text-lg">
            <Markdown text={question.term || "*empty*"} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Definition</p>
          {question.definitionImage && (
            <img
              src={question.definitionImage}
              alt=""
              className="max-h-32 mx-auto mb-2 rounded-lg object-contain"
            />
          )}
          <div className="text-lg">
            <Markdown text={question.definition || "*empty*"} />
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
        Does this term match this definition?
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAnswer("true")}
          disabled={selected !== null}
          className={`rounded-lg border px-4 py-3 font-medium transition-colors ${feedbackClass("true", correctValue, selected)}`}
        >
          True
        </button>
        <button
          onClick={() => onAnswer("false")}
          disabled={selected !== null}
          className={`rounded-lg border px-4 py-3 font-medium transition-colors ${feedbackClass("false", correctValue, selected)}`}
        >
          False
        </button>
      </div>
    </>
  );
}
