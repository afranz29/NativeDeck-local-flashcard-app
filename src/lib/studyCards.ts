import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

/** Resolves the full card list to study/learn for either a single set or
 * every set in a folder. folderId isn't an indexed field on sets, so
 * membership is filtered client-side, same as elsewhere in the app. */
export function useStudyCards(setId: string | undefined, folderId: string | undefined) {
  const allSets = useLiveQuery(async () => (folderId ? db.sets.toArray() : undefined), [folderId]);
  const setIds = setId
    ? [setId]
    : folderId && allSets
      ? allSets.filter((s) => s.folderId === folderId).map((s) => s.id)
      : undefined;
  const setIdsKey = setIds?.join(",");

  const cards = useLiveQuery(async () => {
    if (!setIds) return undefined;
    if (setIds.length === 0) return [];
    const result = await db.cards.where("setId").anyOf(setIds).toArray();
    return result.sort((a, b) => a.setId.localeCompare(b.setId) || a.order - b.order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setIdsKey]);

  return { cards, setIds };
}
