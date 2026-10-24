import { MAX_NOTE_ITEMS } from "./idea-note";
import { removalPreview, type RepertoireGraph } from "./repertoire-tree";
import type { NoteArrow, RepertoireData } from "./repertoire-types";

const SQUARE = /^[a-h][1-8]$/;
const SQUARE_HINT = "type a square, for example e4.";

export type SquareInput = { ok: true; square: string } | { ok: false; error: string };
export type ArrowInput = { ok: true; arrow: NoteArrow } | { ok: false; error: string };

function normalizeSquare(text: string): string | null {
  const square = text.trim().toLowerCase();
  return SQUARE.test(square) ? square : null;
}

/** A typed square: any case, spaces around it ignored. */
export function parseSquareInput(text: string): SquareInput {
  const square = text.trim().toLowerCase();
  if (square === "") {
    return { ok: false, error: "Type a square, for example e4." };
  }
  return SQUARE.test(square)
    ? { ok: true, square }
    : { ok: false, error: `"${text.trim()}" is not a square. Use a file a-h and a rank 1-8.` };
}

/** Two typed squares as a new arrow for a note that already holds `existing`. */
export function parseArrowInput(
  from: string,
  to: string,
  existing: readonly NoteArrow[],
): ArrowInput {
  const start = normalizeSquare(from);
  if (!start) {
    return { ok: false, error: `From square: ${SQUARE_HINT}` };
  }
  const end = normalizeSquare(to);
  if (!end) {
    return { ok: false, error: `To square: ${SQUARE_HINT}` };
  }
  if (start === end) {
    return { ok: false, error: "An arrow needs two different squares." };
  }
  if (existing.some((arrow) => arrow.from === start && arrow.to === end)) {
    return { ok: false, error: "That arrow is already on the board." };
  }
  if (existing.length >= MAX_NOTE_ITEMS) {
    return { ok: false, error: `A note holds at most ${MAX_NOTE_ITEMS} arrows.` };
  }
  return { ok: true, arrow: { from: start, to: end } };
}

/** `positionId` when the graph still has it, else the start position (after a delete or reload). */
export function resolvePosition(
  graph: Pick<RepertoireData, "startPositionId" | "positions">,
  positionId: string | null,
): string {
  return positionId !== null && graph.positions.some((position) => position.id === positionId)
    ? positionId
    : graph.startPositionId;
}

/**
 * Where to stand once `moveId` is deleted: the current position when it survives the prune,
 * otherwise the position the deleted move was played from.
 */
export function positionAfterRemoval(
  graph: RepertoireGraph,
  moveId: string,
  currentPositionId: string,
): string {
  const removed = removalPreview(graph, moveId);
  if (!removed.positionIds.includes(currentPositionId)) {
    return currentPositionId;
  }
  const move = graph.moves.find((candidate) => candidate.id === moveId);
  return move ? move.fromPositionId : graph.startPositionId;
}

/** A move labelled by the ply it is played at: `0` is White's first move ("1. e4"), `1` Black's ("1... e5"). */
export function describeChildMove(plyBefore: number, san: string): string {
  const number = Math.floor(plyBefore / 2) + 1;
  return `${number}${plyBefore % 2 === 0 ? "." : "..."} ${san}`;
}
