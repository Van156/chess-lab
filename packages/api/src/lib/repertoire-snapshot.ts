// Deletion snapshots of the repertoire tree. `deleteMove` returns one so the client can undo the
// deletion with `restoreDeleted`. Everything here is pure: the service reads and writes the rows,
// this module decides what the snapshot holds and whether it still fits the tree.
import { parseMove, positionKey } from "@b2c-template/chess";
import { z } from "zod";

import {
  IDEA_NOTE_MAX_ITEMS,
  IDEA_NOTE_PLAN_MAX_LENGTH,
  MAX_LINE_NAME_LENGTH,
} from "./repertoire-limits";

export const SNAPSHOT_VERSION = 1;
/** Upper bound of rows in one snapshot; keeps a forged request bounded. */
const SNAPSHOT_MAX_ROWS = 5000;

const id = z.string().min(1).max(100);
const timestamp = z.iso.datetime();
const square = z.string().regex(/^[a-h][1-8]$/);

export const deletionSnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  repertoireId: id,
  /** The move the user deleted: the one `restoreDeleted` reports back so the UI can go to it. */
  deletedMoveId: id,
  positions: z
    .array(
      z.object({
        id,
        positionKey: z.string().min(1).max(200),
        fen: z.string().min(1).max(200),
        sideToMove: z.enum(["w", "b"]),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .max(SNAPSHOT_MAX_ROWS),
  moves: z
    .array(
      z.object({
        id,
        fromPositionId: id,
        toPositionId: id,
        san: z.string().min(1).max(16),
        uci: z.string().min(4).max(5),
        name: z.string().min(1).max(MAX_LINE_NAME_LENGTH).nullable(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .min(1)
    .max(SNAPSHOT_MAX_ROWS),
  ideaNotes: z
    .array(
      z.object({
        repertoirePositionId: id,
        arrows: z
          .array(z.object({ from: square, to: square }))
          .max(IDEA_NOTE_MAX_ITEMS)
          .nullable(),
        highlights: z.array(square).max(IDEA_NOTE_MAX_ITEMS).nullable(),
        plan: z.string().max(IDEA_NOTE_PLAN_MAX_LENGTH).nullable(),
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    )
    .max(SNAPSHOT_MAX_ROWS),
  /** The base line position this deletion cleared, or null when the base was not removed. */
  basePositionId: id.nullable(),
});

export type DeletionSnapshot = z.infer<typeof deletionSnapshotSchema>;

type SnapshotPosition = DeletionSnapshot["positions"][number];
type SnapshotMove = DeletionSnapshot["moves"][number];
type SnapshotNote = DeletionSnapshot["ideaNotes"][number];

/**
 * Keeps the rows a deletion removes: the deleted move, the unreachable positions, every move out
 * of them (these cascade) and their idea notes. `positions`, `moves` and `ideaNotes` are the
 * whole repertoire; the result is the part that goes.
 */
export function buildDeletionSnapshot(input: {
  repertoireId: string;
  deletedMoveId: string;
  removedPositionIds: ReadonlySet<string>;
  positions: SnapshotPosition[];
  moves: SnapshotMove[];
  ideaNotes: SnapshotNote[];
  /** The repertoire's base before the deletion. */
  basePositionId: string | null;
}): DeletionSnapshot {
  const removed = input.removedPositionIds;
  return {
    version: SNAPSHOT_VERSION,
    repertoireId: input.repertoireId,
    deletedMoveId: input.deletedMoveId,
    positions: input.positions.filter((p) => removed.has(p.id)),
    moves: input.moves.filter((m) => m.id === input.deletedMoveId || removed.has(m.fromPositionId)),
    ideaNotes: input.ideaNotes.filter((n) => removed.has(n.repertoirePositionId)),
    basePositionId:
      input.basePositionId !== null && removed.has(input.basePositionId)
        ? input.basePositionId
        : null,
  };
}

export type RestoreConflict =
  | "parent_missing"
  | "edge_exists"
  | "move_exists"
  | "position_conflict";
export type RestoreFailure = RestoreConflict | "invalid_snapshot";

export type RestorePlan =
  | {
      ok: true;
      /** Positions to insert; a re-added position is reused and so missing from here. */
      positions: SnapshotPosition[];
      moves: SnapshotMove[];
      ideaNotes: SnapshotNote[];
      /** The base to put back (remapped), or null to leave the base alone. */
      basePositionId: string | null;
    }
  | { ok: false; reason: RestoreFailure };

const fail = (reason: RestoreFailure): RestorePlan => ({ ok: false, reason });

export type RestoreCurrentState = {
  positions: { id: string; positionKey: string; fen: string }[];
  moves: { id: string; fromPositionId: string; uci: string }[];
  /** Ids of positions that have an idea note right now. */
  notedPositionIds: ReadonlySet<string>;
  currentBasePositionId: string | null;
};

/**
 * Decides how to put a snapshot back into the tree as it is now. Positions that exist again (same
 * `positionKey`, e.g. re-added through a transposition) are reused: moves, notes and the base are
 * remapped to the existing row, and an existing note wins over the snapshot one. A missing parent
 * or a taken `(from, uci)` edge is a conflict; nothing is partially planned.
 */
export function planRestore(snapshot: DeletionSnapshot, state: RestoreCurrentState): RestorePlan {
  const snapshotPositionIds = new Set(snapshot.positions.map((p) => p.id));
  const snapshotMoveIds = new Set(snapshot.moves.map((m) => m.id));
  if (
    snapshotPositionIds.size !== snapshot.positions.length ||
    snapshotMoveIds.size !== snapshot.moves.length ||
    !snapshotMoveIds.has(snapshot.deletedMoveId)
  ) {
    return fail("invalid_snapshot");
  }
  // The client sends this, so a row must describe itself consistently.
  for (const p of snapshot.positions) {
    if (positionKey(p.fen) !== p.positionKey || p.fen.split(" ")[1] !== p.sideToMove) {
      return fail("invalid_snapshot");
    }
  }

  const currentById = new Map(state.positions.map((p) => [p.id, p]));
  const currentByKey = new Map(state.positions.map((p) => [p.positionKey, p]));
  const idMap = new Map<string, string>();
  const toInsert: SnapshotPosition[] = [];
  for (const p of snapshot.positions) {
    const existing = currentByKey.get(p.positionKey);
    if (existing) {
      idMap.set(p.id, existing.id);
    } else if (currentById.has(p.id)) {
      return fail("position_conflict");
    } else {
      idMap.set(p.id, p.id);
      toInsert.push(p);
    }
  }
  const resolve = (positionId: string) =>
    idMap.get(positionId) ?? (currentById.has(positionId) ? positionId : null);

  const top = snapshot.moves.find((m) => m.id === snapshot.deletedMoveId)!;
  if (resolve(top.fromPositionId) === null) return fail("parent_missing");

  const fenById = new Map(state.positions.map((p) => [p.id, p.fen]));
  for (const p of toInsert) fenById.set(p.id, p.fen);
  const currentMoveIds = new Set(state.moves.map((m) => m.id));
  const takenEdges = new Set(state.moves.map((m) => `${m.fromPositionId}|${m.uci}`));
  const moves: SnapshotMove[] = [];
  for (const m of snapshot.moves) {
    const from = resolve(m.fromPositionId);
    const to = resolve(m.toPositionId);
    if (from === null || to === null) return fail("parent_missing");
    if (currentMoveIds.has(m.id)) return fail("move_exists");
    const edge = `${from}|${m.uci}`;
    if (takenEdges.has(edge)) return fail("edge_exists");
    takenEdges.add(edge);
    const parsed = parseMove(fenById.get(from)!, m.uci);
    if (
      !parsed ||
      parsed.uci !== m.uci ||
      parsed.san !== m.san ||
      positionKey(parsed.fenAfter) !== positionKey(fenById.get(to)!)
    ) {
      return fail("invalid_snapshot");
    }
    moves.push({ ...m, fromPositionId: from, toPositionId: to });
  }

  const ideaNotes: SnapshotNote[] = [];
  const seenNotes = new Set<string>();
  for (const n of snapshot.ideaNotes) {
    const positionId = idMap.get(n.repertoirePositionId);
    if (positionId === undefined) return fail("invalid_snapshot");
    if (state.notedPositionIds.has(positionId) || seenNotes.has(positionId)) continue;
    seenNotes.add(positionId);
    ideaNotes.push({ ...n, repertoirePositionId: positionId });
  }

  const base = snapshot.basePositionId === null ? null : resolve(snapshot.basePositionId);
  return {
    ok: true,
    positions: toInsert,
    moves,
    ideaNotes,
    basePositionId: state.currentBasePositionId === null ? base : null,
  };
}
