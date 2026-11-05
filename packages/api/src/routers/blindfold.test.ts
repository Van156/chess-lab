import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { drillSession } from "@b2c-template/db/schema/drills";
import type { DrillKind } from "@b2c-template/db/schema/drills";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { blindfoldRouter, createBlindfoldRouter } from "./blindfold";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "blindfold router");

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("blindfold router", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });
  afterAll(async () => {
    await handle.close();
  });

  const as = (userId: string, flags = "blindfold"): Context =>
    ({
      session: { user: { id: userId } },
      db: handle.db,
      features: parseFeatureFlags({ CHESSLAB_FEATURES: flags }),
    }) as unknown as Context;

  const session = (over: Partial<Parameters<typeof record>[0]> = {}) => ({
    drill: "square_colour" as const,
    level: 1,
    correct: 15,
    total: 20,
    durationMs: 40_000,
    ...over,
  });

  const record = (
    input: {
      drill: DrillKind;
      level: number;
      correct: number;
      total: number;
      durationMs: number;
    },
    userId = "u1",
  ) => call(blindfoldRouter.recordSession, input, { context: as(userId) });

  const stats = (userId = "u1") => call(blindfoldRouter.stats, undefined, { context: as(userId) });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    await handle.db.insert(user).values([
      { id: "u1", name: "u1", email: "u1@example.test" },
      { id: "u2", name: "u2", email: "u2@example.test" },
    ]);
  });

  test("recordSession returns the stored row", async () => {
    const row = await record(session());
    expect(row).toMatchObject({ userId: "u1", drill: "square_colour", correct: 15, total: 20 });
    expect(row.id).toBeString();
  });

  test("stats lists every drill; empty ones have no best accuracy", async () => {
    const result = await stats();
    expect(result.map((entry) => entry.drill)).toEqual([
      "square_colour",
      "coordinates",
      "diagonals",
      "knight_distance",
      "same_diagonal",
      "check_detection",
      "position_recall",
      "mate_in_one",
    ]);
    expect(result.every((entry) => entry.sessions === 0 && entry.bestAccuracy === null)).toBe(true);
    expect(result.every((entry) => entry.lastPlayedAt === null)).toBe(true);
    expect(result.every((entry) => entry.recent.length === 0)).toBe(true);
  });

  test("stats reports sessions, best accuracy and newest-first recent sessions", async () => {
    await record(session({ correct: 10 }));
    await record(session({ correct: 19 }));
    await record(session({ correct: 12 }));
    await record(session({ drill: "coordinates", correct: 5 }));

    const result = await stats();
    const colour = result.find((entry) => entry.drill === "square_colour")!;
    expect(colour.sessions).toBe(3);
    expect(colour.bestAccuracy).toBeCloseTo(19 / 20);
    expect(colour.recent.map((row) => row.correct)).toEqual([12, 19, 10]);
    expect(result.find((entry) => entry.drill === "coordinates")!.sessions).toBe(1);
  });

  test("recent is capped at the last 10 sessions", async () => {
    for (let index = 0; index < 12; index += 1) {
      await record(session({ correct: index }));
    }
    const colour = (await stats()).find((entry) => entry.drill === "square_colour")!;
    expect(colour.sessions).toBe(12);
    expect(colour.recent).toHaveLength(10);
    expect(colour.recent[0]!.correct).toBe(11);
  });

  test("rejects correct above total and invalid values", async () => {
    expect(await codeOf(record(session({ correct: 21 })))).toBe("BAD_REQUEST");
    expect(await codeOf(record(session({ total: 0, correct: 0 })))).toBe("BAD_REQUEST");
    expect(await codeOf(record(session({ level: 0 })))).toBe("BAD_REQUEST");
    expect(await codeOf(record(session({ durationMs: -1 })))).toBe("BAD_REQUEST");
    expect(await codeOf(record(session({ drill: "nope" as "diagonals" })))).toBe("BAD_REQUEST");
  });

  test("every procedure is NOT_FOUND with the blindfold flag off", async () => {
    const off = { context: as("u1", "") };
    expect(await codeOf(call(blindfoldRouter.recordSession, session(), off))).toBe("NOT_FOUND");
    expect(await codeOf(call(blindfoldRouter.stats, undefined, off))).toBe("NOT_FOUND");
    expect(await codeOf(call(blindfoldRouter.summary, undefined, off))).toBe("NOT_FOUND");
  });

  test("a user never sees another user's sessions", async () => {
    await record(session({ correct: 20 }), "u1");
    const other = await stats("u2");
    expect(other.every((entry) => entry.sessions === 0 && entry.bestAccuracy === null)).toBe(true);
    expect(other.every((entry) => entry.recent.length === 0)).toBe(true);
    expect(other.every((entry) => entry.lastPlayedAt === null)).toBe(true);
  });

  /** Inserts a session with an explicit `createdAt` (recordSession always stamps "now"). */
  const seed = (
    createdAt: string,
    over: Partial<typeof drillSession.$inferInsert> = {},
    userId = "u1",
  ) =>
    handle.db
      .insert(drillSession)
      .values({ ...session(), userId, createdAt: new Date(createdAt), ...over });

  test("stats reports each drill's newest createdAt as lastPlayedAt", async () => {
    await seed("2026-11-01T10:00:00Z");
    await seed("2026-11-03T08:30:00Z");
    await seed("2026-11-02T23:59:00Z");
    await seed("2026-10-20T12:00:00Z", { drill: "mate_in_one" });
    await seed("2026-11-04T12:00:00Z", { drill: "mate_in_one" }, "u2");

    const result = await stats();
    const lastPlayed = (drill: DrillKind) =>
      result.find((entry) => entry.drill === drill)!.lastPlayedAt;
    expect(lastPlayed("square_colour")).toEqual(new Date("2026-11-03T08:30:00Z"));
    expect(lastPlayed("mate_in_one")).toEqual(new Date("2026-10-20T12:00:00Z"));
    expect(lastPlayed("coordinates")).toBeNull();
  });

  describe("summary", () => {
    const NOW = new Date("2026-11-05T09:00:00Z");
    const summary = (userId = "u1", now = NOW) =>
      call(createBlindfoldRouter({ now: () => now }).summary, undefined, {
        context: as(userId),
      });

    test("is all zeros with no sessions", async () => {
      expect(await summary()).toEqual({
        totalSessions: 0,
        totalDurationMs: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        currentStreakDays: 0,
        practiceDays: [],
      });
    });

    test("totals sessions, time, questions and correct answers across drills", async () => {
      await seed("2026-11-05T08:00:00Z", { correct: 15, total: 20, durationMs: 40_000 });
      await seed("2026-11-04T08:00:00Z", {
        drill: "check_detection",
        correct: 7,
        total: 10,
        durationMs: 25_500,
      });
      await seed("2026-01-01T08:00:00Z", { correct: 1, total: 1, durationMs: 1_000 });

      expect(await summary()).toMatchObject({
        totalSessions: 3,
        totalDurationMs: 66_500,
        totalQuestions: 31,
        totalCorrect: 23,
      });
    });

    test("practiceDays counts sessions per UTC day in the last 28 days, oldest first", async () => {
      // 2026-10-09 is 27 days before 2026-11-05, so it is the first day in the window.
      await seed("2026-10-08T23:59:59Z");
      await seed("2026-10-09T00:00:00Z");
      await seed("2026-11-03T23:30:00Z");
      await seed("2026-11-04T00:10:00Z", { drill: "coordinates" });
      await seed("2026-11-04T22:00:00Z");
      await seed("2026-11-05T08:59:00Z");

      expect((await summary()).practiceDays).toEqual([
        { day: "2026-10-09", sessions: 1 },
        { day: "2026-11-03", sessions: 1 },
        { day: "2026-11-04", sessions: 2 },
        { day: "2026-11-05", sessions: 1 },
      ]);
    });

    test("the streak counts consecutive days ending today", async () => {
      await seed("2026-11-05T01:00:00Z");
      await seed("2026-11-04T12:00:00Z");
      await seed("2026-11-03T12:00:00Z");
      await seed("2026-11-01T12:00:00Z");
      expect((await summary()).currentStreakDays).toBe(3);
    });

    test("the streak survives until the end of the day after the last session", async () => {
      await seed("2026-11-04T23:00:00Z");
      await seed("2026-11-03T00:30:00Z");
      expect((await summary()).currentStreakDays).toBe(2);
      expect((await summary("u1", new Date("2026-11-05T23:59:59Z"))).currentStreakDays).toBe(2);
      expect((await summary("u1", new Date("2026-11-06T00:00:00Z"))).currentStreakDays).toBe(0);
    });

    test("the streak can run longer than the 28-day window", async () => {
      for (let offset = 0; offset < 40; offset += 1) {
        const day = new Date(NOW.getTime() - offset * 86_400_000);
        await seed(day.toISOString());
      }
      const result = await summary();
      expect(result.currentStreakDays).toBe(40);
      expect(result.practiceDays).toHaveLength(28);
    });

    test("only counts the caller's sessions", async () => {
      await seed("2026-11-05T08:00:00Z", {}, "u2");
      await seed("2026-11-04T08:00:00Z", {}, "u2");
      await seed("2026-10-30T08:00:00Z", { correct: 3, total: 4, durationMs: 9_000 });

      expect(await summary()).toEqual({
        totalSessions: 1,
        totalDurationMs: 9_000,
        totalQuestions: 4,
        totalCorrect: 3,
        currentStreakDays: 0,
        practiceDays: [{ day: "2026-10-30", sessions: 1 }],
      });
      expect((await summary("u2")).currentStreakDays).toBe(2);
    });

    test("the default router uses the real clock", async () => {
      await record(session());
      const result = await call(blindfoldRouter.summary, undefined, { context: as("u1") });
      expect(result.totalSessions).toBe(1);
      expect(result.currentStreakDays).toBe(1);
      expect(result.practiceDays).toEqual([
        { day: new Date().toISOString().slice(0, 10), sessions: 1 },
      ]);
    });
  });
});
