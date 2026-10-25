import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import {
  ideaNote,
  repertoire,
  repertoireMove,
  repertoirePosition,
} from "@b2c-template/db/schema/repertoire";
import { userSettings } from "@b2c-template/db/schema/settings";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { Context, ExplorerQuery, ExplorerResult } from "../context";
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

  const explorerCalls: { userId: string; query: ExplorerQuery }[] = [];
  let explorerResult: ExplorerResult = {
    status: "ok",
    stale: false,
    stats: { white: 0, draws: 0, black: 0, moves: [] },
  };

  const context = (userId: string, flags = "repertoire"): Context =>
    ({
      session: { user: { id: userId } },
      db: handle.db,
      features: parseFeatureFlags({ CHESSLAB_FEATURES: flags }),
      lichess: {
        explorer: async (id: string, query: ExplorerQuery) => {
          explorerCalls.push({ userId: id, query });
          return explorerResult;
        },
      },
    }) as unknown as Context;

  const as = (userId: string) => ({ context: context(userId) });

  beforeEach(async () => {
    explorerCalls.length = 0;
    explorerResult = {
      status: "ok",
      stale: false,
      stats: { white: 0, draws: 0, black: 0, moves: [] },
    };
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
    expect(
      await codeOf(call(repertoireRouter.explorer, { repertoireId: "x", positionId: "y" }, off)),
    ).toBe("NOT_FOUND");
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
      expect(removed).toMatchObject({ removedMoves: 3, removedPositions: 3 });
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

  describe("deleteMove snapshot and restoreDeleted", () => {
    /** Every stored row of one repertoire, ordered by id, for exact before/after comparison. */
    async function dump(repertoireId: string) {
      const byId = <T extends { id: string }>(rows: T[]) =>
        rows.toSorted((a, b) => a.id.localeCompare(b.id));
      const positions = byId(
        await handle.db
          .select()
          .from(repertoirePosition)
          .where(eq(repertoirePosition.repertoireId, repertoireId)),
      );
      const moves = byId(
        await handle.db
          .select()
          .from(repertoireMove)
          .where(eq(repertoireMove.repertoireId, repertoireId)),
      );
      const notes = (await handle.db.select().from(ideaNote)).toSorted((a, b) =>
        a.repertoirePositionId.localeCompare(b.repertoirePositionId),
      );
      const [rep] = await handle.db
        .select()
        .from(repertoire)
        .where(eq(repertoire.id, repertoireId));
      return { positions, moves, notes, basePositionId: rep!.basePositionId };
    }

    async function treeOf(id: string) {
      return call(repertoireRouter.get, { id }, as("u1"));
    }

    test("round trip: names, notes and the base come back as the identical rows", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      await line(id, startId, ["d4"]);
      const tree = await treeOf(id);
      const e4 = tree.moves.find((m) => m.fromPositionId === startId && m.san === "e4")!;
      const e5 = tree.moves.find((m) => m.fromPositionId === ids[1])!;
      await call(
        repertoireRouter.renameLine,
        { repertoireId: id, moveId: e5.id, name: "Open game" },
        as("u1"),
      );
      await call(
        repertoireRouter.setIdeaNote,
        {
          repertoireId: id,
          positionId: ids[2]!,
          arrows: [{ from: "g1", to: "f3" }],
          highlights: ["e5"],
          plan: "Develop",
        },
        as("u1"),
      );
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: ids[3]! }, as("u1"));
      const before = await dump(id);

      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: e4.id },
        as("u1"),
      );
      expect(removed.removedMoves).toBe(3);
      expect(removed.removedPositions).toBe(3);
      expect(removed.snapshot.version).toBe(1);
      expect(removed.snapshot.deletedMoveId).toBe(e4.id);
      expect(removed.snapshot.positions.map((p) => p.id).toSorted()).toEqual(
        ids.slice(1).toSorted(),
      );
      expect(removed.snapshot.moves).toHaveLength(3);
      expect(removed.snapshot.ideaNotes).toHaveLength(1);
      expect(removed.snapshot.basePositionId).toBe(ids[3]!);
      expect((await dump(id)).basePositionId).toBeNull();

      // Through JSON, as the client sends it back.
      const snapshot = JSON.parse(JSON.stringify(removed.snapshot));
      const restored = await call(
        repertoireRouter.restoreDeleted,
        { repertoireId: id, snapshot },
        as("u1"),
      );
      expect(restored.restoredMoveId).toBe(e4.id);
      expect(await dump(id)).toEqual(before);
      expect((await treeOf(id)).moves.find((m) => m.id === e5.id)!.name).toBe("Open game");
    });

    test("a position that stays reachable by transposition is not in the snapshot", async () => {
      const { id, startId } = await newRepertoire();
      const a = await line(id, startId, ["d4", "Nf6", "c4"]);
      await line(id, startId, ["c4", "Nf6", "d4"]);
      const before = await dump(id);
      const tree = await treeOf(id);
      const d4 = tree.moves.find((m) => m.fromPositionId === startId && m.san === "d4")!;
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: d4.id },
        as("u1"),
      );
      expect(removed.snapshot.positions.map((p) => p.id)).not.toContain(a[3]!);
      // Its move into the survivor leaves with the pruned position, so it is in the snapshot.
      expect(removed.snapshot.moves.some((m) => m.toPositionId === a[3]!)).toBe(true);
      await call(
        repertoireRouter.restoreDeleted,
        { repertoireId: id, snapshot: removed.snapshot },
        as("u1"),
      );
      expect(await dump(id)).toEqual(before);
    });

    test("a position re-added through another route is reused and its moves are remapped", async () => {
      const { id, startId } = await newRepertoire();
      const a = await line(id, startId, ["d4", "Nf6", "c4"]);
      const tree = await treeOf(id);
      const d4 = tree.moves.find((m) => m.fromPositionId === startId)!;
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: d4.id },
        as("u1"),
      );
      expect(removed.snapshot.positions.map((p) => p.id)).toContain(a[3]!);
      // The same position comes back through a different move order, under a new id.
      const again = await line(id, startId, ["c4", "Nf6", "d4"]);
      expect(again[3]).not.toBe(a[3]);
      await call(
        repertoireRouter.restoreDeleted,
        { repertoireId: id, snapshot: removed.snapshot },
        as("u1"),
      );
      const after = await treeOf(id);
      expect(after.positions.filter((p) => p.id === a[3]! || p.id === again[3]!)).toHaveLength(1);
      expect(after.positions.some((p) => p.id === again[3]!)).toBe(true);
      const c4 = after.moves.find((m) => m.fromPositionId === a[2]!)!;
      expect(c4.toPositionId).toBe(again[3]!);
      expect(after.positions).toHaveLength(1 + 3 + 3 - 1);
    });

    test("reports the position the restored move lands on, after remapping", async () => {
      const { id, startId } = await newRepertoire();
      const a = await line(id, startId, ["d4", "Nf6", "Nf3"]);
      const nf3 = (await treeOf(id)).moves.find((m) => m.fromPositionId === a[2]!)!;
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: nf3.id },
        as("u1"),
      );
      // Without a re-add the original position id comes back.
      const plain = await call(
        repertoireRouter.restoreDeleted,
        { repertoireId: id, snapshot: removed.snapshot },
        as("u1"),
      );
      expect(plain.restoredToPositionId).toBe(a[3]!);

      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId: nf3.id }, as("u1"));
      // The same position is reached again by another move order, under a new id.
      const again = await line(id, startId, ["Nf3", "Nf6", "d4"]);
      expect(again[3]).not.toBe(a[3]);
      const remapped = await call(
        repertoireRouter.restoreDeleted,
        { repertoireId: id, snapshot: removed.snapshot },
        as("u1"),
      );
      expect(remapped.restoredToPositionId).toBe(again[3]!);
    });

    test("restore is a CONFLICT with a reason, and inserts nothing", async () => {
      const reason = async (promise: Promise<unknown>) => {
        try {
          await promise;
        } catch (error) {
          return error instanceof ORPCError
            ? `${error.code}:${(error.data as { reason: string }).reason}`
            : "OTHER";
        }
        return undefined;
      };
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      const tree = await treeOf(id);
      const e4 = tree.moves.find((m) => m.fromPositionId === startId)!;
      const e5 = tree.moves.find((m) => m.fromPositionId === ids[1])!;
      const restore = (snapshot: unknown) =>
        call(
          repertoireRouter.restoreDeleted,
          { repertoireId: id, snapshot: snapshot as never },
          as("u1"),
        );

      // The edge exists again: 1...e5 was replayed by hand.
      const deletedE5 = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: e5.id },
        as("u1"),
      );
      await play(id, ids[1]!, "e5");
      const before = await dump(id);
      expect(await reason(restore(deletedE5.snapshot))).toBe("CONFLICT:edge_exists");
      expect(await dump(id)).toEqual(before);

      // The parent is gone: 1.e4 was deleted afterwards.
      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId: e4.id }, as("u1"));
      const gone = await dump(id);
      expect(await reason(restore(deletedE5.snapshot))).toBe("CONFLICT:parent_missing");
      expect(await dump(id)).toEqual(gone);
    });

    test("another user's repertoire is NOT_FOUND and a mismatched repertoireId is BAD_REQUEST", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const other = await newRepertoire("u2");
      const tree = await treeOf(id);
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: tree.moves[0]!.id },
        as("u1"),
      );
      const send = (repertoireId: string, userId: string) =>
        call(
          repertoireRouter.restoreDeleted,
          { repertoireId, snapshot: removed.snapshot },
          as(userId),
        );
      expect(await codeOf(send(id, "u2"))).toBe("NOT_FOUND");
      expect(await codeOf(send(other.id, "u2"))).toBe("BAD_REQUEST");
      expect((await treeOf(id)).moves).toEqual([]);
      expect((await call(repertoireRouter.get, { id: other.id }, as("u2"))).moves).toEqual([]);
      // The real owner can still restore it.
      expect((await send(id, "u1")).restoredMoveId).toBe(tree.moves[0]!.id);
    });

    test("a forged snapshot with an illegal move is BAD_REQUEST", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const tree = await treeOf(id);
      const removed = await call(
        repertoireRouter.deleteMove,
        { repertoireId: id, moveId: tree.moves[0]!.id },
        as("u1"),
      );
      const forged = {
        ...removed.snapshot,
        moves: removed.snapshot.moves.map((m) => ({ ...m, uci: "e2e5" })),
      };
      expect(
        await codeOf(
          call(repertoireRouter.restoreDeleted, { repertoireId: id, snapshot: forged }, as("u1")),
        ),
      ).toBe("BAD_REQUEST");
    });
  });

  describe("setBase", () => {
    const baseOf = async (id: string, userId = "u1") =>
      (await call(repertoireRouter.get, { id }, as(userId))).basePositionId;

    test("a new repertoire has no base; set, get and clear round-trip", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      expect(await baseOf(id)).toBeNull();

      const set = await call(
        repertoireRouter.setBase,
        { repertoireId: id, positionId: ids[2]! },
        as("u1"),
      );
      expect(set).toEqual({ basePositionId: ids[2]! });
      expect(await baseOf(id)).toBe(ids[2]!);

      const cleared = await call(
        repertoireRouter.setBase,
        { repertoireId: id, positionId: null },
        as("u1"),
      );
      expect(cleared).toEqual({ basePositionId: null });
      expect(await baseOf(id)).toBeNull();
    });

    test("the start position is stored as no base", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4"]);
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: ids[1]! }, as("u1"));
      const result = await call(
        repertoireRouter.setBase,
        { repertoireId: id, positionId: startId },
        as("u1"),
      );
      expect(result).toEqual({ basePositionId: null });
      expect(await baseOf(id)).toBeNull();
    });

    test("rejects a position of another repertoire, an unknown one and another user's repertoire", async () => {
      const a = await newRepertoire();
      const b = await newRepertoire();
      const aIds = await line(a.id, a.startId, ["e4"]);
      const bIds = await line(b.id, b.startId, ["d4"]);
      expect(
        await codeOf(
          call(repertoireRouter.setBase, { repertoireId: a.id, positionId: bIds[1]! }, as("u1")),
        ),
      ).toBe("NOT_FOUND");
      expect(
        await codeOf(
          call(repertoireRouter.setBase, { repertoireId: a.id, positionId: "nope" }, as("u1")),
        ),
      ).toBe("NOT_FOUND");
      expect(
        await codeOf(
          call(repertoireRouter.setBase, { repertoireId: a.id, positionId: aIds[1]! }, as("u2")),
        ),
      ).toBe("NOT_FOUND");
      expect(await baseOf(a.id)).toBeNull();
    });

    test("deleting the branch that holds the base clears it without error", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: ids[3]! }, as("u1"));
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      const e4 = tree.moves.find((m) => m.fromPositionId === startId)!;
      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId: e4.id }, as("u1"));

      const after = await call(repertoireRouter.get, { id }, as("u1"));
      expect(after.basePositionId).toBeNull();
      // Only the base column is nulled: the repertoire keeps its owner and id.
      expect(after.repertoire.id).toBe(id);
      expect((await call(repertoireRouter.list, undefined, as("u1"))).map((r) => r.id)).toEqual([
        id,
      ]);
    });

    test("deleting a branch that does not hold the base keeps it", async () => {
      const { id, startId } = await newRepertoire();
      const e4 = await line(id, startId, ["e4", "e5"]);
      await line(id, startId, ["d4"]);
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: e4[2]! }, as("u1"));
      const tree = await call(repertoireRouter.get, { id }, as("u1"));
      const d4 = tree.moves.find((m) => m.fromPositionId === startId && m.san === "d4")!;
      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId: d4.id }, as("u1"));
      expect(await baseOf(id)).toBe(e4[2]!);
    });
  });

  describe("renameLine", () => {
    const nameOf = async (id: string, moveId: string, userId = "u1") =>
      (await call(repertoireRouter.get, { id }, as(userId))).moves.find((m) => m.id === moveId)!
        .name;
    const firstMove = async (id: string) =>
      (await call(repertoireRouter.get, { id }, as("u1"))).moves[0]!.id;
    const rename = (repertoireId: string, moveId: string, name: string | null, userId = "u1") =>
      call(repertoireRouter.renameLine, { repertoireId, moveId, name }, as(userId));

    test("names a move, trims it and get returns it", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4", "e5"]);
      const moveId = await firstMove(id);
      expect(await nameOf(id, moveId)).toBeNull();
      expect(await rename(id, moveId, "  Scotch gambit  ")).toEqual({
        moveId,
        name: "Scotch gambit",
      });
      expect(await nameOf(id, moveId)).toBe("Scotch gambit");
    });

    test("a blank or null name clears it", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const moveId = await firstMove(id);
      await rename(id, moveId, "Open game");
      expect(await rename(id, moveId, "   ")).toEqual({ moveId, name: null });
      expect(await nameOf(id, moveId)).toBeNull();
      await rename(id, moveId, "Open game");
      expect(await rename(id, moveId, null)).toEqual({ moveId, name: null });
      expect(await nameOf(id, moveId)).toBeNull();
    });

    test("accepts the limit and rejects a longer name", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const moveId = await firstMove(id);
      await rename(id, moveId, "x".repeat(80));
      expect(await codeOf(rename(id, moveId, "x".repeat(81)))).toBe("BAD_REQUEST");
      expect(await nameOf(id, moveId)).toBe("x".repeat(80));
    });

    test("rejects a move of another repertoire and another user's repertoire", async () => {
      const a = await newRepertoire();
      const b = await newRepertoire();
      await line(a.id, a.startId, ["e4"]);
      await line(b.id, b.startId, ["d4"]);
      const aMove = await firstMove(a.id);
      const bMove = await firstMove(b.id);
      expect(await codeOf(rename(a.id, bMove, "x"))).toBe("NOT_FOUND");
      expect(await codeOf(rename(a.id, "nope", "x"))).toBe("NOT_FOUND");
      expect(await codeOf(rename(a.id, aMove, "x", "u2"))).toBe("NOT_FOUND");
      expect(await nameOf(a.id, aMove)).toBeNull();
      expect(await nameOf(b.id, bMove)).toBeNull();
    });

    test("deleting the move deletes its name", async () => {
      const { id, startId } = await newRepertoire();
      await line(id, startId, ["e4"]);
      const moveId = await firstMove(id);
      await rename(id, moveId, "Open game");
      await call(repertoireRouter.deleteMove, { repertoireId: id, moveId }, as("u1"));
      expect((await call(repertoireRouter.get, { id }, as("u1"))).moves).toEqual([]);
    });
  });

  describe("delete with a base", () => {
    test("deleting a repertoire whose base is set removes every row", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5", "Nf3"]);
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: ids[3]! }, as("u1"));

      await call(repertoireRouter.delete, { id }, as("u1"));

      expect(await call(repertoireRouter.list, undefined, as("u1"))).toEqual([]);
      expect(await codeOf(call(repertoireRouter.get, { id }, as("u1")))).toBe("NOT_FOUND");
      expect(
        await handle.db
          .select()
          .from(repertoirePosition)
          .where(eq(repertoirePosition.repertoireId, id)),
      ).toEqual([]);
      expect(
        await handle.db.select().from(repertoireMove).where(eq(repertoireMove.repertoireId, id)),
      ).toEqual([]);
    });

    test("deleting the user whose repertoire has a base removes the repertoire rows", async () => {
      const { id, startId } = await newRepertoire();
      const ids = await line(id, startId, ["e4", "e5"]);
      await call(repertoireRouter.setBase, { repertoireId: id, positionId: ids[2]! }, as("u1"));

      await handle.db.delete(user).where(eq(user.id, "u1"));

      expect(await handle.db.select().from(repertoire).where(eq(repertoire.id, id))).toEqual([]);
      expect(
        await handle.db
          .select()
          .from(repertoirePosition)
          .where(eq(repertoirePosition.repertoireId, id)),
      ).toEqual([]);
      expect(
        await handle.db.select().from(repertoireMove).where(eq(repertoireMove.repertoireId, id)),
      ).toEqual([]);
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
  describe("explorer", () => {
    const explorer = (repertoireId: string, positionId: string, userId = "u1") =>
      call(repertoireRouter.explorer, { repertoireId, positionId }, as(userId));

    const setSnapshot = (ratingSnapshot: unknown, userId = "u1") =>
      handle.db
        .insert(lichessProfile)
        .values({ userId, lichessId: userId, username: userId, ratingSnapshot });

    test("another user's repertoire or position is NOT_FOUND and the port is not called", async () => {
      const { id, startId } = await newRepertoire("u1");
      expect(await codeOf(explorer(id, startId, "u2"))).toBe("NOT_FOUND");
      expect(await codeOf(explorer(id, "missing"))).toBe("NOT_FOUND");
      expect(explorerCalls).toHaveLength(0);
    });

    test("a position of another repertoire of the same user is NOT_FOUND", async () => {
      const a = await newRepertoire("u1");
      const b = await newRepertoire("u1", "black");
      expect(await codeOf(explorer(a.id, b.startId))).toBe("NOT_FOUND");
      expect(explorerCalls).toHaveLength(0);
    });

    test("queries the port with the position, the three speeds and the band of the snapshot", async () => {
      await setSnapshot({
        blitz: { rating: 1400, games: 10 },
        rapid: { rating: 1650, games: 300 },
        bullet: { rating: 2400, games: 9000 },
      });
      const { id, startId } = await newRepertoire("u1");
      const [, afterE4] = await line(id, startId, ["e4"]);
      const [position] = await handle.db
        .select()
        .from(repertoirePosition)
        .where(eq(repertoirePosition.id, afterE4!));

      const result = await explorer(id, afterE4!);

      expect(explorerCalls).toHaveLength(1);
      expect(explorerCalls[0]!.userId).toBe("u1");
      expect(explorerCalls[0]!.query).toEqual({
        positionKey: position!.positionKey,
        fen: position!.fen,
        band: 1600,
        speeds: ["blitz", "rapid", "classical"],
      });
      expect(result).toMatchObject({
        band: 1600,
        offset: 0,
        speeds: ["blitz", "rapid", "classical"],
      });
    });

    test("applies the saved offset", async () => {
      await setSnapshot({ rapid: { rating: 1650, games: 300 } });
      await handle.db.insert(userSettings).values({ userId: "u1", explorerBandOffset: 1 });
      const { id, startId } = await newRepertoire("u1");

      const result = await explorer(id, startId);

      expect(result).toMatchObject({ band: 1800, offset: 1, ownBand: 1600 });
      expect(explorerCalls[0]!.query.band).toBe(1800);
    });

    test("reports the own band unshifted even when the offset is clamped at the list end", async () => {
      await setSnapshot({ rapid: { rating: 2600, games: 300 } });
      await handle.db.insert(userSettings).values({ userId: "u1", explorerBandOffset: 2 });
      const { id, startId } = await newRepertoire("u1");

      expect(await explorer(id, startId)).toMatchObject({ band: 2500, offset: 2, ownBand: 2500 });
    });

    test("does not create a settings row", async () => {
      const { id, startId } = await newRepertoire("u1");
      await explorer(id, startId);
      expect(await handle.db.select().from(userSettings)).toHaveLength(0);
    });

    test("uses the fallback band without a Lichess profile", async () => {
      const { id, startId } = await newRepertoire("u1");
      expect(await explorer(id, startId)).toMatchObject({ band: 1600, offset: 0, ownBand: 1600 });
    });

    test("uses the fallback band for a null or malformed snapshot", async () => {
      const { id, startId } = await newRepertoire("u1");
      await setSnapshot(null);
      expect((await explorer(id, startId)).band).toBe(1600);
      await handle.db.delete(lichessProfile);
      await setSnapshot({ rapid: { rating: "2300", games: 50 } });
      expect((await explorer(id, startId)).band).toBe(1600);
      await handle.db.delete(lichessProfile);
      await setSnapshot([1, 2, 3]);
      expect((await explorer(id, startId)).band).toBe(1600);
    });

    test("maps an ok result, keeping the Lichess order", async () => {
      explorerResult = {
        status: "ok",
        stale: true,
        stats: {
          white: 60,
          draws: 25,
          black: 15,
          opening: { eco: "B00", name: "King's Pawn" },
          moves: [
            { uci: "e7e5", san: "e5", white: 30, draws: 10, black: 5, averageRating: 1700 },
            { uci: "c7c5", san: "c5", white: 10, draws: 5, black: 10 },
          ],
        },
      };
      const { id, startId } = await newRepertoire("u1");

      const { result } = await explorer(id, startId);

      expect(result).toEqual({
        status: "ok",
        stale: true,
        totals: { white: 60, draws: 25, black: 15, games: 100 },
        opening: { eco: "B00", name: "King's Pawn" },
        moves: [
          { san: "e5", uci: "e7e5", white: 30, draws: 10, black: 5, games: 45 },
          { san: "c5", uci: "c7c5", white: 10, draws: 5, black: 10, games: 25 },
        ],
      });
    });

    test("an absent opening maps to null", async () => {
      explorerResult = {
        status: "ok",
        stale: false,
        stats: { white: 0, draws: 0, black: 0, moves: [] },
      };
      const { id, startId } = await newRepertoire("u1");
      const { result } = await explorer(id, startId);
      expect(result).toEqual({
        status: "ok",
        stale: false,
        totals: { white: 0, draws: 0, black: 0, games: 0 },
        opening: null,
        moves: [],
      });
    });

    test.each(["unauthorized", "rate_limited", "timeout", "error"] as const)(
      "passes an unavailable result (%s) through",
      async (reason) => {
        explorerResult = { status: "unavailable", reason };
        const { id, startId } = await newRepertoire("u1");
        const out = await explorer(id, startId);
        expect(out.result).toEqual({ status: "unavailable", reason });
        expect(out.band).toBe(1600);
      },
    );
  });
});
