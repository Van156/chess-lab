import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, mistake } from "@b2c-template/db/schema/games";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { newCardState } from "@b2c-template/study";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { reviewRouter } from "./review";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "review router");

const validGrade = () => ({
  reviewLogId: crypto.randomUUID(),
  cardId: "card-1",
  grade: 3,
  reviewedAt: new Date().toISOString(),
  elapsedMs: 3000,
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("review router", () => {
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

  async function seedCard(userId: string, id: string) {
    const [g] = await handle.db
      .insert(game)
      .values({
        userId,
        lichessGameId: `${id}-g`,
        pgn: "1. e4 e5 *",
        userColor: "white",
        speed: "blitz",
        rated: true,
        result: "*",
        playedAt: new Date(),
      })
      .returning();
    const [m] = await handle.db
      .insert(mistake)
      .values({
        userId,
        gameId: g!.id,
        ply: 1,
        fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        positionKey: id,
        playedSan: "a3",
        playedUci: "a2a3",
        bestSan: "e4",
        bestUci: "e2e4",
        evalBeforeCp: 0,
        evalAfterCp: -100,
        evalLossCp: 100,
        severity: "mistake",
        phase: "opening",
      })
      .returning();
    const s = newCardState(new Date());
    await handle.db.insert(card).values({ id, userId, mistakeId: m!.id, due: s.due });
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  describe("input validation", () => {
    test.each([
      ["a non-uuid reviewLogId", { reviewLogId: "abc" }],
      ["grade 0", { grade: 0 }],
      ["grade 5", { grade: 5 }],
      ["a fractional grade", { grade: 2.5 }],
      ["negative elapsedMs", { elapsedMs: -1 }],
      ["elapsedMs over one hour", { elapsedMs: 3_600_001 }],
      ["a non-ISO reviewedAt", { reviewedAt: "yesterday" }],
      ["an empty cardId", { cardId: "" }],
    ])("grade rejects %s", async (_name, over) => {
      const code = await codeOf(
        call(reviewRouter.grade, { ...validGrade(), ...over } as never, { context: context("u1") }),
      );
      expect(code).toBe("BAD_REQUEST");
    });

    test.each([[0], [-1], [201], [1.5]])("queue rejects limit %p", async (limit) => {
      const code = await codeOf(
        call(reviewRouter.queue, { limit } as never, { context: context("u1") }),
      );
      expect(code).toBe("BAD_REQUEST");
    });
  });

  test("queue defaults the limit and returns hydrated items for the session user", async () => {
    await seedCard("u1", "card-1");
    await seedCard("u2", "card-2");
    const items = await call(reviewRouter.queue, undefined, { context: context("u1") });
    expect(items.map((i) => i.cardId)).toEqual(["card-1"]);
    expect(items[0]?.prompt.orientation).toBe("white");
  });

  test("queue excludes pillars whose flag is off", async () => {
    await seedCard("u1", "card-1");
    const features = parseFeatureFlags({ CHESSLAB_FEATURES: "blindfold" });
    const items = await call(reviewRouter.queue, undefined, { context: context("u1", features) });
    expect(items).toEqual([]);
  });

  test("grade applies once and replays idempotently", async () => {
    await seedCard("u1", "card-1");
    const input = validGrade();
    const first = await call(reviewRouter.grade, input as never, { context: context("u1") });
    const second = await call(reviewRouter.grade, input as never, { context: context("u1") });
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ ...first, replayed: true });
    expect(await handle.db.select().from(reviewLog)).toHaveLength(1);
  });

  test("grading a foreign card is NOT_FOUND", async () => {
    await seedCard("u2", "card-1");
    const code = await codeOf(
      call(reviewRouter.grade, validGrade() as never, { context: context("u1") }),
    );
    expect(code).toBe("NOT_FOUND");
  });

  test("unauthenticated callers are rejected", async () => {
    expect(await codeOf(call(reviewRouter.queue, undefined, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
    expect(
      await codeOf(call(reviewRouter.grade, validGrade() as never, { context: context(null) })),
    ).toBe("UNAUTHORIZED");
  });
});
