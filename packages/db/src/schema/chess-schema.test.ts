import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import * as schema from "./index";

/**
 * Integration tests for the Phase 1 chess schema (ADR-04 to ADR-06): the "exactly one source"
 * CHECK, the idempotency keys and the account-deletion cascade, against the real test database.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "chess schema (ADR-04..06)");

/** Drizzle query builders are thenables, not promises; `rejects` needs a real promise. */
async function run(query: () => PromiseLike<unknown>) {
  await query();
}

describe.skipIf(!reachable)("chess schema", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await handle.db.delete(schema.user);
  });

  async function createUser(id: string) {
    await handle.db.insert(schema.user).values({ id, name: id, email: `${id}@example.test` });
    return id;
  }

  async function createGame(userId: string, lichessGameId = "g1") {
    const [game] = await handle.db
      .insert(schema.game)
      .values({
        userId,
        lichessGameId,
        pgn: "1. e4 e5",
        userColor: "white",
        speed: "blitz",
        timeControlInitialS: 300,
        timeControlIncrementS: 0,
        rated: true,
        result: "1-0",
        playedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .returning();
    return game!;
  }

  function mistakeValues(userId: string, gameId: string, ply: number) {
    return {
      userId,
      gameId,
      ply,
      fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
      playedSan: "f3",
      playedUci: "f2f3",
      bestSan: "e4",
      bestUci: "e2e4",
      evalBeforeCp: 20,
      evalAfterCp: -150,
      evalLossCp: 170,
      severity: "blunder" as const,
      phase: "opening" as const,
    };
  }

  async function createMistake(userId: string, gameId: string, ply = 1) {
    const [mistake] = await handle.db
      .insert(schema.mistake)
      .values(mistakeValues(userId, gameId, ply))
      .returning();
    return mistake!;
  }

  function cardValues(userId: string, mistakeId: string | null) {
    return { userId, mistakeId, due: new Date("2026-01-02T00:00:00Z") };
  }

  test("rejects a card with no source (card_exactly_one_source)", async () => {
    const userId = await createUser("u1");
    await expect(
      run(() => handle.db.insert(schema.card).values(cardValues(userId, null))),
    ).rejects.toThrow();
  });

  test("accepts a card with exactly one source", async () => {
    const userId = await createUser("u1");
    const game = await createGame(userId);
    const mistake = await createMistake(userId, game.id);
    const [card] = await handle.db
      .insert(schema.card)
      .values(cardValues(userId, mistake.id))
      .returning();
    expect(card?.mistakeId).toBe(mistake.id);
  });

  test("enforces unique (user_id, lichess_game_id)", async () => {
    const userId = await createUser("u1");
    await createGame(userId, "same");
    await expect(createGame(userId, "same")).rejects.toThrow();
    const other = await createUser("u2");
    await expect(createGame(other, "same")).resolves.toBeDefined();
  });

  test("enforces unique (game_id, ply) on mistake", async () => {
    const userId = await createUser("u1");
    const game = await createGame(userId);
    await createMistake(userId, game.id, 3);
    await expect(createMistake(userId, game.id, 3)).rejects.toThrow();
    await expect(createMistake(userId, game.id, 5)).resolves.toBeDefined();
  });

  test("enforces one card per mistake", async () => {
    const userId = await createUser("u1");
    const game = await createGame(userId);
    const mistake = await createMistake(userId, game.id);
    await handle.db.insert(schema.card).values(cardValues(userId, mistake.id));
    await expect(
      run(() => handle.db.insert(schema.card).values(cardValues(userId, mistake.id))),
    ).rejects.toThrow();
  });

  test("enforces a unique review_log id (idempotency key)", async () => {
    const userId = await createUser("u1");
    const game = await createGame(userId);
    const mistake = await createMistake(userId, game.id);
    const [card] = await handle.db
      .insert(schema.card)
      .values(cardValues(userId, mistake.id))
      .returning();
    const log = {
      id: "11111111-1111-4111-8111-111111111111",
      userId,
      cardId: card!.id,
      grade: 3,
      reviewedAt: new Date("2026-01-02T00:00:00Z"),
      elapsedMs: 1200,
      stateBefore: {},
      stateAfter: {},
    };
    await handle.db.insert(schema.reviewLog).values(log);
    await expect(run(() => handle.db.insert(schema.reviewLog).values(log))).rejects.toThrow();
  });

  test("deleting a user cascades to every Phase 1 chess table", async () => {
    const userId = await createUser("u1");
    await handle.db
      .insert(schema.lichessProfile)
      .values({ userId, lichessId: "u1", username: "U1" });
    await handle.db.insert(schema.userSettings).values({ userId });
    const game = await createGame(userId);
    await handle.db.insert(schema.gameAnalysis).values({ gameId: game.id, userId });
    const mistake = await createMistake(userId, game.id);
    const [card] = await handle.db
      .insert(schema.card)
      .values(cardValues(userId, mistake.id))
      .returning();
    await handle.db.insert(schema.reviewLog).values({
      id: "22222222-2222-4222-8222-222222222222",
      userId,
      cardId: card!.id,
      grade: 1,
      reviewedAt: new Date("2026-01-02T00:00:00Z"),
      elapsedMs: 500,
      stateBefore: {},
      stateAfter: {},
    });

    await handle.db.delete(schema.user).where(eq(schema.user.id, userId));

    const counts = await Promise.all([
      handle.db.select().from(schema.lichessProfile),
      handle.db.select().from(schema.userSettings),
      handle.db.select().from(schema.game),
      handle.db.select().from(schema.gameAnalysis),
      handle.db.select().from(schema.mistake),
      handle.db.select().from(schema.card),
      handle.db.select().from(schema.reviewLog),
    ]);
    expect(counts.map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
