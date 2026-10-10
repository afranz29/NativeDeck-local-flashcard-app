import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { useStudyCards } from "../lib/studyCards";
import { Markdown } from "../components/Markdown";
import type { Card } from "../lib/db";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Study() {
  const { setId, folderId } = useParams<{ setId?: string; folderId?: string }>();
  const set = useLiveQuery(() => (setId ? db.sets.get(setId) : undefined), [setId]);
  const folder = useLiveQuery(() => (folderId ? db.folders.get(folderId) : undefined), [folderId]);
  const { cards: allCards } = useStudyCards(setId, folderId);

  const title = setId ? set?.title : folder?.name;
  const backTo = setId ? `/sets/${setId}` : "/";
  const addCardsTo = setId ? `/sets/${setId}/edit` : "/";

  const [queue, setQueue] = useState<Card[]>([]);
  const [stillLearning, setStillLearning] = useState<Card[]>([]);
  const [known, setKnown] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (allCards && !started) {
      setQueue(allCards);
    }
  }, [allCards, started]);

  const total = allCards?.length ?? 0;
  const current = queue[index];
  const done = started && queue.length > 0 && index >= queue.length;

  useEffect(() => {
    if (!started || done) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [started, done]);

  function startSession() {
    if (!allCards) return;
    setQueue(shuffled ? shuffle(allCards) : allCards);
    setStillLearning([]);
    setKnown([]);
    setIndex(0);
    setFlipped(false);
    setStarted(true);
  }

  function markKnown() {
    if (!current) return;
    setKnown((k) => [...k, current]);
    advance();
  }

  function markLearning() {
    if (!current) return;
    setStillLearning((s) => [...s, current]);
    advance();
  }

  function advance() {
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function restartWithLearning() {
    setQueue(shuffled ? shuffle(stillLearning) : stillLearning);
    setStillLearning([]);
    setIndex(0);
    setFlipped(false);
  }

  const progressPct = useMemo(() => {
    if (!started || queue.length === 0) return 0;
    return Math.round((index / queue.length) * 100);
  }, [index, queue.length, started]);

  if (!setId && !folderId) return <p>Not found.</p>;
  if ((setId && set === undefined) || (folderId && folder === undefined) || allCards === undefined) {
    return <p>Loading…</p>;
  }
  if ((setId && set === null) || (folderId && folder === null)) return <p>Not found.</p>;

  if (total === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {setId ? "This set has no cards yet." : "This folder has no cards yet."}
        </p>
        <Link to={addCardsTo} className="text-sky-500 dark:text-sky-400 hover:underline">
          {setId ? "Add some cards" : "Back to library"}
        </Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Link to={backTo} className="inline-block text-sm text-gray-500 hover:underline mb-6">
          {setId ? "← Back to set" : "← Back to library"}
        </Link>
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{total} card(s)</p>
        <label className="flex items-center justify-center gap-2 mb-6 text-sm">
          <input
            type="checkbox"
            checked={shuffled}
            onChange={(e) => setShuffled(e.target.checked)}
          />
          Shuffle cards
        </label>
        <button
          onClick={startSession}
          className="px-5 py-2.5 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600"
        >
          Start studying
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Round complete 🎉</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {known.length} known · {stillLearning.length} still learning
        </p>
        <div className="flex flex-col gap-2">
          {stillLearning.length > 0 && (
            <button
              onClick={restartWithLearning}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600"
            >
              Study the {stillLearning.length} still learning
            </button>
          )}
          <button
            onClick={startSession}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Restart full set
          </button>
          <Link
            to={backTo}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {setId ? "Back to set" : "Back to library"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Link to={backTo} className="text-sm text-gray-500 hover:underline">
          ← Exit
        </Link>
        <span className="text-sm text-gray-500">
          {index + 1} / {queue.length}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 mb-6">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[280px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center p-8 mb-4 text-center"
      >
        <div className="text-xl">
          {(flipped ? current.definitionImage : current.termImage) && (
            <img
              src={flipped ? current.definitionImage : current.termImage}
              alt=""
              className="max-h-48 mx-auto mb-4 rounded-lg object-contain"
            />
          )}
          <Markdown text={flipped ? current.definition || "*empty*" : current.term || "*empty*"} />
        </div>
      </button>
      <p className="text-center text-xs text-gray-400 mb-6">
        Click the card to flip · showing {flipped ? "definition" : "term"}
      </p>

      <div className="flex gap-3 justify-center">
        <button
          onClick={markLearning}
          className="px-5 py-2.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          Still learning
        </button>
        <button
          onClick={markKnown}
          className="px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
        >
          Know it
        </button>
      </div>
    </div>
  );
}
