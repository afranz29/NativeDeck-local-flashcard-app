import { db, newId, type Card, type FlashcardSet, type Folder } from "./db";

export interface LibraryExport {
  version: 1;
  exportedAt: number;
  sets: FlashcardSet[];
  cards: Card[];
  folders?: Folder[];
}

export async function exportLibrary(): Promise<LibraryExport> {
  const [sets, cards, folders] = await Promise.all([
    db.sets.toArray(),
    db.cards.toArray(),
    db.folders.toArray(),
  ]);
  return { version: 1, exportedAt: Date.now(), sets, cards, folders };
}

export async function exportSet(setId: string): Promise<LibraryExport> {
  const set = await db.sets.get(setId);
  if (!set) throw new Error("Set not found");
  const cards = await db.cards.where("setId").equals(setId).sortBy("order");
  // Single-set export omits folderId — folder membership is a library-level
  // concept and wouldn't mean anything when imported elsewhere.
  return { version: 1, exportedAt: Date.now(), sets: [{ ...set, folderId: undefined }], cards };
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Images are intentionally excluded from CSV — a data URL would make rows
// enormous and unreadable in a plain-text format. Use JSON export to keep images.
export function downloadCSV(setTitle: string, cards: Card[]) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = cards.map(
    (c) => `${escape(c.term)},${escape(c.definition)}`
  );
  const csv = ["term,definition", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${setTitle || "nativedeck"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLibraryJSON(json: unknown) {
  const data = json as LibraryExport;
  if (!data || !Array.isArray(data.sets) || !Array.isArray(data.cards)) {
    throw new Error("Invalid library file");
  }
  // Re-key everything to avoid id collisions with existing data.
  const folderIdMap = new Map<string, string>();
  const folders: Folder[] = (data.folders ?? []).map((f) => {
    const id = newId();
    folderIdMap.set(f.id, id);
    return { ...f, id };
  });

  const idMap = new Map<string, string>();
  const sets: FlashcardSet[] = data.sets.map((s) => {
    const id = newId();
    idMap.set(s.id, id);
    return {
      ...s,
      id,
      folderId: s.folderId ? folderIdMap.get(s.folderId) : undefined,
    };
  });
  const cards: Card[] = data.cards
    .filter((c) => idMap.has(c.setId))
    .map((c) => ({ ...c, id: newId(), setId: idMap.get(c.setId)! }));

  await db.transaction("rw", db.sets, db.cards, db.folders, async () => {
    await db.folders.bulkAdd(folders);
    await db.sets.bulkAdd(sets);
    await db.cards.bulkAdd(cards);
  });

  return { setsImported: sets.length, cardsImported: cards.length, foldersImported: folders.length };
}

export interface ParseDelimiters {
  /** Separator between term and definition. "auto" detects tab or comma. */
  termSeparator: string;
  /** Separator between cards. "auto" splits on newlines. */
  cardSeparator: string;
}

export const DEFAULT_DELIMITERS: ParseDelimiters = {
  termSeparator: "auto",
  cardSeparator: "auto",
};

/** Turns a user-typed delimiter like "\t" or "\n" into the real character. */
function unescapeDelimiter(raw: string): string {
  return raw.replace(/\\t/g, "\t").replace(/\\n/g, "\n");
}

/** Parses Quizlet-style pasted text into term/definition pairs. Supports
 * custom delimiters between term & definition and between cards; "auto"
 * detects tab/comma for terms and newlines for cards. */
export function parsePastedCards(
  text: string,
  delimiters: ParseDelimiters = DEFAULT_DELIMITERS
): { term: string; definition: string }[] {
  const cardSep =
    delimiters.cardSeparator === "auto" || !delimiters.cardSeparator
      ? /\r?\n/
      : unescapeDelimiter(delimiters.cardSeparator);

  const lines = text
    .split(cardSep)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const termSep =
        delimiters.termSeparator === "auto" || !delimiters.termSeparator
          ? line.includes("\t")
            ? "\t"
            : ","
          : unescapeDelimiter(delimiters.termSeparator);
      const idx = line.indexOf(termSep);
      if (idx === -1) return { term: line, definition: "" };
      return {
        term: line.slice(0, idx).trim(),
        definition: line.slice(idx + termSep.length).trim(),
      };
    })
    .filter((c) => c.term);
}

export async function addCardsToSet(
  setId: string,
  entries: { term: string; definition: string }[]
) {
  const existingCount = await db.cards.where("setId").equals(setId).count();
  const now = Date.now();
  const cards: Card[] = entries.map((e, i) => ({
    id: newId(),
    setId,
    term: e.term,
    definition: e.definition,
    order: existingCount + i,
    createdAt: now,
  }));
  await db.cards.bulkAdd(cards);
  await db.sets.update(setId, { updatedAt: now });
  return cards;
}
