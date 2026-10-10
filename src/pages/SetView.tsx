import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { Markdown } from "../components/Markdown";
import { CardFieldsReadout, FavoriteButton, MasteryRing } from "../components/CardReadout";

export function SetView() {
  const { setId } = useParams<{ setId: string }>();
  const set = useLiveQuery(() => (setId ? db.sets.get(setId) : undefined), [setId]);
  const cards = useLiveQuery(
    () => (setId ? db.cards.where("setId").equals(setId).sortBy("order") : []),
    [setId]
  );

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [index]);

  const total = cards?.length ?? 0;

  useEffect(() => {
    if (total === 0) return;
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
  }, [total]);

  if (set === undefined || cards === undefined) return <p>Loading…</p>;
  if (set === null || !setId) return <p>Set not found.</p>;

  const clampedIndex = total === 0 ? 0 : Math.min(index, total - 1);
  const current = cards[clampedIndex];

  function go(delta: number) {
    if (total === 0) return;
    setIndex((i) => (i + delta + total) % total);
  }

  async function toggleFavorite(cardId: string, current: boolean) {
    await db.cards.update(cardId, { favorite: !current });
  }

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:underline mb-4 inline-block">
        ← Back to library
      </Link>

      <h1 className="text-2xl font-bold mb-1">{set.title || "Untitled set"}</h1>
      {set.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{set.description}</p>
      )}

      <div className="flex gap-2 flex-wrap mb-6">
        <Link
          to={`/sets/${setId}/study`}
          className="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600"
        >
          Study this set
        </Link>
        <Link
          to={`/sets/${setId}/learn`}
          className="px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400 text-sm font-medium hover:bg-sky-50 dark:hover:bg-sky-950"
        >
          Learn
        </Link>
        <Link
          to={`/sets/${setId}/edit`}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Edit
        </Link>
        <Link
          to={`/sets/${setId}/stats`}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Stats
        </Link>
      </div>

      {total === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">This set has no cards yet.</p>
          <Link to={`/sets/${setId}/edit`} className="text-sky-500 dark:text-sky-400 hover:underline">
            Add some cards
          </Link>
        </div>
      ) : (
        <>
          <div className="max-w-xl mx-auto">
            <p className="text-center text-sm text-gray-500 mb-3">
              Card {clampedIndex + 1} / {total}
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => go(-1)}
                aria-label="Previous card"
                className="shrink-0 w-10 h-10 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
              >
                ←
              </button>

              <button
                onClick={() => setFlipped((f) => !f)}
                className="flex-1 min-h-[280px] rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center p-8 text-center"
              >
                <div className="text-xl">
                  {(flipped ? current.definitionImage : current.termImage) && (
                    <img
                      src={flipped ? current.definitionImage : current.termImage}
                      alt=""
                      className="max-h-48 mx-auto mb-4 rounded-lg object-contain"
                    />
                  )}
                  <Markdown text={(flipped ? current.definition : current.term) || "*empty*"} />
                </div>
              </button>

              <button
                onClick={() => go(1)}
                aria-label="Next card"
                className="shrink-0 w-10 h-10 rounded-full border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
              >
                →
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-3">
              Click the card to flip · showing {flipped ? "definition" : "term"}
            </p>
          </div>

          <div className="space-y-4 mt-10">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              All cards
            </h2>
            {cards.map((card, i) => (
              <div
                key={card.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex gap-3"
              >
                <FavoriteButton
                  favorite={card.favorite ?? false}
                  onToggle={() => toggleFavorite(card.id, card.favorite ?? false)}
                />
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
                    Card {i + 1}
                    <MasteryRing streak={card.masteryStreak ?? 0} />
                  </p>
                  <CardFieldsReadout card={card} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
