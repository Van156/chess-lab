import { notesEqual } from "./idea-note";
import { removalPreview, type RepertoireGraph } from "./repertoire-tree";
import type { IdeaNote } from "./repertoire-types";

/** Unsaved edits of the idea note at one position. */
export type Draft = { positionId: string; note: IdeaNote };

/**
 * The draft once a save of `submitted` (the note on screen when the user asked) for `positionId`
 * resolves. Only the draft that was submitted goes; anything typed while the save was in flight,
 * or drafted at another position, is newer than what was saved and stays.
 */
export function draftAfterSave(
  current: Draft | null,
  positionId: string,
  submitted: IdeaNote,
): Draft | null {
  return current && current.positionId === positionId && notesEqual(current.note, submitted)
    ? null
    : current;
}

/** The draft once `moveId` is deleted: kept unless its position is pruned with the move. */
export function draftAfterDelete(
  current: Draft | null,
  graph: RepertoireGraph,
  moveId: string,
): Draft | null {
  return current && removalPreview(graph, moveId).positionIds.includes(current.positionId)
    ? null
    : current;
}
