import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import * as schema from "./index";

/**
 * Integration tests for the Phase 2 repertoire graph (ADR-03, ADR-04): transposition and edge
 * uniqueness, the widened "exactly one source" CHECK and the account-deletion cascade.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "repertoire schema (ADR-03)");

/** Drizzle query builders are thenables, not promises; `rejects` needs a real promise. */
async function run(query: () => PromiseLike<unknown>) {
  await query();
}

const START_KEY = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const START_FEN = `${START_KEY} 0 1`;

describe.skipIf(!reachable)("repertoire schema", () => {
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

  async function createRepertoire(userId: string) {
    const [row] = await handle.db
      .insert(schema.repertoire)
      .values({ userId, color: "white", name: "Main" })
      .returning();
    return row!;
  }

  async function createPosition(userId: string, repertoireId: string, positionKey = START_KEY) {
    const [row] = await handle.db
      .insert(schema.repertoirePosition)
      .values({ userId, repertoireId, positionKey, fen: START_FEN, sideToMove: "w" })
      .returning();
    return row!;
  }

  function moveValues(
    userId: string,
    repertoireId: string,
    fromPositionId: string,
    toPositionId: string,
    uci = "e2e4",
  ) {
    return { userId, repertoireId, fromPositionId, toPositionId, san: "e4", uci };
  }

  function cardValues(
    userId: string,
    sources: { mistakeId?: string; repertoirePositionId?: string },
  ) {
    return { userId, due: new Date("2026-01-02T00:00:00Z"), ...sources };
  }

  async function createMistakeId(userId: string) {
    const [game] = await handle.db
      .insert(schema.game)
      .values({
        userId,
        lichessGameId: "g1",
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
    const [mistake] = await handle.db
      .insert(schema.mistake)
      .values({
        userId,
        gameId: game!.id,
        ply: 1,
        fenBefore: START_FEN,
        positionKey: START_KEY,
        playedSan: "f3",
        playedUci: "f2f3",
        bestSan: "e4",
        bestUci: "e2e4",
        evalBeforeCp: 20,
        evalAfterCp: -150,
        evalLossCp: 170,
        severity: "blunder",
        phase: "opening",
      })
      .returning();
    return mistake!.id;
  }

  test("enforces unique (repertoire_id, position_key)", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    await createPosition(userId, rep.id);
    await expect(createPosition(userId, rep.id)).rejects.toThrow();

    const other = await createRepertoire(userId);
    await expect(createPosition(userId, other.id)).resolves.toBeDefined();
  });

  test("enforces unique (from_position_id, uci)", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    const from = await createPosition(userId, rep.id);
    const to = await createPosition(userId, rep.id, "after e4");
    await handle.db
      .insert(schema.repertoireMove)
      .values(moveValues(userId, rep.id, from.id, to.id));
    await expect(
      run(() =>
        handle.db.insert(schema.repertoireMove).values(moveValues(userId, rep.id, from.id, to.id)),
      ),
    ).rejects.toThrow();
    await expect(
      run(() =>
        handle.db
          .insert(schema.repertoireMove)
          .values(moveValues(userId, rep.id, from.id, to.id, "d2d4")),
      ),
    ).resolves.toBeUndefined();
  });

  test("accepts a card whose only source is a repertoire position", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    const position = await createPosition(userId, rep.id);
    const [card] = await handle.db
      .insert(schema.card)
      .values(cardValues(userId, { repertoirePositionId: position.id }))
      .returning();
    expect(card?.repertoirePositionId).toBe(position.id);
    expect(card?.mistakeId).toBeNull();
  });

  test("rejects a card with no source or with two sources (card_exactly_one_source)", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    const position = await createPosition(userId, rep.id);
    const mistakeId = await createMistakeId(userId);

    await expect(
      run(() => handle.db.insert(schema.card).values(cardValues(userId, {}))),
    ).rejects.toThrow();
    await expect(
      run(() =>
        handle.db
          .insert(schema.card)
          .values(cardValues(userId, { mistakeId, repertoirePositionId: position.id })),
      ),
    ).rejects.toThrow();
  });

  test("enforces one card per repertoire position", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    const position = await createPosition(userId, rep.id);
    const values = cardValues(userId, { repertoirePositionId: position.id });
    await handle.db.insert(schema.card).values(values);
    await expect(run(() => handle.db.insert(schema.card).values(values))).rejects.toThrow();
  });

  test("deleting a user cascades to every repertoire table", async () => {
    const userId = await createUser("u1");
    const rep = await createRepertoire(userId);
    const from = await createPosition(userId, rep.id);
    const to = await createPosition(userId, rep.id, "after e4");
    await handle.db
      .insert(schema.repertoireMove)
      .values(moveValues(userId, rep.id, from.id, to.id));
    await handle.db.insert(schema.ideaNote).values({
      repertoirePositionId: from.id,
      userId,
      arrows: [{ from: "e2", to: "e4" }],
      plan: "Control the centre",
    });
    await handle.db
      .insert(schema.card)
      .values(cardValues(userId, { repertoirePositionId: from.id }));

    await handle.db.delete(schema.user).where(eq(schema.user.id, userId));

    const counts = await Promise.all([
      handle.db.select().from(schema.repertoire),
      handle.db.select().from(schema.repertoirePosition),
      handle.db.select().from(schema.repertoireMove),
      handle.db.select().from(schema.ideaNote),
      handle.db.select().from(schema.card),
    ]);
    expect(counts.map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0]);
  });
});
