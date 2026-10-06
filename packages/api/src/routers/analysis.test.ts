import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { card } from "@b2c-template/db/schema/cards";
import { game, gameAnalysis } from "@b2c-template/db/schema/games";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { analysisRouter } from "./analysis";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "analysis router");

const PGN = "1. e4 e5 2. a3 Nc6 3. h3 Nf6 *";
const EVALS = [
  { cp: 30, depth: 18, bestUci: "e2e4" },
  { cp: -30, depth: 18 },
  { cp: 30, depth: 18, bestUci: "g1f3" },
  { cp: 400, depth: 18 },
  { cp: -300, depth: 18, bestUci: "g1f3" },
  { cp: 360, depth: 18 },
  { cp: -300, depth: 18 },
];

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("analysis router", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  const context = (userId: string | null, features = parseFeatureFlags({})): Context =>
    ({
      session: userId ? { user: { id: userId } } : null,
      db: handle.db,
      features,
    }) as unknown as Context;

  async function seedGame(userId: string, key: string) {
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
        playedAt: new Date("2026-03-01T00:00:00.000Z"),
      })
      .returning();
    await handle.db.insert(gameAnalysis).values({ gameId: g!.id, userId });
    return g!.id;
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  test("next, submitEvals and complete run the pipeline for the session user", async () => {
    const id = await seedGame("u1", "g-1");
    await seedGame("u2", "g-2");

    const first = await call(analysisRouter.next, undefined, { context: context("u1") });
    expect(first).toMatchObject({ gameId: id, nextPly: 0, evals: [], status: "pending" });

    const submitted = await call(
      analysisRouter.submitEvals,
      { gameId: id, fromPly: 0, evals: EVALS, phase: "screen" },
      { context: context("u1") },
    );
    expect(submitted).toEqual({ status: "screening", nextPly: 7 });

    const done = await call(analysisRouter.complete, { gameId: id }, { context: context("u1") });
    expect(done).toEqual({ gameId: id, mistakes: 2, cardsCreated: 1 });
    expect(await handle.db.select().from(card)).toHaveLength(1);
    expect(await call(analysisRouter.next, undefined, { context: context("u1") })).toBeNull();
  });

  test.each([
    ["an empty gameId", { gameId: "" }],
    ["a negative fromPly", { fromPly: -1 }],
    ["an unknown phase", { phase: "deep" }],
    ["an out-of-bound depth", { evals: [{ cp: 0, depth: 500 }] }],
    ["an out-of-bound cp", { evals: [{ cp: 1_000_000, depth: 10 }] }],
  ])("submitEvals rejects %s", async (_name, over) => {
    const id = await seedGame("u1", "g-1");
    const code = await codeOf(
      call(
        analysisRouter.submitEvals,
        {
          gameId: id,
          fromPly: 0,
          evals: [{ cp: 0, depth: 10 }],
          phase: "screen",
          ...over,
        } as never,
        { context: context("u1") },
      ),
    );
    expect(code).toBe("BAD_REQUEST");
  });

  test("a foreign game is NOT_FOUND for submitEvals and complete", async () => {
    const id = await seedGame("u2", "g-1");
    expect(
      await codeOf(
        call(
          analysisRouter.submitEvals,
          { gameId: id, fromPly: 0, evals: EVALS, phase: "screen" },
          { context: context("u1") },
        ),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(call(analysisRouter.complete, { gameId: id }, { context: context("u1") })),
    ).toBe("NOT_FOUND");
  });

  test("the mistakes pillar flag gates every procedure as NOT_FOUND", async () => {
    const off = parseFeatureFlags({ CHESSLAB_FEATURES: "blindfold" });
    const id = await seedGame("u1", "g-1");
    expect(
      await codeOf(call(analysisRouter.next, undefined, { context: context("u1", off) })),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(
        call(
          analysisRouter.submitEvals,
          { gameId: id, fromPly: 0, evals: EVALS, phase: "screen" },
          { context: context("u1", off) },
        ),
      ),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(call(analysisRouter.complete, { gameId: id }, { context: context("u1", off) })),
    ).toBe("NOT_FOUND");
  });

  test("unauthenticated callers are rejected", async () => {
    expect(await codeOf(call(analysisRouter.next, undefined, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
    expect(
      await codeOf(call(analysisRouter.complete, { gameId: "x" }, { context: context(null) })),
    ).toBe("UNAUTHORIZED");
  });
});
