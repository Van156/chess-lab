import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { card, reviewLog } from "@b2c-template/db/schema/cards";
import { game, mistake } from "@b2c-template/db/schema/games";
import { userSettings } from "@b2c-template/db/schema/settings";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { newCardState } from "@b2c-template/study";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context, ImportStatus } from "../context";
import { parseFeatureFlags } from "../features";
import { computeStreak } from "../services/today-service";
import { todayRouter } from "./today";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "today router");

const DAY = 86_400_000;
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const idleStatus: ImportStatus = {
  state: "idle",
  lastSyncedAt: new Date("2026-01-01T00:00:00Z"),
  retryAt: null,
  gamesImported: 12,
};

describe("computeStreak", () => {
  test("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-03-10", "2026-03-09", "2026-03-08"], "2026-03-10")).toEqual({
      days: 3,
      reviewedToday: true,
    });
  });

  test("a streak ending yesterday is still alive but extendable today", () => {
    expect(computeStreak(["2026-03-09", "2026-03-08"], "2026-03-10")).toEqual({
      days: 2,
      reviewedToday: false,
    });
  });

  test("a gap breaks the streak", () => {
    expect(computeStreak(["2026-03-08", "2026-03-07"], "2026-03-10")).toEqual({
      days: 0,
      reviewedToday: false,
    });
    expect(computeStreak(["2026-03-10", "2026-03-08"], "2026-03-10").days).toBe(1);
  });

  test("handles month and year boundaries", () => {
    expect(computeStreak(["2026-01-01", "2025-12-31", "2025-12-30"], "2026-01-01").days).toBe(3);
  });

  test("no reviews is zero", () => {
    expect(computeStreak([], "2026-03-10")).toEqual({ days: 0, reviewedToday: false });
  });
});

describe.skipIf(!reachable)("today router", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  const context = (userId: string | null, over: Partial<Context> = {}): Context =>
    ({
      session: userId ? { user: { id: userId } } : null,
      db: handle.db,
      features: parseFeatureFlags({}),
      lichess: { status: async () => idleStatus },
      ...over,
    }) as unknown as Context;

  async function seedCard(
    userId: string,
    id: string,
    over: { state?: number; due?: Date } = {},
  ): Promise<void> {
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
        fenBefore: FEN,
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
    await handle.db.insert(card).values({
      id,
      userId,
      mistakeId: m!.id,
      due: over.due ?? s.due,
      state: over.state ?? 0,
    });
  }

  async function seedReview(userId: string, cardId: string, at: Date, stateBefore = 2) {
    const s = newCardState(at);
    const state = JSON.parse(JSON.stringify({ ...s, state: stateBefore }));
    await handle.db.insert(reviewLog).values({
      id: crypto.randomUUID(),
      userId,
      cardId,
      grade: 3,
      reviewedAt: at,
      elapsedMs: 1000,
      stateBefore: state,
      stateAfter: state,
    });
  }

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  test("returns zeros for a user with nothing yet, plus the sync status", async () => {
    const summary = await call(todayRouter.summary, undefined, { context: context("u1") });
    expect(summary).toEqual({
      due: { mistakes: 0 },
      dueTotal: 0,
      newBudgetLeft: 20,
      streak: { days: 0, reviewedToday: false },
      sync: idleStatus,
    });
  });

  test("counts due cards of the session user only (new cards are not due)", async () => {
    const past = new Date(Date.now() - DAY);
    await seedCard("u1", "c1", { state: 2, due: past });
    await seedCard("u1", "c2", { state: 3, due: past });
    await seedCard("u1", "c3", { state: 2, due: new Date(Date.now() + 5 * DAY) });
    await seedCard("u1", "c4", { state: 0 });
    await seedCard("u2", "c5", { state: 2, due: past });
    const summary = await call(todayRouter.summary, undefined, { context: context("u1") });
    expect(summary.due).toEqual({ mistakes: 2 });
    expect(summary.dueTotal).toBe(2);
  });

  test("excludes pillars whose flag is off", async () => {
    await seedCard("u1", "c1", { state: 2, due: new Date(Date.now() - DAY) });
    const features = parseFeatureFlags({ CHESSLAB_FEATURES: "blindfold" });
    const summary = await call(todayRouter.summary, undefined, {
      context: context("u1", { features }),
    });
    expect(summary.due).toEqual({});
    expect(summary.dueTotal).toBe(0);
  });

  test("new budget shrinks by the new cards introduced today", async () => {
    await handle.db.insert(userSettings).values({ userId: "u1", dailyNewCardLimit: 5 });
    await seedCard("u1", "c1", { state: 2 });
    await seedReview("u1", "c1", new Date(), 0);
    await seedReview("u1", "c1", new Date(), 0);
    await seedReview("u1", "c1", new Date(), 2);
    await seedCard("u2", "c9", { state: 2 });
    await seedReview("u2", "c9", new Date(), 0);
    const summary = await call(todayRouter.summary, undefined, { context: context("u1") });
    expect(summary.newBudgetLeft).toBe(3);
  });

  test("streak counts review days in the user's time zone", async () => {
    await handle.db.insert(userSettings).values({ userId: "u1", timeZone: "UTC" });
    await seedCard("u1", "c1", { state: 2 });
    await seedReview("u1", "c1", new Date());
    await seedReview("u1", "c1", new Date(Date.now() - DAY));
    await seedReview("u1", "c1", new Date(Date.now() - 2 * DAY));
    await seedReview("u1", "c1", new Date(Date.now() - 4 * DAY));
    await seedCard("u2", "c9", { state: 2 });
    await seedReview("u2", "c9", new Date(Date.now() - 3 * DAY));
    const summary = await call(todayRouter.summary, undefined, { context: context("u1") });
    expect(summary.streak).toEqual({ days: 3, reviewedToday: true });
  });

  test("reports the sync status without triggering a sync", async () => {
    let requested = 0;
    const lichess = {
      status: async () => ({ ...idleStatus, state: "running" as const, gamesImported: 0 }),
      requestSync: async () => {
        requested += 1;
        return idleStatus;
      },
    };
    const summary = await call(todayRouter.summary, undefined, {
      context: context("u1", { lichess } as unknown as Partial<Context>),
    });
    expect(summary.sync.state).toBe("running");
    expect(requested).toBe(0);
  });

  test("unauthenticated callers are rejected", async () => {
    let code: string | undefined;
    try {
      await call(todayRouter.summary, undefined, { context: context(null) });
    } catch (error) {
      code = error instanceof ORPCError ? error.code : "OTHER";
    }
    expect(code).toBe("UNAUTHORIZED");
  });
});
