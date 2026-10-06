import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { game, gameAnalysis } from "@b2c-template/db/schema/games";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { gamesRouter } from "./games";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "games router");

const PGN = "1. e4 e5 2. Nf3 Nc6 *";

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("games router", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  const context = (userId: string | null): Context =>
    ({
      session: userId ? { user: { id: userId } } : null,
      db: handle.db,
      features: parseFeatureFlags({}),
    }) as unknown as Context;

  async function seedGame(userId: string, key: string, day: number, withAnalysis = true) {
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
        eco: "C44",
        openingName: "King's Knight Opening",
        playedAt: new Date(Date.UTC(2026, 2, day)),
      })
      .returning();
    if (withAnalysis) {
      await handle.db
        .insert(gameAnalysis)
        .values({ gameId: g!.id, userId, status: day % 2 ? "complete" : "pending" });
    }
    return g!.id;
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  test("list returns only the session user's games, newest first, with analysis status", async () => {
    const older = await seedGame("u1", "g-1", 1);
    const newer = await seedGame("u1", "g-2", 2);
    await seedGame("u2", "g-3", 3);

    const page = await call(gamesRouter.list, undefined, { context: context("u1") });
    expect(page.items.map((g) => g.id)).toEqual([newer, older]);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject({
      lichessGameId: "g-2",
      userColor: "white",
      speed: "blitz",
      result: "1-0",
      openingName: "King's Knight Opening",
      analysisStatus: "pending",
    });
    expect(page.items[1]?.analysisStatus).toBe("complete");
    expect(page.items[0]).not.toHaveProperty("pgn");
  });

  test("list reports a game without an analysis row as pending", async () => {
    await seedGame("u1", "g-1", 1, false);
    const page = await call(gamesRouter.list, undefined, { context: context("u1") });
    expect(page.items[0]?.analysisStatus).toBe("pending");
  });

  test("list pages by cursor without gaps or repeats, ties broken by id", async () => {
    const ids: string[] = [];
    for (let day = 1; day <= 5; day++) ids.push(await seedGame("u1", `g-${day}`, day));
    // Two games sharing one playedAt must still page deterministically.
    ids.push(await seedGame("u1", "g-tie", 5));

    const seen: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await call(gamesRouter.list, { limit: 2, cursor }, { context: context("u1") });
      seen.push(...page.items.map((g) => g.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(6);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  test.each([
    ["a garbage cursor", { cursor: "not-a-cursor" }],
    ["a zero limit", { limit: 0 }],
    ["an oversized limit", { limit: 1000 }],
  ])("list rejects %s", async (_name, input) => {
    expect(await codeOf(call(gamesRouter.list, input as never, { context: context("u1") }))).toBe(
      "BAD_REQUEST",
    );
  });

  test("get returns the game with its PGN and analysis state", async () => {
    const id = await seedGame("u1", "g-1", 1);
    const found = await call(gamesRouter.get, { id }, { context: context("u1") });
    expect(found).toMatchObject({
      id,
      pgn: PGN,
      userColor: "white",
      analysisStatus: "complete",
    });
  });

  test("get returns NOT_FOUND for another user's game and for an unknown id", async () => {
    const foreign = await seedGame("u2", "g-1", 1);
    expect(await codeOf(call(gamesRouter.get, { id: foreign }, { context: context("u1") }))).toBe(
      "NOT_FOUND",
    );
    expect(await codeOf(call(gamesRouter.get, { id: "missing" }, { context: context("u1") }))).toBe(
      "NOT_FOUND",
    );
  });

  test("list and get reject an unauthenticated caller", async () => {
    const id = await seedGame("u1", "g-1", 1);
    expect(await codeOf(call(gamesRouter.list, undefined, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
    expect(await codeOf(call(gamesRouter.get, { id }, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
  });
});
