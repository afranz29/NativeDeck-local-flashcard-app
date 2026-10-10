import { useState, type DragEvent } from "react";
import { CardFieldsEditor } from "./CardFieldsEditor";
import { CardFieldsReadout, FavoriteButton, MasteryRing } from "./CardReadout";
import type { Card } from "../lib/db";

export function CardListItem({
  index,
  card,
  onChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  index: number;
  card: Card;
  onChange: (fields: Partial<Card>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(card.term);
  const [definition, setDefinition] = useState(card.definition);
  const [termImage, setTermImage] = useState(card.termImage);
  const [definitionImage, setDefinitionImage] = useState(card.definitionImage);

  function startEdit() {
    setTerm(card.term);
    setDefinition(card.definition);
    setTermImage(card.termImage);
    setDefinitionImage(card.definitionImage);
    setEditing(true);
  }

  function save() {
    onChange({ term, definition, termImage, definitionImage });
    setEditing(false);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-xl border bg-white dark:bg-gray-900 p-4 flex gap-3 transition-colors ${
        isDragOver
          ? "border-sky-400 dark:border-sky-500"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className="shrink-0 self-stretch flex items-center cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
      >
        ⠿
      </div>

      <FavoriteButton
        favorite={card.favorite ?? false}
        onToggle={() => onChange({ favorite: !card.favorite })}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-xs font-medium text-gray-400">
            Card {index + 1}
            <MasteryRing streak={card.masteryStreak ?? 0} />
          </span>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={save}
                  className="text-xs text-sky-500 dark:text-sky-400 hover:underline"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startEdit}
                className="text-xs text-sky-500 dark:text-sky-400 hover:underline"
              >
                Edit
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>

        {editing ? (
          <CardFieldsEditor
            term={term}
            definition={definition}
            termImage={termImage}
            definitionImage={definitionImage}
            onTermChange={setTerm}
            onDefinitionChange={setDefinition}
            onTermImageChange={setTermImage}
            onDefinitionImageChange={setDefinitionImage}
            resetKey={0}
          />
        ) : (
          <CardFieldsReadout card={card} />
        )}
      </div>
    </div>
  );
}
