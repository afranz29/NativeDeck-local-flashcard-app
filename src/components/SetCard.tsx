import { Link } from "react-router-dom";
import type { FlashcardSet } from "../lib/db";

export function SetCard({
  set,
  cardCount,
  onDelete,
}: {
  set: FlashcardSet;
  cardCount: number;
  onDelete: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", set.id)}
      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-2 cursor-grab active:cursor-grabbing"
    >
      <Link to={`/sets/${set.id}`} className="font-semibold hover:underline">
        {set.title || "Untitled set"}
      </Link>
      {set.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
          {set.description}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">{cardCount} card(s)</p>

      {set.tags && set.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {set.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-500 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2 text-sm">
        <Link
          to={`/sets/${set.id}/study`}
          className="px-3 py-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600"
        >
          Study
        </Link>
        <Link
          to={`/sets/${set.id}/learn`}
          className="px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950"
        >
          Learn
        </Link>
        <Link
          to={`/sets/${set.id}/edit`}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Edit
        </Link>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
