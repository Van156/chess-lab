import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { card } from "@b2c-template/db/schema/cards";
import { game, gameAnalysis, mistake } from "@b2c-template/db/schema/games";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { MAX_EVALS_PER_SUBMIT, MAX_EVAL_CP } from "./analysis-config";
import { createAnalysisService } from "./analysis-service";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "analysis service");

/** Six plies; white plays plies 1, 3 and 5. */
const PGN = "1. e4 e5 2. a3 Nc6 3. h3 Nf6 *";
const PLIES = 6;

type E = { cp?: number; mate?: number; depth: number; bestUci?: string } | null;

/** Evals for `PGN`: ply 3 is a blunder (loss 430) and ply 5 an inaccuracy (loss 60). */
const evals = (depth = 18): E[] => [
  { cp: 30, depth, bestUci: "e2e4" },
  { cp: -30, depth },
  { cp: 30, depth, bestUci: "g1f3" },
  { cp: 400, depth },
  { cp: -300, depth, bestUci: "g1f3" },
  { cp: 360, depth },
  { cp: -300, depth },
];

describe.skipIf(!reachable)("analysis service", () => {
  let handle: TestDatabaseHandle;
  let clock = new Date("2026-03-10T12:00:00.000Z");
  const service = () => createAnalysisService({ db: handle.db, now: () => clock });

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    clock = new Date("2026-03-10T12:00:00.000Z");
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  async function seedGame(userId: string, key: string, playedAt = "2026-03-01T00:00:00.000Z") {
    const [g] = await handle.db
      .insert(game)
      .values({
        userId,
        lichessGameId: key,
        pgn: PGN,
        userColor: "white",
        speed: "blitz",
        rated: true,
        result: "*",
        eco: "C20",
        openingName: "King's Pawn",
        playedAt: new Date(playedAt),
      })
      .returning();
    await handle.db.insert(gameAnalysis).values({ gameId: g!.id, userId });
    return g!.id;
  }

  async function codeOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      return error instanceof ORPCError ? error.code : "OTHER";
    }
    return undefined;
  }

  async function screenAll(userId: string, gameId: string, depth = 10) {
    return service().submitEvals(userId, {
      gameId,
      fromPly: 0,
      evals: evals(depth),
      phase: "screen",
    });
  }

  describe("next", () => {
    test("returns null when there is nothing to analyse", async () => {
      expect(await service().next("u1")).toBeNull();
    });

    test("returns the oldest non-complete game of the session user", async () => {
      const newer = await seedGame("u1", "g-new", "2026-03-05T00:00:00.000Z");
      const older = await seedGame("u1", "g-old", "2026-03-02T00:00:00.000Z");
      await seedGame("u2", "g-other", "2026-01-01T00:00:00.000Z");
      const first = await service().next("u1");
      expect(first).toMatchObject({
        gameId: older,
        pgn: PGN,
        userColor: "white",
        status: "pending",
        evals: [],
        nextPly: 0,
      });
      await handle.db
        .update(gameAnalysis)
        .set({ status: "complete" })
        .where(eq(gameAnalysis.gameId, older));
      expect((await service().next("u1"))?.gameId).toBe(newer);
    });

    test("skips failed games and returns stored evals with the resume point", async () => {
      const failed = await seedGame("u1", "g-failed", "2026-03-01T00:00:00.000Z");
      await handle.db
        .update(gameAnalysis)
        .set({ status: "failed" })
        .where(eq(gameAnalysis.gameId, failed));
      const id = await seedGame("u1", "g-1", "2026-03-02T00:00:00.000Z");
      await service().submitEvals("u1", {
        gameId: id,
        fromPly: 0,
        evals: evals(10).slice(0, 3),
        phase: "screen",
      });
      const next = await service().next("u1");
      expect(next?.gameId).toBe(id);
      expect(next?.status).toBe("screening");
      expect(next?.nextPly).toBe(3);
      expect(next?.evals).toHaveLength(3);
    });
  });

  describe("submitEvals", () => {
    test("merges by ply, advances next_ply and records depth and engine", async () => {
      const id = await seedGame("u1", "g-1");
      const result = await service().submitEvals("u1", {
        gameId: id,
        fromPly: 0,
        evals: evals(10).slice(0, 4),
        phase: "screen",
        engineId: "stockfish-19-lite-single",
      });
      expect(result).toEqual({ status: "screening", nextPly: 4 });
      const [row] = await handle.db.select().from(gameAnalysis);
      expect(row?.screenDepth).toBe(10);
      expect(row?.engineId).toBe("stockfish-19-lite-single");
      expect(row?.evals).toHaveLength(4);
    });

    test("is idempotent and never lowers next_ply or replaces a deeper eval", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id, 10);
      await service().submitEvals("u1", {
        gameId: id,
        fromPly: 3,
        evals: [{ cp: 410, depth: 18, bestUci: "g1f3" }],
        phase: "confirm",
      });
      const again = await service().submitEvals("u1", {
        gameId: id,
        fromPly: 3,
        evals: [{ cp: 999, depth: 10 }],
        phase: "screen",
      });
      expect(again).toEqual({ status: "confirming", nextPly: PLIES + 1 });
      const [row] = await handle.db.select().from(gameAnalysis);
      const stored = row?.evals as E[];
      expect(stored[3]).toEqual({ cp: 410, depth: 18, bestUci: "g1f3" });
      expect(stored).toHaveLength(PLIES + 1);
      expect(row?.confirmDepth).toBe(18);
      expect(row?.screenDepth).toBe(10);
    });

    test("keeps stored evals where the incoming entry is null", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id);
      const [before] = await handle.db.select().from(gameAnalysis);
      await service().submitEvals("u1", {
        gameId: id,
        fromPly: 0,
        evals: [null, null],
        phase: "confirm",
      });
      const [row] = await handle.db.select().from(gameAnalysis);
      expect(row?.evals).toEqual(before?.evals);
    });

    test("clamps stored centipawns to the evaluation clamp", async () => {
      const id = await seedGame("u1", "g-1");
      await service().submitEvals("u1", {
        gameId: id,
        fromPly: 0,
        evals: [
          { cp: 5000, depth: 10 },
          { cp: -5000, depth: 10 },
          { mate: 3, depth: 10 },
        ],
        phase: "screen",
      });
      const [row] = await handle.db.select().from(gameAnalysis);
      const stored = row?.evals as E[];
      expect(stored[0]?.cp).toBe(1000);
      expect(stored[1]?.cp).toBe(-1000);
      expect(stored[2]).toEqual({ mate: 3, depth: 10 });
    });

    test("rejects another user's game and unknown games as NOT_FOUND", async () => {
      const id = await seedGame("u2", "g-1");
      expect(await codeOf(screenAll("u1", id))).toBe("NOT_FOUND");
      expect(await codeOf(screenAll("u1", "missing"))).toBe("NOT_FOUND");
      const [row] = await handle.db.select().from(gameAnalysis);
      expect(row?.evals).toBeNull();
    });

    test.each([
      ["a negative fromPly", { fromPly: -1 }],
      ["plies past the end of the game", { fromPly: PLIES + 1 }],
      ["an empty batch", { evals: [] }],
      ["depth 0", { evals: [{ cp: 0, depth: 0 }] }],
      ["a depth above the bound", { evals: [{ cp: 0, depth: 99 }] }],
      ["a cp above the bound", { evals: [{ cp: MAX_EVAL_CP + 1, depth: 10 }] }],
      ["a cp below the bound", { evals: [{ cp: -MAX_EVAL_CP - 1, depth: 10 }] }],
      ["a fractional cp", { evals: [{ cp: 1.5, depth: 10 }] }],
      ["an entry with both cp and mate", { evals: [{ cp: 1, mate: 1, depth: 10 }] }],
      ["an entry with no score", { evals: [{ depth: 10 }] }],
      ["a malformed best move", { evals: [{ cp: 0, depth: 10, bestUci: "e4" }] }],
      [
        "too many evals in one batch",
        { evals: Array.from({ length: MAX_EVALS_PER_SUBMIT + 1 }, () => null) },
      ],
    ])("rejects %s as BAD_REQUEST and stores nothing", async (_name, over) => {
      const id = await seedGame("u1", "g-1");
      const code = await codeOf(
        service().submitEvals("u1", {
          gameId: id,
          fromPly: 0,
          evals: [{ cp: 0, depth: 10 }],
          phase: "screen",
          ...over,
        } as never),
      );
      expect(code).toBe("BAD_REQUEST");
      const [row] = await handle.db.select().from(gameAnalysis);
      expect(row?.evals).toBeNull();
      expect(row?.status).toBe("pending");
    });

    test("rejects submissions to a completed analysis as CONFLICT", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id);
      await service().complete("u1", { gameId: id });
      expect(await codeOf(screenAll("u1", id))).toBe("CONFLICT");
    });
  });

  describe("complete", () => {
    test("upserts mistakes, creates one New card per carded mistake and marks complete", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id, 18);
      const result = await service().complete("u1", { gameId: id });
      expect(result).toEqual({ gameId: id, mistakes: 2, cardsCreated: 1 });

      const rows = await handle.db.select().from(mistake).orderBy(mistake.ply);
      expect(rows.map((r) => [r.ply, r.severity, r.userId, r.eco])).toEqual([
        [3, "blunder", "u1", "C20"],
        [5, "inaccuracy", "u1", "C20"],
      ]);
      expect(rows[0]).toMatchObject({ playedSan: "a3", bestSan: "Nf3", evalLossCp: 430 });

      const cards = await handle.db.select().from(card);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ mistakeId: rows[0]!.id, userId: "u1", state: 0 });
      expect(cards[0]?.due.getTime()).toBe(clock.getTime());

      const [analysis] = await handle.db.select().from(gameAnalysis);
      expect(analysis?.status).toBe("complete");
      expect(analysis?.analysedAt?.getTime()).toBe(clock.getTime());
    });

    test("a repeat complete creates no duplicate mistakes or cards", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id, 18);
      await service().complete("u1", { gameId: id });
      const again = await service().complete("u1", { gameId: id });
      expect(again).toEqual({ gameId: id, mistakes: 2, cardsCreated: 0 });
      expect(await handle.db.select().from(mistake)).toHaveLength(2);
      expect(await handle.db.select().from(card)).toHaveLength(1);
    });

    test("rejects a game that has not been screened to the end as CONFLICT", async () => {
      const id = await seedGame("u1", "g-1");
      await service().submitEvals("u1", {
        gameId: id,
        fromPly: 0,
        evals: evals(10).slice(0, 3),
        phase: "screen",
      });
      expect(await codeOf(service().complete("u1", { gameId: id }))).toBe("CONFLICT");
      expect(await handle.db.select().from(mistake)).toHaveLength(0);
    });

    test("rejects another user's game as NOT_FOUND and writes nothing", async () => {
      const id = await seedGame("u2", "g-1");
      expect(await codeOf(service().complete("u1", { gameId: id }))).toBe("NOT_FOUND");
      expect(await handle.db.select().from(mistake)).toHaveLength(0);
    });

    test("is all-or-nothing: a failing card insert rolls back mistakes and status", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id, 18);
      const failing = createAnalysisService({
        db: handle.db,
        now: () => {
          throw new Error("clock failed");
        },
      });
      await expect(failing.complete("u1", { gameId: id })).rejects.toThrow("clock failed");
      expect(await handle.db.select().from(mistake)).toHaveLength(0);
      const [analysis] = await handle.db.select().from(gameAnalysis);
      expect(analysis?.status).not.toBe("complete");
    });

    test("marks an unreadable game failed so it stops blocking next", async () => {
      const id = await seedGame("u1", "g-1");
      await handle.db.update(game).set({ pgn: "not a pgn at all" }).where(eq(game.id, id));
      expect(await codeOf(screenAll("u1", id))).toBe("BAD_REQUEST");
      await handle.db
        .update(gameAnalysis)
        .set({ evals: evals(18), nextPly: PLIES + 1, status: "confirming" })
        .where(eq(gameAnalysis.gameId, id));
      expect(await codeOf(service().complete("u1", { gameId: id }))).toBe("BAD_REQUEST");
      const [analysis] = await handle.db.select().from(gameAnalysis);
      expect(analysis?.status).toBe("failed");
      expect(await service().next("u1")).toBeNull();
    });
  });

  describe("repeatMistakes", () => {
    test("groups the user's mistakes by position and played move across games", async () => {
      for (const key of ["g-1", "g-2"]) {
        const id = await seedGame(
          "u1",
          key,
          key === "g-1" ? "2026-03-01T00:00:00.000Z" : "2026-03-02T00:00:00.000Z",
        );
        await screenAll("u1", id, 18);
        await service().complete("u1", { gameId: id });
      }
      const other = await seedGame("u2", "g-3");
      await screenAll("u2", other, 18);
      await service().complete("u2", { gameId: other });

      const repeats = await service().repeatMistakes("u1");
      // Plies 3 and 5 repeat in both games; the other user's copies are not counted.
      expect(repeats).toHaveLength(2);
      const blunder = repeats.find((r) => r.playedUci === "a2a3");
      expect(blunder).toMatchObject({ occurrences: 2, games: 2 });
      expect(blunder?.positionKey).toBeTruthy();
    });

    test("ignores a mistake seen in only one game", async () => {
      const id = await seedGame("u1", "g-1");
      await screenAll("u1", id, 18);
      await service().complete("u1", { gameId: id });
      expect(await service().repeatMistakes("u1")).toEqual([]);
    });
  });
});
