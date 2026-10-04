import * as schema from "@b2c-template/db/schema";
import { auditLog } from "@b2c-template/db/schema/audit";
import {
  createTestDatabase,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
} from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq as isEqual, sql } from "drizzle-orm";

import { truncateAllTables } from "../testing";
import type { ListFilter, ListQueryInput } from "@b2c-template/db/lib/list-query";
import { listPlatformAuditLog, listUserAuditLog } from "./queries";

/**
 * Integration tests for the audit-log read path against a real Postgres database: the platform
 * listing only ever returns `platform` rows, the user listing only one person's `user` rows (never
 * widened by client filters, whatever the join operator); both sort and paginate a parsed list
 * input into `{ rows, total }`. Skips cleanly locally (fails loudly in CI) when no test database
 * is reachable.
 */

const DEFAULT_SORT = [{ id: "createdAt", desc: true }];

/** A parsed list input (what `createListInput` yields), with the audit defaults. */
function listInput(overrides: Partial<ListQueryInput> = {}): ListQueryInput {
  return {
    page: 1,
    perPage: 20,
    sort: DEFAULT_SORT,
    filters: [],
    joinOperator: "and",
    ...overrides,
  };
}

function filter(
  id: string,
  variant: ListFilter["variant"],
  operator: ListFilter["operator"],
  value: string | string[],
): ListFilter {
  return { id, variant, operator, value };
}

/** Local-midnight epoch ms string of a calendar day, as the date filter sends it. */
const dayEpoch = (year: number, month: number, day: number) =>
  String(new Date(year, month, day).getTime());
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "audit log read path");

