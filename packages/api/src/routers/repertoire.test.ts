import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { ideaNote, repertoirePosition } from "@b2c-template/db/schema/repertoire";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { repertoireRouter } from "./repertoire";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "repertoire router");

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

async function messageOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.message : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("repertoire router", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  const context = (userId: string, flags = "repertoire"): Context =>
    ({
      session: { user: { id: userId } },
      db: handle.db,
      features: parseFeatureFlags({ CHESSLAB_FEATURES: flags }),
    }) as unknown as Context;

  const as = (userId: string) => ({ context: context(userId) });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  async function newRepertoire(userId = "u1", color: "white" | "black" = "white") {
    const created = await call(repertoireRouter.create, { color, name: "Main" }, as(userId));
    const tree = await call(repertoireRouter.get, { id: created.id }, as(userId));
    return { id: created.id, startId: tree.startPositionId };
  }

  async function play(repertoireId: string, fromPositionId: string, move: string, userId = "u1") {
    return call(repertoireRouter.addMove, { repertoireId, fromPositionId, move }, as(userId));
  }

  /** Plays SANs from the start, returning the position id reached after each move. */
  async function line(repertoireId: string, startId: string, sans: string[]) {
    const ids = [startId];
    for (const san of sans) {
      const r = await play(repertoireId, ids[ids.length - 1]!, san);
      ids.push(r.move.toPositionId);
    }
    return ids;
  }

  test("every procedure is NOT_FOUND with the repertoire flag off", async () => {
    const off = { context: context("u1", "") };
    expect(await codeOf(call(repertoireRouter.list, undefined, off))).toBe("NOT_FOUND");
    expect(await codeOf(call(repertoireRouter.create, { color: "white", name: "x" }, off))).toBe(
      "NOT_FOUND",
    );
    expect(await codeOf(call(repertoireRouter.get, { id: "x" }, off))).toBe("NOT_FOUND");
  });

  describe("repertoires", () => {
    test("create inserts the start position and get returns it", async () => {
      const created = await call(
        repertoireRouter.create,
        { color: "black", name: "  Sicilian  " },
        as("u1"),
      );
      expect(created.name).toBe("Sicilian");
      expect(created.color).toBe("black");

      const tree = await call(repertoireRouter.get, { id: created.id }, as("u1"));
      expect(tree.positions).toHaveLength(1);
      expect(tree.positions[0]!.id).toBe(tree.startPositionId);
      expect(tree.positions[0]!.sideToMove).toBe("w");
      expect(tree.moves).toEqual([]);
      expect(tree.notes).toEqual({});
    });

    test("rejects empty and over-long names", async () => {
      expect(
        await codeOf(call(repertoireRouter.create, { color: "white", name: "   " }, as("u1"))),
      ).toBe("BAD_REQUEST");
      expect(
        await codeOf(
          call(repertoireRouter.create, { color: "white", name: "x".repeat(81) }, as("u1")),
        ),
      ).toBe("BAD_REQUEST");
    });

    test("list returns only the caller's repertoires", async () => {
      await newRepertoire("u1");
      await newRepertoire("u2", "black");
      const mine = await call(repertoireRouter.list, undefined, as("u1"));
      expect(mine).toHaveLength(1);
      expect(mine[0]!.color).toBe("white");
    });

    test("rename and delete", async () => {
      const { id } = await newRepertoire();
      const renamed = await call(repertoireRouter.rename, { id, name: " Italian " }, as("u1"));
      expect(renamed.name).toBe("Italian");
      await call(repertoireRouter.delete, { id }, as("u1"));
      expect(await call(repertoireRouter.list, undefined, as("u1"))).toEqual([]);
      expect(await codeOf(call(repertoireRouter.get, { id }, as("u1")))).toBe("NOT_FOUND");
    });

    test("get is NOT_FOUND, never a server error, when the start position row is gone", async () => {
      const { id, startId } = await newRepertoire();
      await handle.db.delete(repertoirePosition).where(eq(repertoirePosition.id, startId));
      expect(await codeOf(call(repertoireRouter.get, { id }, as("u1")))).toBe("NOT_FOUND");
    });

    test("another user's repertoire is NOT_FOUND for get, rename, delete and addMove", async () => {
      const { id, startId } = await newRepertoire("u1");
      expect(await codeOf(call(repertoireRouter.get, { id }, as("u2")))).toBe("NOT_FOUND");
      expect(await codeOf(call(repertoireRouter.rename, { id, name: "x" }, as("u2")))).toBe(
        "NOT_FOUND",
      );
      expect(await codeOf(call(repertoireRouter.delete, { id }, as("u2")))).toBe("NOT_FOUND");
      expect(await codeOf(play(id, startId, "e4", "u2"))).toBe("NOT_FOUND");
      expect(await call(repertoireRouter.list, undefined, as("u1"))).toHaveLength(1);
    });
  });

  describe("addMove", () => {
    test("adds a move and a position", async () => {
      const { id, startId } = await newRepertoire();
      const r = await play(id, startId, "e4");
      expect(r.status).toBe("added");
      expect(r.createdPosition).toBe(true);
      expect(r.move.san).toBe("e4");
      expect(r.move.uci).toBe("e2e4");
      expect(r.move.fromPositionId).toBe(startId);
      expect(r.move.isUserMove).toBe(true);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.positions).toHaveLength(2);
      expect(tree.moves).toHaveLength(1);
    });

    test("accepts UCI and is idempotent for a duplicate", async () => {
      const { id, startId } = await newRepertoire();
      const first = await play(id, startId, "e4");
      const again = await play(id, startId, "e2e4");
      expect(again.status).toBe("duplicate");
      expect(again.move.id).toBe(first.move.id);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.moves).toHaveLength(1);
    });

    test("illegal move is BAD_REQUEST", async () => {
      const { id, startId } = await newRepertoire();
      expect(await codeOf(play(id, startId, "e5"))).toBe("BAD_REQUEST");
    });

    test("a move that returns to an earlier position is a cycle, with its own message", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["Nf3", "Nf6", "Ng1"]);
      const illegal = await messageOf(play(id, startId, "e5"));
      const cycle = await messageOf(play(id, ids[3]!, "Ng8"));
      expect(await codeOf(play(id, ids[3]!, "Ng8"))).toBe("BAD_REQUEST");
      expect(cycle).toBeDefined();
      expect(cycle).not.toBe(illegal);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.moves).toHaveLength(3);
    });

    test("unknown or foreign position is NOT_FOUND", async () => {
      const { id } = await newRepertoire("u1");
      const other = await newRepertoire("u2");
      expect(await codeOf(play(id, "nope", "e4"))).toBe("NOT_FOUND");
      expect(await codeOf(play(id, other.startId, "e4"))).toBe("NOT_FOUND");
    });

    test("transpositions share one position", async () => {
      const { id, startId } = await newRepertoire();
      const a = await line(id, startId, ["d4", "Nf6", "c4"]);
      const b = await line(id, startId, ["c4", "Nf6", "d4"]);
      expect(b[3]).toBe(a[3]!);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.positions).toHaveLength(6);
      expect(tree.moves).toHaveLength(6);
    });
  });

  describe("deleteMove", () => {
    test("prunes the positions no longer reachable", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      const e4 = tree.moves.find((m) => m.fromPositionId === startId)!;
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: e4.id },
        as("u1"),
      );
      expect(removed).toEqual({ removedMoves: 3, removedPositions: 3 });
      const after = await call(repertoireRouter.get, { id }, as("u1"));
      expect(after.positions.map((p) => p.id)).toEqual([startId]);
      expect(ids).toHaveLength(4);
    });

    test("keeps a transposed position that stays reachable another way", async () => {
      const { id, startId } = await newRepertoire();
      const a = await line(id, startId, ["d4", "Nf6", "c4"]);
      await line(id, startId, ["c4", "Nf6", "d4"]);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      const d4 = tree.moves.find((m) => m.fromPositionId === startId && m.san === "d4")!;
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: d4.id },
        as("u1"),
      );
      // d4 and the d4-Nf6 position go; the shared 1.d4 Nf6 2.c4 position stays via 1.c4 Nf6 2.d4.
      expect(removed.removedPositions).toBe(2);
      const after = await call(repertoireRouter.get, { id }, as("u1"));
      expect(after.positions.some((p) => p.id === a[3])).toBe(true);
      expect(after.positions.some((p) => p.id === a[1])).toBe(false);
      // The edge from the pruned position into the survivor is gone with it.
      expect(after.moves.some((m) => m.fromPositionId === a[2])).toBe(false);
    });

    test("never deletes the start position and rejects another user's move", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      const moveId = tree.moves[0]!.id;
      expect(
        await codeOf(call(repertoireRouter.deleteMove, { repertoireId: id, moveId }, as("u2"))),
      ).toBe("NOT_FOUND");
      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId }, as("u1"));
      const rows = await handle.db
        .select()
        .from(repertoirePosition)
        .where(eq(repertoirePosition.id, startId));
      expect(rows).toHaveLength(1);
      expect(
        await codeOf(call(repertoireRouter.deleteMove, { repertoireId: id, moveId }, as("u1"))),
      ).toBe("NOT_FOUND");
    });
  });

  describe("setIdeaNote", () => {
    const note = {
      arrows: [{ from: "e2", to: "e4" }],
      highlights: ["d4"],
      plan: "Fight for the centre",
    };

    test("creates, edits and clears a note", async () => {
      const { id, startId } = await newRepertoire();
      const set = (over: object) =>
        call(
          repertoireRouter.setIdeaNote,
          { repertoireId: id, positionId: startId, ...note, ...over },
          as("u1"),
        );

      await set({});
      let tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.notes[startId]).toEqual({ ...note });

      await set({ plan: "  Develop  ", highlights: [] });
      tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.notes[startId]).toEqual({ arrows: note.arrows, highlights: [], plan: "Develop" });

      await set({ arrows: [], highlights: [], plan: "   " });
      tree = await call(repertoireRouter.get, { id }, as("u1"));
      expect(tree.notes[startId]).toBeUndefined();
      expect(await handle.db.select().from(ideaNote)).toHaveLength(0);
    });

    test("rejects a 141-character plan, a newline, a bad square and too many items", async () => {
      const { id, startId } = await newRepertoire();
      const bad = (over: object) =>
        codeOf(
          call(
            repertoireRouter.setIdeaNote,
            { repertoireId: id, positionId: startId, ...note, ...over },
            as("u1"),
          ),
        );
      expect(await bad({ plan: "x".repeat(141) })).toBe("BAD_REQUEST");
      expect(await bad({ plan: "a\nb" })).toBe("BAD_REQUEST");
      expect(await bad({ highlights: ["i9"] })).toBe("BAD_REQUEST");
      expect(await bad({ arrows: [{ from: "e2", to: "z4" }] })).toBe("BAD_REQUEST");
      expect(await bad({ highlights: Array.from({ length: 33 }, () => "a1") })).toBe("BAD_REQUEST");
      expect(await bad({ plan: "x".repeat(140) })).toBeUndefined();
    });

    test("another user's position is NOT_FOUND", async () => {
      const { id, startId } = await newRepertoire("u1");
      expect(
        await codeOf(
          call(
            repertoireRouter.setIdeaNote,
            { repertoireId: id, positionId: startId, ...note },
            as("u2"),
          ),
        ),
      ).toBe("NOT_FOUND");
    });
  });
});
