import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { parseFeatureFlags } from "../features";
import { blindfoldRouter } from "./blindfold";

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
      drill: "square_colour" | "coordinates" | "diagonals" | "knight_distance";
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
    ]);
    expect(result.every((entry) => entry.sessions === 0 && entry.bestAccuracy === null)).toBe(true);
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
  });

  test("a user never sees another user's sessions", async () => {
    await record(session({ correct: 20 }), "u1");
    const other = await stats("u2");
    expect(other.every((entry) => entry.sessions === 0 && entry.bestAccuracy === null)).toBe(true);
    expect(other.every((entry) => entry.recent.length === 0)).toBe(true);
  });
});
