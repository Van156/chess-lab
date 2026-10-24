import { START_FEN, addMove as addGraphMove, positionKey } from "@b2c-template/chess";
import type { PositionKey, RepertoireColor } from "@b2c-template/chess";
import type { Database } from "@b2c-template/db";
import {
  ideaNote,
  repertoire,
  repertoireMove,
  repertoirePosition,
} from "@b2c-template/db/schema/repertoire";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { isUserMove, reachablePositionIds, rowsToGraph } from "./repertoire-rows";

export type Square = string;
export type IdeaNoteInput = {
  arrows: { from: Square; to: Square }[];
  highlights: Square[];
  plan: string;
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const notFound = (what: string) => new ORPCError("NOT_FOUND", { message: `${what} not found.` });

const metadataColumns = {
  id: repertoire.id,
  color: repertoire.color,
  name: repertoire.name,
  createdAt: repertoire.createdAt,
  updatedAt: repertoire.updatedAt,
};

/** Locks the repertoire row of `userId`, serializing writers of one tree. */
async function lockRepertoire(tx: Tx, id: string, userId: string) {
  const [row] = await tx
    .select({ id: repertoire.id, color: repertoire.color })
    .from(repertoire)
    .where(and(eq(repertoire.id, id), eq(repertoire.userId, userId)))
    .for("update");
  if (!row) throw notFound("Repertoire");
  return row;
}

async function loadRows(tx: Tx, repertoireId: string, userId: string) {
  const positions = await tx
    .select({
      id: repertoirePosition.id,
      positionKey: repertoirePosition.positionKey,
      fen: repertoirePosition.fen,
      sideToMove: repertoirePosition.sideToMove,
    })
    .from(repertoirePosition)
    .where(
      and(eq(repertoirePosition.repertoireId, repertoireId), eq(repertoirePosition.userId, userId)),
    )
    .orderBy(asc(repertoirePosition.createdAt), asc(repertoirePosition.id))
    .then((rows) => rows.map((r) => ({ ...r, positionKey: r.positionKey as PositionKey })));
  const moves = await tx
    .select({
      id: repertoireMove.id,
      fromPositionId: repertoireMove.fromPositionId,
      toPositionId: repertoireMove.toPositionId,
      san: repertoireMove.san,
      uci: repertoireMove.uci,
    })
    .from(repertoireMove)
    .where(and(eq(repertoireMove.repertoireId, repertoireId), eq(repertoireMove.userId, userId)))
    .orderBy(asc(repertoireMove.createdAt), asc(repertoireMove.id));
  return { positions, moves };
}

export function createRepertoireService(db: Database) {
  async function list(userId: string) {
    return db
      .select(metadataColumns)
      .from(repertoire)
      .where(eq(repertoire.userId, userId))
      .orderBy(asc(repertoire.createdAt), asc(repertoire.id));
  }

  async function create(userId: string, input: { color: RepertoireColor; name: string }) {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(repertoire)
        .values({ userId, color: input.color, name: input.name })
        .returning(metadataColumns);
      await tx.insert(repertoirePosition).values({
        repertoireId: created!.id,
        userId,
        positionKey: positionKey(START_FEN),
        fen: START_FEN,
        sideToMove: "w",
      });
      return created!;
    });
  }

  async function rename(userId: string, id: string, name: string) {
    const [row] = await db
      .update(repertoire)
      .set({ name })
      .where(and(eq(repertoire.id, id), eq(repertoire.userId, userId)))
      .returning(metadataColumns);
    if (!row) throw notFound("Repertoire");
    return row;
  }

  async function remove(userId: string, id: string) {
    const rows = await db
      .delete(repertoire)
      .where(and(eq(repertoire.id, id), eq(repertoire.userId, userId)))
      .returning({ id: repertoire.id });
    if (rows.length === 0) throw notFound("Repertoire");
    return { id };
  }

  async function get(userId: string, id: string) {
    // One snapshot for the repertoire, the graph and the notes, so a concurrent delete cannot
    // leave a half-read tree; a missing repertoire or start position is `NOT_FOUND`.
    const { meta, positions, moves, noteRows } = await db.transaction(
      async (tx) => {
        const [meta] = await tx
          .select(metadataColumns)
          .from(repertoire)
          .where(and(eq(repertoire.id, id), eq(repertoire.userId, userId)));
        if (!meta) throw notFound("Repertoire");
        const { positions, moves } = await loadRows(tx, id, userId);
        const noteRows =
          positions.length === 0
            ? []
            : await tx
                .select()
                .from(ideaNote)
                .where(
                  and(
                    eq(ideaNote.userId, userId),
                    inArray(
                      ideaNote.repertoirePositionId,
                      positions.map((p) => p.id),
                    ),
                  ),
                );
        return { meta, positions, moves, noteRows };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
    const startKey = positionKey(START_FEN);
    const start = positions.find((p) => p.positionKey === startKey);
    if (!start) throw notFound("Start position");
    const sideById = new Map(positions.map((p) => [p.id, p.sideToMove]));
    return {
      repertoire: meta,
      startPositionId: start.id,
      positions: positions.map((p) => ({
        id: p.id,
        key: p.positionKey,
        fen: p.fen,
        sideToMove: p.sideToMove,
      })),
      moves: moves.flatMap((m) => {
        const side = sideById.get(m.fromPositionId);
        if (!side) return [];
        return {
          id: m.id,
          fromPositionId: m.fromPositionId,
          toPositionId: m.toPositionId,
          san: m.san,
          uci: m.uci,
          isUserMove: isUserMove(meta.color, side),
        };
      }),
      notes: Object.fromEntries(
        noteRows.map((n) => [
          n.repertoirePositionId,
          {
            arrows: (n.arrows ?? []) as IdeaNoteInput["arrows"],
            highlights: (n.highlights ?? []) as Square[],
            plan: n.plan ?? "",
          },
        ]),
      ),
    };
  }

  async function addMove(
    userId: string,
    input: { repertoireId: string; fromPositionId: string; move: string },
  ) {
    return db.transaction(async (tx) => {
      const rep = await lockRepertoire(tx, input.repertoireId, userId);
      const { positions, moves } = await loadRows(tx, input.repertoireId, userId);
      const from = positions.find((p) => p.id === input.fromPositionId);
      if (!from) throw notFound("Position");

      const graph = rowsToGraph(rep.color, positions, moves);
      const result = addGraphMove(graph, from.positionKey, input.move);
      const idByKey = new Map(positions.map((p) => [p.positionKey, p.id]));

      switch (result.status) {
        case "unknown-position":
          throw notFound("Position");
        case "illegal":
          throw new ORPCError("BAD_REQUEST", { message: "That move is not legal here." });
        case "cycle":
          throw new ORPCError("BAD_REQUEST", {
            message: "That move would lead back to an earlier position of this line.",
          });
        case "duplicate": {
          const toId = idByKey.get(result.move.toKey)!;
          const existing = moves.find(
            (m) => m.fromPositionId === from.id && m.uci === result.move.uci,
          )!;
          return {
            status: "duplicate" as const,
            createdPosition: false,
            move: { ...existing, toPositionId: toId, isUserMove: result.move.isUserMove },
          };
        }
        case "added": {
          let toId = idByKey.get(result.move.toKey);
          if (!toId) {
            const target = result.graph.positions[result.move.toKey]!;
            const [inserted] = await tx
              .insert(repertoirePosition)
              .values({
                repertoireId: input.repertoireId,
                userId,
                positionKey: target.key,
                fen: target.fen,
                sideToMove: target.sideToMove,
              })
              .returning({ id: repertoirePosition.id });
            toId = inserted!.id;
          }
          const [row] = await tx
            .insert(repertoireMove)
            .values({
              repertoireId: input.repertoireId,
              userId,
              fromPositionId: from.id,
              toPositionId: toId,
              san: result.move.san,
              uci: result.move.uci,
            })
            .returning({
              id: repertoireMove.id,
              fromPositionId: repertoireMove.fromPositionId,
              toPositionId: repertoireMove.toPositionId,
              san: repertoireMove.san,
              uci: repertoireMove.uci,
            });
          return {
            status: "added" as const,
            createdPosition: result.createdPosition,
            move: { ...row!, isUserMove: result.move.isUserMove },
          };
        }
      }
    });
  }

  async function deleteMove(userId: string, input: { repertoireId: string; moveId: string }) {
    return db.transaction(async (tx) => {
      await lockRepertoire(tx, input.repertoireId, userId);
      const { positions, moves } = await loadRows(tx, input.repertoireId, userId);
      if (!moves.some((m) => m.id === input.moveId)) throw notFound("Move");

      const remaining = moves.filter((m) => m.id !== input.moveId);
      const startKey = positionKey(START_FEN);
      const start = positions.find((p) => p.positionKey === startKey)!;
      const reachable = reachablePositionIds(start.id, remaining);
      const unreachable = positions.filter((p) => !reachable.has(p.id)).map((p) => p.id);

      // The edge goes first; deleting a position cascades to its moves and its idea note.
      await tx
        .delete(repertoireMove)
        .where(and(eq(repertoireMove.id, input.moveId), eq(repertoireMove.userId, userId)));
      if (unreachable.length > 0) {
        await tx
          .delete(repertoirePosition)
          .where(
            and(inArray(repertoirePosition.id, unreachable), eq(repertoirePosition.userId, userId)),
          );
      }
      const survivingMoves = remaining.filter((m) => reachable.has(m.fromPositionId));
      return {
        removedMoves: moves.length - survivingMoves.length,
        removedPositions: unreachable.length,
      };
    });
  }

  async function setIdeaNote(
    userId: string,
    input: { repertoireId: string; positionId: string } & IdeaNoteInput,
  ) {
    return db.transaction(async (tx) => {
      await lockRepertoire(tx, input.repertoireId, userId);
      const [position] = await tx
        .select({ id: repertoirePosition.id })
        .from(repertoirePosition)
        .where(
          and(
            eq(repertoirePosition.id, input.positionId),
            eq(repertoirePosition.repertoireId, input.repertoireId),
            eq(repertoirePosition.userId, userId),
          ),
        );
      if (!position) throw notFound("Position");

      const empty =
        input.arrows.length === 0 && input.highlights.length === 0 && input.plan.length === 0;
      if (empty) {
        await tx
          .delete(ideaNote)
          .where(and(eq(ideaNote.repertoirePositionId, position.id), eq(ideaNote.userId, userId)));
        return { positionId: position.id, note: null };
      }
      const values = { arrows: input.arrows, highlights: input.highlights, plan: input.plan };
      await tx
        .insert(ideaNote)
        .values({ repertoirePositionId: position.id, userId, ...values })
        .onConflictDoUpdate({
          target: ideaNote.repertoirePositionId,
          set: { ...values, updatedAt: new Date() },
        });
      return { positionId: position.id, note: values };
    });
  }

  return { list, create, rename, remove, get, addMove, deleteMove, setIdeaNote };
}
