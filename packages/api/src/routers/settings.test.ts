import { truncateAllTables, resolveTestDatabaseUrl } from "@b2c-template/auth/testing";
import { user } from "@b2c-template/db/schema/auth";
import { userSettings } from "@b2c-template/db/schema/settings";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Context } from "../context";
import { settingsRouter } from "./settings";

const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "settings router");

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ORPCError ? error.code : "OTHER";
  }
  return undefined;
}

describe.skipIf(!reachable)("settings router", () => {
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
    }) as unknown as Context;

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    for (const id of ["u1", "u2"]) {
      await handle.db.insert(user).values({ id, name: id, email: `${id}@example.test` });
    }
  });

  test("get lazily creates the default row", async () => {
    expect(await handle.db.select().from(userSettings)).toHaveLength(0);
    const settings = await call(settingsRouter.get, undefined, { context: context("u1") });
    expect(settings).toMatchObject({ dailyNewCardLimit: 20, timeZone: "UTC" });
    expect(settings).not.toHaveProperty("userId");
    expect(await handle.db.select().from(userSettings)).toHaveLength(1);
  });

  test("update changes only the given fields and persists them", async () => {
    await call(settingsRouter.update, { dailyNewCardLimit: 5 }, { context: context("u1") });
    const updated = await call(
      settingsRouter.update,
      { timeZone: "Europe/Madrid" },
      { context: context("u1") },
    );
    expect(updated).toMatchObject({ dailyNewCardLimit: 5, timeZone: "Europe/Madrid" });
    expect(await call(settingsRouter.get, undefined, { context: context("u1") })).toEqual(updated);
  });

  test("update never touches another user's settings", async () => {
    await call(settingsRouter.update, { dailyNewCardLimit: 7 }, { context: context("u2") });
    await call(settingsRouter.update, { dailyNewCardLimit: 3 }, { context: context("u1") });
    const other = await call(settingsRouter.get, undefined, { context: context("u2") });
    expect(other.dailyNewCardLimit).toBe(7);
  });

  test.each([[-1], [201], [1.5]])("update rejects dailyNewCardLimit %p", async (value) => {
    const code = await codeOf(
      call(settingsRouter.update, { dailyNewCardLimit: value }, { context: context("u1") }),
    );
    expect(code).toBe("BAD_REQUEST");
  });

  test("get returns the band offset, 0 by default", async () => {
    const settings = await call(settingsRouter.get, undefined, { context: context("u1") });
    expect(settings.explorerBandOffset).toBe(0);
  });

  test("update saves explorerBandOffset and leaves the other fields alone", async () => {
    await call(settingsRouter.update, { dailyNewCardLimit: 9 }, { context: context("u1") });
    for (const value of [-2, 2, 0]) {
      const result = await call(
        settingsRouter.update,
        { explorerBandOffset: value },
        { context: context("u1") },
      );
      expect(result).toMatchObject({ explorerBandOffset: value, dailyNewCardLimit: 9 });
    }
    await call(settingsRouter.update, { explorerBandOffset: 1 }, { context: context("u1") });
    await call(settingsRouter.update, { timeZone: "Europe/Madrid" }, { context: context("u1") });
    const settings = await call(settingsRouter.get, undefined, { context: context("u1") });
    expect(settings).toMatchObject({ explorerBandOffset: 1, dailyNewCardLimit: 9 });
  });

  test.each([[3], [-3], [1.5]])("update rejects explorerBandOffset %p", async (value) => {
    const code = await codeOf(
      call(settingsRouter.update, { explorerBandOffset: value }, { context: context("u1") }),
    );
    expect(code).toBe("BAD_REQUEST");
  });

  test("update accepts the limit bounds 0 and 200", async () => {
    for (const value of [0, 200]) {
      const result = await call(
        settingsRouter.update,
        { dailyNewCardLimit: value },
        { context: context("u1") },
      );
      expect(result.dailyNewCardLimit).toBe(value);
    }
  });

  test.each([["Mars/Olympus"], [""], ["not a zone"], ["x".repeat(100)]])(
    "update rejects the invalid time zone %p",
    async (timeZone) => {
      const code = await codeOf(
        call(settingsRouter.update, { timeZone }, { context: context("u1") }),
      );
      expect(code).toBe("BAD_REQUEST");
    },
  );

  test("update accepts IANA zones including UTC", async () => {
    for (const timeZone of ["UTC", "America/New_York", "Asia/Kolkata"]) {
      const result = await call(settingsRouter.update, { timeZone }, { context: context("u1") });
      expect(result.timeZone).toBe(timeZone);
    }
  });

  test("unauthenticated callers are rejected", async () => {
    expect(await codeOf(call(settingsRouter.get, undefined, { context: context(null) }))).toBe(
      "UNAUTHORIZED",
    );
    expect(
      await codeOf(
        call(settingsRouter.update, { dailyNewCardLimit: 1 }, { context: context(null) }),
      ),
    ).toBe("UNAUTHORIZED");
  });
});