describe.skipIf(!reachable)("audit log read path", () => {
  let handle: TestDatabaseHandle;
  let userId: string;
  let otherUserId: string;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
    userId = crypto.randomUUID();
    otherUserId = crypto.randomUUID();
    await handle.db.insert(schema.user).values([
      { id: userId, name: "Actor", email: `${userId}@example.com`, emailVerified: true },
      {
        id: otherUserId,
        name: "Other Actor",
        email: `${otherUserId}@example.com`,
        emailVerified: true,
      },
    ]);
  });

  /** Inserts a platform row directly (bypasses `AuditLogger`, which isn't under test here). */
  async function insertRow(overrides: Partial<typeof auditLog.$inferInsert> = {}) {
    await handle.db.insert(auditLog).values({
      scope: "platform",
      actorUserId: userId,
      action: "user.banned",
      targetType: "user",
      targetId: otherUserId,
      ...overrides,
    });
  }

  describe("database timezone", () => {
    test("the session timezone is UTC, so timestamp (no tz) day windows hold", async () => {
      const result = await handle.db.execute(sql`select current_setting('TimeZone') as tz`);
      const row = (result.rows as { tz: string }[])[0];
      expect(["UTC", "Etc/UTC"]).toContain(row?.tz as string);
    });
  });

  describe("listPlatformAuditLog", () => {
    const list = (input: Partial<ListQueryInput> = {}) =>
      listPlatformAuditLog(handle.db, listInput(input));

    test("returns platform entries newest first with the total, never user-scope rows", async () => {
      await insertRow({ action: "user.banned", createdAt: new Date(2026, 0, 1) });
      await insertRow({ action: "user.unbanned", createdAt: new Date(2026, 0, 3) });
      await insertRow({
        scope: "user",
        action: "user.password_changed",
        targetId: userId,
        createdAt: new Date(2026, 0, 4),
      });

      const page = await list();

      expect(page.rows.map((row) => row.action)).toEqual(["user.unbanned", "user.banned"]);
      expect(page.total).toBe(2);
    });

    test("never leaks user-scope rows, even with an `or` join that matches them", async () => {
      await insertRow({ action: "user.banned", actorUserId: userId });
      await insertRow({
        scope: "user",
        action: "user.password_changed",
        actorUserId: otherUserId,
        targetId: otherUserId,
      });

      const page = await list({
        joinOperator: "or",
        filters: [
          filter("action", "select", "eq", "user.password_changed"),
          filter("actor", "select", "eq", otherUserId),
        ],
      });

      expect(page.rows).toHaveLength(0);
      expect(page.total).toBe(0);
    });

    test("filters by action, actor, target type and date range", async () => {
      await insertRow({
        action: "user.banned",
        actorUserId: userId,
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        action: "user.unbanned",
        actorUserId: otherUserId,
        createdAt: new Date(2026, 0, 2, 13),
      });
      await insertRow({
        action: "user.impersonation_started",
        actorUserId: userId,
        targetType: "session",
        createdAt: new Date(2026, 0, 3),
      });

      const byAction = await list({
        filters: [filter("action", "select", "eq", "user.impersonation_started")],
      });
      expect(byAction.rows).toHaveLength(1);

      const byActor = await list({ filters: [filter("actor", "select", "eq", otherUserId)] });
      expect(byActor.rows.map((row) => row.actorUserId)).toEqual([otherUserId]);

      const byTarget = await list({ filters: [filter("targetType", "text", "iLike", "USE")] });
      expect(byTarget.rows.map((row) => row.action)).toEqual(
        expect.arrayContaining(["user.banned", "user.unbanned"]),
      );
      expect(byTarget.total).toBe(2);

      const bySession = await list({ filters: [filter("targetType", "text", "iLike", "SESS")] });
      expect(bySession.rows.map((row) => row.action)).toEqual(["user.impersonation_started"]);

      const byDay = await list({
        filters: [filter("createdAt", "date", "eq", dayEpoch(2026, 0, 2))],
      });
      expect(byDay.rows.map((row) => row.actorUserId)).toEqual([otherUserId]);

      const byRange = await list({
        filters: [
          filter("createdAt", "date", "isBetween", [dayEpoch(2026, 0, 2), dayEpoch(2026, 0, 3)]),
        ],
      });
      expect(byRange.rows).toHaveLength(2);
    });

    test("a day filter is the half-open window [local midnight, +24h): its last millisecond is in, the next midnight is out", async () => {
      await insertRow({ createdAt: new Date(2026, 0, 2, 0, 0, 0, 0) });
      await insertRow({ createdAt: new Date(2026, 0, 2, 23, 59, 59, 999) });
      await insertRow({ createdAt: new Date(2026, 0, 3) });
      await insertRow({ createdAt: new Date(2026, 0, 1, 23, 59, 59, 999) });

      const eq = await list({ filters: [filter("createdAt", "date", "eq", dayEpoch(2026, 0, 2))] });
      expect(eq.total).toBe(2);

      const range = await list({
        filters: [
          filter("createdAt", "date", "isBetween", [dayEpoch(2026, 0, 2), dayEpoch(2026, 0, 3)]),
        ],
      });
      // `to` is a whole day: [Jan 2 00:00, Jan 4 00:00) holds the Jan 2 pair and the Jan 3 midnight row.
      expect(range.total).toBe(3);

      const before = await list({
        filters: [filter("createdAt", "date", "lt", dayEpoch(2026, 0, 2))],
      });
      expect(before.total).toBe(1);
    });

    test("sorts by several columns", async () => {
      await insertRow({ action: "user.unbanned", createdAt: new Date(2026, 0, 1) });
      await insertRow({ action: "user.banned", createdAt: new Date(2026, 0, 2) });
      await insertRow({ action: "user.banned", createdAt: new Date(2026, 0, 3) });

      const page = await list({
        sort: [
          { id: "action", desc: false },
          { id: "createdAt", desc: true },
        ],
      });
      expect(page.rows.map((row) => [row.action, row.createdAt.getDate()])).toEqual([
        ["user.banned", 3],
        ["user.banned", 2],
        ["user.unbanned", 1],
      ]);
    });

    test("paginates by page and perPage and reports the total past the page", async () => {
      for (let i = 0; i < 5; i++) {
        await insertRow({ createdAt: new Date(2026, 0, i + 1) });
      }

      const firstPage = await list({ perPage: 2 });
      expect(firstPage.rows).toHaveLength(2);
      expect(firstPage.total).toBe(5);

      const lastPage = await list({ perPage: 2, page: 3 });
      expect(lastPage.rows).toHaveLength(1);
      expect(lastPage.total).toBe(5);

      const beyond = await list({ perPage: 2, page: 9 });
      expect(beyond.rows).toHaveLength(0);
      expect(beyond.total).toBe(5);
    });

    test("tie-breaks identical createdAt timestamps by id, so a page boundary has no duplicates or gaps", async () => {
      const tiedCreatedAt = new Date(2026, 0, 5);
      const ids = ["row-a", "row-b", "row-c", "row-d"];
      for (const id of ids) {
        await insertRow({ id, createdAt: tiedCreatedAt });
      }

      const firstPage = await list({ perPage: 2 });
      const secondPage = await list({ perPage: 2, page: 2 });

      const seenIds = [...firstPage.rows, ...secondPage.rows].map((row) => row.id);
      expect(new Set(seenIds).size).toBe(4); // no duplicates
      // `createdAt` ties are broken by `id` ascending, so the split is exact and reproducible.
      expect(seenIds).toEqual(["row-a", "row-b", "row-c", "row-d"]);
    });

    test("an unknown column id throws instead of reaching SQL", async () => {
      await expect(
        list({ filters: [filter("passwordHash", "text", "eq", "x")] }),
      ).rejects.toThrow();
    });
  });

  describe("listUserAuditLog", () => {
    const list = (id: string, input: Partial<ListQueryInput> = {}) =>
      listUserAuditLog(handle.db, { userId: id, input: listInput(input) });

    test("returns only that user's user-scope rows, newest first", async () => {
      await insertRow({
        scope: "user",
        action: "user.password_changed",
        actorUserId: userId,
        targetId: userId,
        createdAt: new Date(2026, 0, 1),
      });
      await insertRow({
        scope: "user",
        action: "user.session_revoked",
        actorUserId: userId,
        targetId: userId,
        createdAt: new Date(2026, 0, 2),
      });
      await insertRow({
        scope: "user",
        action: "user.password_changed",
        actorUserId: otherUserId,
        targetId: otherUserId,
      });
      await insertRow({ scope: "platform", action: "user.banned", targetId: userId });

      const page = await list(userId);

      expect(page.rows.map((row) => row.action)).toEqual([
        "user.session_revoked",
        "user.password_changed",
      ]);
      expect(page.total).toBe(2);
    });

    test("stays readable after the actor is deleted (matched on target id)", async () => {
      await insertRow({
        scope: "user",
        action: "user.deleted",
        actorUserId: userId,
        targetId: userId,
      });
      await handle.db.delete(schema.user).where(isEqual(schema.user.id, userId));

      const page = await list(userId);

      expect(page.total).toBe(1);
      expect(page.rows[0]?.actorUserId).toBeNull();
    });
  });
});
