import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { createTestDatabase, requireTestDatabaseOrSkip, resolveTestDatabaseUrl } from "../testing";
import type { TestDatabaseHandle } from "../testing";
import * as schema from "./index";

/** Integration tests for the blindfold `drill_session` table: CHECK constraints and the cascade. */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "drill_session schema");

/** Drizzle query builders are thenables, not promises; `rejects` needs a real promise. */
async function run(query: () => PromiseLike<unknown>) {
  await query();
}

describe("DRILL_KINDS", () => {
  test("lists the eight blindfold drills", () => {
    expect([...schema.DRILL_KINDS]).toEqual([
      "square_colour",
      "coordinates",
      "diagonals",
      "knight_distance",
      "same_diagonal",
      "check_detection",
      "position_recall",
      "mate_in_one",
    ]);
  });
});

describe.skipIf(!reachable)("drill_session schema", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await handle.db.delete(schema.user);
    await handle.db.insert(schema.user).values({ id: "u1", name: "u1", email: "u1@example.test" });
  });

  const valid = {
    userId: "u1",
    drill: "square_colour",
    level: 1,
    correct: 18,
    total: 20,
    durationMs: 45_000,
  } as const;

  test("inserts a valid session with defaults", async () => {
    const [row] = await handle.db.insert(schema.drillSession).values(valid).returning();
    expect(row!.id).toBeString();
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.correct).toBe(18);
  });

  test.each(schema.DRILL_KINDS.map((drill) => [drill]))("accepts the %s drill", async (drill) => {
    const [row] = await handle.db
      .insert(schema.drillSession)
      .values({ ...valid, drill })
      .returning();
    expect(row!.drill).toBe(drill);
  });

  test("rejects an unknown drill kind", async () => {
    await expect(
      run(() =>
        handle.db.insert(schema.drillSession).values({ ...valid, drill: "nope" as "diagonals" }),
      ),
    ).rejects.toThrow();
  });

  test.each([
    ["level below 1", { level: 0 }],
    ["correct above total", { correct: 21 }],
    ["negative correct", { correct: -1 }],
    ["zero total", { total: 0, correct: 0 }],
    ["negative duration", { durationMs: -1 }],
  ])("rejects %s", async (_name, patch) => {
    await expect(
      run(() => handle.db.insert(schema.drillSession).values({ ...valid, ...patch })),
    ).rejects.toThrow();
  });

  test("deleting the user cascades to their sessions", async () => {
    await handle.db.insert(schema.drillSession).values(valid);
    await handle.db.delete(schema.user).where(eq(schema.user.id, "u1"));
    expect(await handle.db.select().from(schema.drillSession)).toHaveLength(0);
  });
});
