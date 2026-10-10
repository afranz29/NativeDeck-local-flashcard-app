import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { MASTERY_TARGET } from "../lib/learn";
import { LineChart } from "../components/LineChart";

export function Stats() {
  const { setId } = useParams<{ setId: string }>();
  const set = useLiveQuery(() => (setId ? db.sets.get(setId) : undefined), [setId]);
  const cards = useLiveQuery(
    () => (setId ? db.cards.where("setId").equals(setId).sortBy("order") : []),
    [setId]
  );
  const sessions = useLiveQuery(
    () => (setId ? db.sessions.where("setId").equals(setId).sortBy("completedAt") : []),
    [setId]
  );

  if (set === undefined || cards === undefined || sessions === undefined) return <p>Loading…</p>;
  if (set === null || !setId) return <p>Set not found.</p>;

  const total = cards.length;
  const masteredNow = cards.filter((c) => (c.masteryStreak ?? 0) >= MASTERY_TARGET).length;
  const masteredPct = total === 0 ? 0 : Math.round((masteredNow / total) * 100);

  const points = sessions.map((s, i) => ({
    x: sessions.length === 1 ? 100 : (i / (sessions.length - 1)) * 100,
    y: s.totalCards === 0 ? 0 : (s.masteredCount / s.totalCards) * 100,
  }));

  return (
    <div className="max-w-xl mx-auto">
      <Link
        to={`/sets/${setId}`}
        className="inline-block text-sm text-gray-500 hover:underline mb-4"
      >
        ← Back to set
      </Link>

      <h1 className="text-2xl font-bold mb-1">{set.title || "Untitled set"}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Progress over time</p>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6 mb-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Currently mastered</p>
        <p className="text-3xl font-bold mb-4">
          {masteredNow} / {total}{" "}
          <span className="text-base font-normal text-gray-400">({masteredPct}%)</span>
        </p>

        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">
            Complete a Learn round to start tracking progress over time.
          </p>
        ) : (
          <LineChart points={points} />
        )}
      </div>

      {sessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            Session history
          </h2>
          <div className="space-y-2">
            {[...sessions].reverse().map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2.5 text-sm"
              >
                <span className="text-gray-500 dark:text-gray-400">
                  {new Date(s.completedAt).toLocaleString()}
                </span>
                <span className="font-medium">
                  {s.masteredCount} / {s.totalCards} mastered
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
