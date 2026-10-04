import * as schema from "@b2c-template/db/schema";
import {
  createTestDatabase,
  requireTestDatabaseOrSkip,
  resolveTestDatabaseUrl,
} from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { ListFilter, ListQueryInput } from "@b2c-template/db/lib/list-query";

import { listPlatformUsers } from "./platform";
import { truncateAllTables } from "./testing";

/**
/**
 * Integration tests for the platform-wide user listing against a real Postgres database. Skips
 * cleanly locally (fails loudly in CI) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "listPlatformUsers integration",
);

describe.skipIf(!reachable)("listPlatformUsers integration", () => {
  let handle: TestDatabaseHandle;

  beforeAll(() => {
    handle = createTestDatabase(TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    await truncateAllTables(handle.db);
  });

  const filter = (
    id: string,
    variant: ListFilter["variant"],
    operator: ListFilter["operator"],
    value: string,
  ): ListFilter => ({ id, variant, operator, value });

  const list = (input: Partial<ListQueryInput> = {}) =>
    listPlatformUsers(handle.db, {
      page: 1,
      perPage: 20,
      sort: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
      ...input,
    });

  const ids = (page: { users: { id: string }[] }) => page.users.map((row) => row.id);
  /** Ids in a stable order, for assertions that do not depend on the default sort. */
  const sortedIds = (page: { users: { id: string }[] }) => ids(page).sort();

  async function createUser(
    id: string,
    values: Partial<typeof schema.user.$inferInsert> = {},
  ): Promise<void> {
    await handle.db.insert(schema.user).values({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      ...values,
    });
  }

  test("returns every field the users table shows", async () => {
    await createUser("user-1", {
      name: "Ada",
      role: "superadmin",
      banned: true,
      banReason: "spam",
    });

    const [row] = (await list()).users;

    expect(row).toMatchObject({
      id: "user-1",
      email: "user-1@example.com",
      name: "Ada",
      emailVerified: true,
      role: "superadmin",
      banned: true,
      banReason: "spam",
      banExpires: null,
    });
    expect(row?.createdAt).toBeInstanceOf(Date);
    expect(row?.updatedAt).toBeInstanceOf(Date);
  });

  test("searches email and name case-insensitively", async () => {
    await createUser("user-ada", { name: "Ada Lovelace", email: "Ada.L@example.com" });
    await createUser("user-bob", { name: "Bob", email: "bob@example.com" });

    expect(ids(await list({ filters: [filter("email", "text", "iLike", "ADA.l")] }))).toEqual([
      "user-ada",
    ]);
    expect(ids(await list({ filters: [filter("name", "text", "iLike", "lovelace")] }))).toEqual([
      "user-ada",
    ]);
  });

  test("combines an email and a name search (no single-search limit)", async () => {
    await createUser("user-1", { name: "Ada", email: "shared-1@example.com" });
    await createUser("user-2", { name: "Bob", email: "shared-2@example.com" });

    const page = await list({
      filters: [filter("email", "text", "iLike", "shared"), filter("name", "text", "iLike", "bo")],
    });

    expect(ids(page)).toEqual(["user-2"]);
    expect(page.total).toBe(1);
  });

  test("treats %, _ and \\ in the search term as literal characters", async () => {
    await createUser("user-percent", { name: "zq%zq" });
    await createUser("user-plain", { name: "zqxzq" });
    await createUser("user-underscore", { name: "zq_zq" });
    await createUser("user-backslash", { name: "zq\\zq" });

    const searchName = async (value: string) =>
      ids(await list({ filters: [filter("name", "text", "iLike", value)] }));

    expect(await searchName("q%z")).toEqual(["user-percent"]);
    expect(await searchName("q_z")).toEqual(["user-underscore"]);
    expect(await searchName("q\\z")).toEqual(["user-backslash"]);
  });

  test("status filter: a NULL banned flag is active", async () => {
    await createUser("user-false", { banned: false });
    await createUser("user-null", { banned: null });
    await createUser("user-true", { banned: true });

    const status = (operator: ListFilter["operator"], value: string) =>
      list({ filters: [filter("status", "select", operator, value)] });

    expect(sortedIds(await status("eq", "active"))).toEqual(["user-false", "user-null"]);
    expect(ids(await status("eq", "banned"))).toEqual(["user-true"]);
    expect((await status("ne", "banned")).total).toBe(2);
    expect(ids(await status("ne", "active"))).toEqual(["user-true"]);
  });

  describe("status inArray and notInArray: a NULL banned flag is active", () => {
    const seed = async () => {
      await createUser("user-false", { banned: false });
      await createUser("user-null", { banned: null });
      await createUser("user-true", { banned: true });
    };
    const status = (operator: ListFilter["operator"], value: string[]) =>
      list({ filters: [{ id: "status", variant: "select", operator, value }] });

    test("inArray", async () => {
      await seed();

      expect(sortedIds(await status("inArray", ["banned"]))).toEqual(["user-true"]);
      expect(sortedIds(await status("inArray", ["active"]))).toEqual(["user-false", "user-null"]);
      expect((await status("inArray", ["active", "banned"])).total).toBe(3);
    });

    test("notInArray", async () => {
      await seed();

      expect((await status("notInArray", ["banned"])).total).toBe(2);
      expect(sortedIds(await status("notInArray", ["active"]))).toEqual(["user-true"]);
      expect((await status("notInArray", ["active", "banned"])).total).toBe(0);
    });

    test("an empty list: inArray matches nothing, notInArray everything", async () => {
      await seed();

      expect((await status("inArray", [])).total).toBe(0);
      expect((await status("notInArray", [])).total).toBe(3);
    });
  });

  describe("role inArray and notInArray match any entry of a comma-separated list", () => {
    const seed = async () => {
      await createUser("user-plain", { role: "user" });
      await createUser("user-super", { role: "superadmin" });
      await createUser("user-both", { role: "user,superadmin" });
      await createUser("user-none", { role: null });
    };
    const role = (operator: ListFilter["operator"], value: string[]) =>
      list({ filters: [{ id: "role", variant: "select", operator, value }] });

    test("inArray", async () => {
      await seed();

      expect(sortedIds(await role("inArray", ["superadmin"]))).toEqual(["user-both", "user-super"]);
      expect(sortedIds(await role("inArray", ["superadmin", "user"]))).toEqual([
        "user-both",
        "user-plain",
        "user-super",
      ]);
    });

    test("notInArray", async () => {
      await seed();

      expect(sortedIds(await role("notInArray", ["superadmin"]))).toEqual([
        "user-none",
        "user-plain",
      ]);
      expect(sortedIds(await role("notInArray", ["superadmin", "user"]))).toEqual(["user-none"]);
    });

    test("an empty list: inArray matches nothing, notInArray everything", async () => {
      await seed();

      expect((await role("inArray", [])).total).toBe(0);
      expect((await role("notInArray", [])).total).toBe(4);
    });
  });

  test("role isEmpty and isNotEmpty cover NULL and empty roles", async () => {
    await createUser("user-plain", { role: "user" });
    await createUser("user-blank", { role: "" });
    await createUser("user-none", { role: null });

    const role = (operator: ListFilter["operator"]) =>
      list({ filters: [{ id: "role", variant: "select", operator, value: "" }] });

    expect(sortedIds(await role("isEmpty"))).toEqual(["user-blank", "user-none"]);
    expect(ids(await role("isNotEmpty"))).toEqual(["user-plain"]);
  });

  test("role filter matches one entry of a comma-separated role list", async () => {
    await createUser("user-plain", { role: "user" });
    await createUser("user-super", { role: "superadmin" });
    await createUser("user-both", { role: "user,superadmin" });
    await createUser("user-none", { role: null });

    const role = (operator: ListFilter["operator"]) =>
      list({ filters: [filter("role", "select", operator, "superadmin")] });

    expect(sortedIds(await role("eq"))).toEqual(["user-both", "user-super"]);
    expect(sortedIds(await role("ne"))).toEqual(["user-none", "user-plain"]);
  });

  test("an or join widens across plain and derived filters", async () => {
    await createUser("user-banned", { banned: true });
    await createUser("user-named", { name: "needle" });
    await createUser("user-other");

    const page = await list({
      joinOperator: "or",
      filters: [
        filter("status", "select", "eq", "banned"),
        filter("name", "text", "iLike", "need"),
      ],
    });

    expect(sortedIds(page)).toEqual(["user-banned", "user-named"]);
    expect(page.total).toBe(2);
  });

  test("sorts by several columns; ties break by id", async () => {
    // Lowercase ASCII only, so every collation (C, glibc, ICU) orders the names alike.
    await createUser("user-3", { name: "bb", email: "x3@example.com" });
    await createUser("user-1", { name: "aa", email: "x1@example.com" });
    await createUser("user-2", { name: "bb", email: "x2@example.com" });

    const byNameThenEmailDesc = await list({
      sort: [
        { id: "name", desc: false },
        { id: "email", desc: true },
      ],
    });
    expect(ids(byNameThenEmailDesc)).toEqual(["user-1", "user-3", "user-2"]);

    // Same name and same createdAt everywhere: only the id tie-breaker orders the rows.
    const sameMoment = new Date(2026, 0, 1);
    for (const id of ["tie-b", "tie-c", "tie-a"]) {
      await createUser(id, { name: "tie", createdAt: sameMoment });
    }
    const ties = await list({
      sort: [{ id: "createdAt", desc: false }],
      filters: [filter("name", "text", "eq", "tie")],
    });
    expect(ids(ties)).toEqual(["tie-a", "tie-b", "tie-c"]);
  });

  test("paginates with an exact filtered total", async () => {
    for (let i = 0; i < 5; i++) {
      await createUser(`page-${i}`, { name: "paged", createdAt: new Date(2026, 0, i + 1) });
    }
    await createUser("other");

    const filters = [filter("name", "text", "iLike", "paged")];
    const first = await list({ filters, perPage: 2 });
    const last = await list({ filters, perPage: 2, page: 3 });

    expect(first.total).toBe(5);
    expect(ids(first)).toEqual(["page-4", "page-3"]);
    expect(ids(last)).toEqual(["page-0"]);
  });
});
