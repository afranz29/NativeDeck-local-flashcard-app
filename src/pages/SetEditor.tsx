import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, type Card } from "../lib/db";
import {
  addCardsToSet,
  downloadCSV,
  downloadJSON,
  exportSet,
  parsePastedCards,
  type ParseDelimiters,
} from "../lib/importExport";
import { CardCreator, type NewCardFields } from "../components/CardCreator";
import { CardListItem } from "../components/CardListItem";

export function SetEditor() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const set = useLiveQuery(() => (setId ? db.sets.get(setId) : undefined), [setId]);
  const cards = useLiveQuery(
    () => (setId ? db.cards.where("setId").equals(setId).sortBy("order") : []),
    [setId]
  );

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [termSeparator, setTermSeparator] = useState("auto");
  const [cardSeparator, setCardSeparator] = useState("auto");
  const delimiters: ParseDelimiters = { termSeparator, cardSeparator };

  // mirrored locally so typing stays in sync with the input's cursor.
  // binding value directly to the live Dexie query would round-trip every
  // keystroke through IndexedDB and back, desyncing the controlled value
  // from what was actually typed and resetting the cursor to the end.
  const [title, setTitle] = useState(set?.title ?? "");
  const [description, setDescription] = useState(set?.description ?? "");

  useEffect(() => {
    if (set) {
      setTitle(set.title);
      setDescription(set.description);
    }
  }, [setId, !!set]);

  if (set === undefined) return <p>Loading…</p>;
  if (set === null || !setId) return <p>Set not found.</p>;

  async function updateSet(fields: Partial<{ title: string; description: string; tags: string[] }>) {
    await db.sets.update(setId!, { ...fields, updatedAt: Date.now() });
  }

  function addTag() {
    const value = tagInput.trim().toLowerCase();
    setTagInput("");
    if (!value) return;
    const existing = set?.tags ?? [];
    if (existing.includes(value)) return;
    updateSet({ tags: [...existing, value] });
  }

  function removeTag(tag: string) {
    updateSet({ tags: (set?.tags ?? []).filter((t) => t !== tag) });
  }

  async function createCard(fields: NewCardFields) {
    const order = cards?.length ?? 0;
    await db.cards.add({
      id: newId(),
      setId: setId!,
      ...fields,
      order,
      createdAt: Date.now(),
    });
    await db.sets.update(setId!, { updatedAt: Date.now() });
  }

  async function updateCard(id: string, fields: Partial<Card>) {
    await db.cards.update(id, fields);
    await db.sets.update(setId!, { updatedAt: Date.now() });
  }

  async function deleteCard(id: string) {
    await db.cards.delete(id);
    await db.sets.update(setId!, { updatedAt: Date.now() });
  }

  async function reorderCards(dropId: string) {
    const from = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!cards || !from || from === dropId) return;
    const fromIndex = cards.findIndex((c) => c.id === from);
    const toIndex = cards.findIndex((c) => c.id === dropId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...cards];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await Promise.all(reordered.map((c, i) => db.cards.update(c.id, { order: i })));
  }

  async function handlePasteImport() {
    const entries = parsePastedCards(pasteText, delimiters);
    if (entries.length === 0) return;
    await addCardsToSet(setId!, entries);
    setPasteText("");
    setPasteOpen(false);
  }

  async function handleExportJSON() {
    const data = await exportSet(setId!);
    downloadJSON(data, `${data.sets[0]?.title || "nativedeck"}.json`);
  }

  async function handleExportCSV() {
    if (!cards) return;
    downloadCSV(set?.title ?? "nativedeck", cards);
  }

  return (
    <div>
      <button
        onClick={() => navigate(`/sets/${setId}`)}
        className="text-sm text-gray-500 hover:underline mb-4"
      >
        ← Back to set
      </button>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          updateSet({ title: e.target.value });
        }}
        placeholder="Set title"
        className="text-2xl font-bold w-full bg-transparent outline-none mb-2 border-b border-transparent focus:border-gray-300 dark:focus:border-gray-700"
      />
      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          updateSet({ description: e.target.value });
        }}
        placeholder="Description (optional)"
        rows={2}
        className="w-full bg-transparent outline-none text-sm text-gray-500 dark:text-gray-400 resize-none mb-4"
      />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        {(set.tags ?? []).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="hover:text-red-500 font-medium"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="+ Add tag"
          className="px-2.5 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-700 text-xs outline-none bg-transparent w-24 focus:w-32 transition-all"
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setPasteOpen((v) => !v)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Paste import
        </button>
        <button
          onClick={handleExportJSON}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Export JSON
        </button>
        <button
          onClick={handleExportCSV}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Export CSV
        </button>
      </div>

      {pasteOpen && (
        <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Paste one card per line: <code>term,definition</code> or{" "}
            <code>term&lt;tab&gt;definition</code> (Quizlet-style paste works too).
          </p>

          <div className="flex gap-3 flex-wrap mb-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Between term &amp; definition:</span>
              <select
                value={termSeparator}
                onChange={(e) => setTermSeparator(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
              >
                <option value="auto">Auto (comma or tab)</option>
                <option value=",">Comma ( , )</option>
                <option value="\t">Tab</option>
                <option value=";">Semicolon ( ; )</option>
                <option value="|">Pipe ( | )</option>
                <option value="custom">Custom…</option>
              </select>
              {termSeparator === "custom" && (
                <input
                  autoFocus
                  placeholder="e.g. ::"
                  onChange={(e) => setTermSeparator(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                />
              )}
            </label>

            <label className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Between cards:</span>
              <select
                value={cardSeparator}
                onChange={(e) => setCardSeparator(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
              >
                <option value="auto">New line</option>
                <option value=";">Semicolon ( ; )</option>
                <option value="|">Pipe ( | )</option>
                <option value="custom">Custom…</option>
              </select>
              {cardSeparator === "custom" && (
                <input
                  autoFocus
                  placeholder="e.g. ///"
                  onChange={(e) => setCardSeparator(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                />
              )}
            </label>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={"Mitochondria,Powerhouse of the cell\nOsmosis,Movement of water across a membrane"}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-sm font-mono outline-none"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handlePasteImport}
              className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-sm hover:bg-sky-600"
            >
              Add {parsePastedCards(pasteText, delimiters).length || ""} card(s)
            </button>
            <button
              onClick={() => setPasteOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <CardCreator onCreate={createCard} />

      <div className="space-y-4">
        {cards?.map((card, i) => (
          <CardListItem
            key={card.id}
            index={i}
            card={card}
            onChange={(fields) => updateCard(card.id, fields)}
            onDelete={() => deleteCard(card.id)}
            onDragStart={() => setDraggedId(card.id)}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedId && draggedId !== card.id) setDragOverId(card.id);
            }}
            onDrop={() => reorderCards(card.id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            isDragOver={dragOverId === card.id}
          />
        ))}
      </div>

      {cards?.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-10">
          No cards yet. Use the creator above or paste a list.
        </p>
      )}
    </div>
  );
}
