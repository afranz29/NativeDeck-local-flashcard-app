import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, newId, type Folder } from "../lib/db";
import { downloadJSON, exportLibrary, importLibraryJSON } from "../lib/importExport";
import { SetCard } from "../components/SetCard";

export function Library() {
  const navigate = useNavigate();
  const sets = useLiveQuery(() => db.sets.orderBy("updatedAt").reverse().toArray(), []);
  const foldersRaw = useLiveQuery(() => db.folders.toArray(), []);
  const folders = foldersRaw
    ? [...foldersRaw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
    : undefined;
  const cardCounts = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c.setId, (counts.get(c.setId) ?? 0) + 1);
    return counts;
  }, []);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // folder id, or "unfiled"
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function createSet() {
    const id = newId();
    const now = Date.now();
    await db.sets.add({ id, title: "Untitled set", description: "", createdAt: now, updatedAt: now });
    navigate(`/sets/${id}/edit`);
  }

  async function deleteSet(id: string, title: string) {
    if (!confirm(`Delete "${title}" and all its cards? This can't be undone.`)) return;
    await db.transaction("rw", db.sets, db.cards, async () => {
      await db.cards.where("setId").equals(id).delete();
      await db.sets.delete(id);
    });
  }

  async function moveSetToFolder(setId: string, folderId: string | undefined) {
    await db.sets.update(setId, { folderId });
  }

  async function createFolder() {
    const id = newId();
    const now = Date.now();
    await db.folders.add({
      id,
      name: "New folder",
      order: folders?.length ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function reorderFolders(draggedId: string, dropId: string) {
    if (!folders || draggedId === dropId) return;
    const fromIndex = folders.findIndex((f) => f.id === draggedId);
    const toIndex = folders.findIndex((f) => f.id === dropId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = [...folders];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await Promise.all(reordered.map((f, i) => db.folders.update(f.id, { order: i })));
  }

  async function renameFolder(id: string, name: string) {
    await db.folders.update(id, { name: name.trim() || "Untitled folder", updatedAt: Date.now() });
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(`Delete folder "${folder.name}"? Its sets will move to "No folder", not be deleted.`)) return;
    // folderId isn't an indexed field, so filter the already-loaded sets
    // list client-side rather than using a Dexie where() query on it.
    const inFolder = sets?.filter((s) => s.folderId === folder.id) ?? [];
    await db.transaction("rw", db.sets, db.folders, async () => {
      await Promise.all(inFolder.map((s) => db.sets.update(s.id, { folderId: undefined })));
      await db.folders.delete(folder.id);
    });
  }

  function handleDrop(e: React.DragEvent, folderId: string | undefined) {
    e.preventDefault();
    setDragOverTarget(null);
    const draggedFolderId = e.dataTransfer.getData("application/x-folder-id");
    if (draggedFolderId && folderId) {
      reorderFolders(draggedFolderId, folderId);
      return;
    }
    const setId = e.dataTransfer.getData("text/plain");
    if (setId) moveSetToFolder(setId, folderId);
  }

  async function handleExportAll() {
    const data = await exportLibrary();
    downloadJSON(data, "nativedeck-library.json");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = await importLibraryJSON(json);
      setMessage(
        `Imported ${result.setsImported} set(s), ${result.cardsImported} card(s), ${result.foldersImported} folder(s).`
      );
    } catch (err) {
      setMessage(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const allTags = [...new Set((sets ?? []).flatMap((s) => s.tags ?? []))].sort();

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const visibleSets =
    activeTags.length === 0
      ? sets ?? []
      : (sets ?? []).filter((s) => s.tags?.some((t) => activeTags.includes(t)));

  const unfiledSets = visibleSets.filter((s) => !s.folderId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Your sets</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={createFolder}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            + New folder
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import library"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={handleExportAll}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Export library
          </button>
          <button
            onClick={createSet}
            className="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600"
          >
            + New set
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-sm px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 flex items-center justify-between gap-3">
          <span>{message}</span>
          <button
            onClick={() => setMessage(null)}
            aria-label="Dismiss"
            className="text-sky-800 dark:text-sky-200 hover:opacity-70 font-medium"
          >
            ×
          </button>
        </div>
      )}

      {sets?.length === 0 && folders?.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="mb-4">No sets yet.</p>
          <button
            onClick={createSet}
            className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600"
          >
            Create your first set
          </button>
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? "bg-sky-500 border-sky-500 text-white"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {tag}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              className="px-2.5 py-1 rounded-full text-xs text-gray-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {folders?.map((folder) => {
        const folderSets = visibleSets.filter((s) => s.folderId === folder.id);
        const isDragOver = dragOverTarget === folder.id;
        return (
          <div
            key={folder.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverTarget(folder.id);
            }}
            onDragLeave={() => setDragOverTarget((t) => (t === folder.id ? null : t))}
            onDrop={(e) => handleDrop(e, folder.id)}
            className={`mb-6 rounded-xl border p-4 transition-colors ${
              isDragOver
                ? "border-sky-400 bg-sky-50 dark:bg-sky-950"
                : "border-gray-200 dark:border-gray-800"
            }`}
          >
            <FolderHeader
              folder={folder}
              count={folderSets.length}
              onRename={(name) => renameFolder(folder.id, name)}
              onDelete={() => deleteFolder(folder)}
              onDragStart={(e) => e.dataTransfer.setData("application/x-folder-id", folder.id)}
            />
            {folderSets.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
                Empty — drag a set here to add it.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                {folderSets.map((set) => (
                  <SetCard
                    key={set.id}
                    set={set}
                    cardCount={cardCounts?.get(set.id) ?? 0}
                    onDelete={() => deleteSet(set.id, set.title)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(folders?.length ?? 0) > 0 && (
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
          Sets without a folder
        </h2>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverTarget("unfiled");
        }}
        onDragLeave={() => setDragOverTarget((t) => (t === "unfiled" ? null : t))}
        onDrop={(e) => handleDrop(e, undefined)}
        className={`rounded-xl transition-colors ${
          dragOverTarget === "unfiled" ? "ring-2 ring-sky-400" : ""
        } ${(folders?.length ?? 0) > 0 ? "p-2 -m-2" : ""}`}
      >
        {unfiledSets.length === 0 && (folders?.length ?? 0) > 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
            No unfiled sets.
          </p>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {unfiledSets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              cardCount={cardCounts?.get(set.id) ?? 0}
              onDelete={() => deleteSet(set.id, set.title)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FolderHeader({
  folder,
  count,
  onRename,
  onDelete,
  onDragStart,
}: {
  folder: Folder;
  count: number;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  function commit() {
    onRename(name);
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div
        draggable
        onDragStart={onDragStart}
        aria-label="Drag to reorder folder"
        title="Drag to reorder"
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
      >
        ⠿
      </div>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="font-semibold bg-transparent outline-none border-b border-gray-300 dark:border-gray-700"
        />
      ) : (
        <button
          onClick={() => {
            setName(folder.name);
            setEditing(true);
          }}
          className="font-semibold hover:underline text-left"
        >
          📁 {folder.name}
        </button>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">{count} set(s)</span>
        <button
          onClick={onDelete}
          className="text-xs text-red-600 dark:text-red-400 hover:underline"
        >
          Delete folder
        </button>
      </div>
    </div>
  );
}
