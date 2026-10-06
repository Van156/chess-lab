import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { game, mistake } from "@b2c-template/db/schema/games";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { mistakesRouter } from "./mistakes";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "mistakes router");

const PGN = "1. e4 e5 2. a3 Nc6 *";
const FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("mistakes router", () => {
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

  async function seedGame(userId: string, key: string, day: number) {
    const [g] = await handle.db
      .insert(game)
      .values({
        userId,
        lichessGameId: key,
        pgn: PGN,
        userColor: "white",
        speed: "blitz",
        rated: true,
        result: "1-0",
        playedAt: new Date(Date.UTC(2026, 2, day)),
      })
      .returning();
    return g!.id;
  }

  async function seedMistake(userId: string, gameId: string, ply: number) {
    const [m] = await handle.db
      .insert(mistake)
      .values({
        userId,
        gameId,
        ply,
        fenBefore: FEN,
        positionKey: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
        playedSan: "a3",
        playedUci: "a2a3",
        bestSan: "Nf3",
        bestUci: "g1f3",
        evalBeforeCp: 30,
        evalAfterCp: -300,
        evalLossCp: 330,
        severity: "blunder",
        phase: "opening",
        eco: "C20",
        openingName: "King's Pawn Game",
      })
      .returning();
    return m!.id;
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  test("list returns only the session user's mistakes with the display fields", async () => {
    const g1 = await seedGame("u1", "g-1", 1);
    const g2 = await seedGame("u2", "g-2", 2);
    const mine = await seedMistake("u1", g1, 3);
    await seedMistake("u2", g2, 3);

    const page = await call(mistakesRouter.list, undefined, { context: context("u1") });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toEqual({
      id: mine,
      gameId: g1,
      ply: 3,
      fenBefore: FEN,
      playedSan: "a3",
      playedUci: "a2a3",
      bestSan: "Nf3",
      bestUci: "g1f3",
      evalBeforeCp: 30,
      evalAfterCp: -300,
      evalLossCp: 330,
      severity: "blunder",
      phase: "opening",
      eco: "C20",
      openingName: "King's Pawn Game",
      clockLeftMs: null,
      clockInitialMs: null,
      playedAt: new Date(Date.UTC(2026, 2, 1)),
    });
  });

  test("list orders newest game first and pages by cursor without gaps or repeats", async () => {
    const ids: string[] = [];
    for (let day = 1; day <= 3; day++) {
      const g = await seedGame("u1", `g-${day}`, day);
      ids.push(await seedMistake("u1", g, 3), await seedMistake("u1", g, 5));
    }
    const first = await call(mistakesRouter.list, undefined, { context: context("u1") });
    expect(first.items[0]?.playedAt).toEqual(new Date(Date.UTC(2026, 2, 3)));

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await call(
        mistakesRouter.list,
        { limit: 4, cursor },
        { context: context("u1") },
      );
      seen.push(...page.items.map((m) => m.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(6);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  test("list can be narrowed to one of the user's games, and a foreign game yields nothing", async () => {
    const g1 = await seedGame("u1", "g-1", 1);
    const g2 = await seedGame("u1", "g-2", 2);
    const foreign = await seedGame("u2", "g-3", 3);
    await seedMistake("u1", g1, 3);
    await seedMistake("u1", g2, 3);
    await seedMistake("u2", foreign, 3);

    const narrowed = await call(mistakesRouter.list, { gameId: g1 }, { context: context("u1") });
    expect(narrowed.items.map((m) => m.gameId)).toEqual([g1]);
    const foreignPage = await call(
      mistakesRouter.list,
      { gameId: foreign },
      { context: context("u1") },
    );
    expect(foreignPage.items).toEqual([]);
  });

  test.each([
    ["a garbage cursor", { cursor: "not-a-cursor" }],
    ["a zero limit", { limit: 0 }],
    ["an oversized limit", { limit: 1000 }],
  ])("list rejects %s", async (_name, input) => {
    expect(
      await codeOf(call(mistakesRouter.list, input as never, { context: context("u1") })),
    ).toBe("BAD_REQUEST");
  });

  test("get returns the mistake with its game for the owner", async () => {
    const g = await seedGame("u1", "g-1", 1);
    const id = await seedMistake("u1", g, 3);
    const found = await call(mistakesRouter.get, { id }, { context: context("u1") });
    expect(found).toMatchObject({
      id,
      fenBefore: FEN,
      playedUci: "a2a3",
      bestUci: "g1f3",
      severity: "blunder",
      game: {
        id: g,
        lichessGameId: "g-1",
        pgn: PGN,
        userColor: "white",
        result: "1-0",
      },
    });
  });

  test("get returns NOT_FOUND for another user's mistake and for an unknown id", async () => {
    const g = await seedGame("u2", "g-1", 1);
    const foreign = await seedMistake("u2", g, 3);
    expect(
      await codeOf(call(mistakesRouter.get, { id: foreign }, { context: context("u1") })),
    ).toBe("NOT_FOUND");
    expect(
      await codeOf(call(mistakesRouter.get, { id: "missing" }, { context: context("u1") })),
    ).toBe("NOT_FOUND");
  });

  test("list and get return NOT_FOUND when the mistakes pillar is off", async () => {
    const g = await seedGame("u1", "g-1", 1);
    const id = await seedMistake("u1", g, 3);
    const off = context("u1", parseFeatureFlags({ CHESSLAB_FEATURES: "repertoire" }));
    expect(await codeOf(call(mistakesRouter.list, undefined, { context: off }))).toBe("NOT_FOUND");
    expect(await codeOf(call(mistakesRouter.get, { id }, { context: off }))).toBe("NOT_FOUND");
  });

  test("list and get reject an unauthenticated caller", async () => {
    const g = await seedGame("u1", "g-1", 1);
    const id = await seedMistake("u1", g, 3);
    expect(await codeOf(call(mistakesRouter.list, undefined, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
    expect(await codeOf(call(mistakesRouter.get, { id }, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
  });
});
