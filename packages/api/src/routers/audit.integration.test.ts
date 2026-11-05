import type { AuthConfig } from "@b2c-template/auth";
import { createAuth } from "@b2c-template/auth";
import { createDrizzleAuditLogger } from "@b2c-template/auth/audit";
import {
  cookieHeaderFromSetCookie,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  TEST_PASSWORD,
  truncateAllTables,
} from "@b2c-template/auth/testing";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { auditRouter } from "./audit";
import { parseFeatureFlags } from "../features";

/**
 * Integration tests for the audit list procedures against a real Postgres database, following
 * `authorization.integration.test.ts`'s setup (real `createAuth` +
 * `createBetterAuthAuthorization`). Skips cleanly locally (fails loudly in CI) when no test
 * database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "audit list procedures");

describe.skipIf(!reachable)("audit list procedures", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    // Real Drizzle-backed logger (not the in-memory `RecordingAuditLogger`):
    // these tests read `audit_log` back through the router, so events must
    // actually land in Postgres.
    const auditLogger = createDrizzleAuditLogger(handle.db);
    const authConfig: AuthConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
    };
    auth = createAuth(authConfig, handle.db, emailSender, auditLogger, {
      extraPlugins: [testUtils()],
    });
    const authContext = await auth.$context;
    testHelpers = (authContext as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function buildContext(headers: Headers): Promise<Context> {
    const session = await auth.api.getSession({ headers });
    return {
      db: handle.db,
      session,
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      // Unused by the router under test.
      auditLogger: {} as unknown as Context["auditLogger"],
      lichess: {} as unknown as Context["lichess"],
      features: parseFeatureFlags({}),
    };
  }

  async function superadminContext(): Promise<Context> {
    const superadminUser = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadminUser);
    const { headers } = await testHelpers.login({ userId: superadminUser.id });
    return buildContext(headers);
  }

  test("a plain user is forbidden from the platform activity log", async () => {
    const { headers } = await signUpAndVerify("audit-platform-plain@example.com", "Plain");
    const context = await buildContext(headers);

    let listError: unknown;
    try {
      await call(auditRouter.listPlatform, {}, { context });
    } catch (error) {
      listError = error;
    }
    expect(listError).toBeInstanceOf(ORPCError);
    expect((listError as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("a superadmin lists platform-admin entries, filterable by action and paginated", async () => {
    const { userId: targetUserId } = await signUpAndVerify(
      "audit-plat-target@example.com",
      "Target",
    );
    const superContext = await superadminContext();
    await auth.api.banUser({
      body: { userId: targetUserId, banReason: "test" },
      headers: superContext.headers,
    });
    await auth.api.unbanUser({ body: { userId: targetUserId }, headers: superContext.headers });

    const allEntries = await call(
      auditRouter.listPlatform,
      { perPage: 100 },
      { context: superContext },
    );
    expect(allEntries.rows.map((entry) => entry.action)).toEqual(["user.unbanned", "user.banned"]);
    expect(allEntries.rows.every((entry) => entry.scope === "platform")).toBe(true);

    const banned = await call(
      auditRouter.listPlatform,
      { filters: [{ id: "action", variant: "select", operator: "eq", value: "user.banned" }] },
      { context: superContext },
    );
    expect(banned.rows.map((entry) => entry.action)).toEqual(["user.banned"]);

    const firstPage = await call(
      auditRouter.listPlatform,
      { perPage: 1 },
      { context: superContext },
    );
    expect(firstPage.rows).toHaveLength(1);
    expect(firstPage.total).toBe(2);

    // Ids and values outside the allowlist are 400s, not database errors.
    for (const input of [
      { sort: [{ id: "actor", desc: false }] },
      { filters: [{ id: "action", variant: "select", operator: "eq", value: "not.an.action" }] },
      { filters: [{ id: "tenant", variant: "text", operator: "eq", value: "x" }] },
    ]) {
      let error: unknown;
      try {
        await call(auditRouter.listPlatform, input as never, { context: superContext });
      } catch (caught) {
        error = caught;
      }
      expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    }
  });

  describe("user-scoped security log", () => {
    /** Changes the password and returns the refreshed session cookie (the old one is revoked). */
    async function changePassword(headers: Headers, newPassword: string): Promise<Headers> {
      const response = await auth.api.changePassword({
        body: { currentPassword: TEST_PASSWORD, newPassword },
        headers,
        asResponse: true,
      });
      return cookieHeaderFromSetCookie(response.headers.get("set-cookie"));
    }

    async function codeOf(action: () => Promise<unknown>): Promise<unknown> {
      try {
        await action();
      } catch (error) {
        return (error as ORPCError<string, unknown>).code;
      }
      return undefined;
    }

    test("listSelf returns only the caller's user-scoped rows, newest first", async () => {
      const { headers: aliceHeaders, userId: aliceId } = await signUpAndVerify(
        "self-alice@example.com",
        "Alice",
      );
      const { headers: bobHeaders } = await signUpAndVerify("self-bob@example.com", "Bob");
      await auth.api.revokeOtherSessions({ headers: aliceHeaders });
      const aliceCurrent = await changePassword(aliceHeaders, "alice second passphrase 1");
      await changePassword(bobHeaders, "bob second passphrase 1");

      const context = await buildContext(aliceCurrent);
      const page = await call(auditRouter.listSelf, {}, { context });

      expect(page.total).toBe(1);
      expect(page.rows.map((row) => row.action)).toEqual(["user.password_changed"]);
      expect(page.rows.every((row) => row.scope === "user" && row.targetId === aliceId)).toBe(true);
    });

    test("listSelf rejects an unauthenticated caller", async () => {
      const anonymous = await buildContext(new Headers());
      expect(await codeOf(() => call(auditRouter.listSelf, {}, { context: anonymous }))).toBe(
        "UNAUTHORIZED",
      );
    });

    test("listSelf strips a smuggled userId and returns only the caller's rows", async () => {
      const { headers: aliceHeaders, userId: aliceId } = await signUpAndVerify(
        "smug-alice@example.com",
        "Alice",
      );
      const { headers: bobHeaders, userId: bobId } = await signUpAndVerify(
        "smug-bob@example.com",
        "Bob",
      );
      const aliceCurrent = await changePassword(aliceHeaders, "alice second passphrase 1");
      await changePassword(bobHeaders, "bob second passphrase 1");

      // The input schema is a non-strict zod object: the unknown key is dropped, not an error.
      const context = await buildContext(aliceCurrent);
      const page = await call(auditRouter.listSelf, { userId: bobId } as never, { context });

      expect(page.rows.length).toBeGreaterThan(0);
      expect(page.rows.every((row) => row.targetId === aliceId)).toBe(true);
      expect(page.rows.some((row) => row.targetId === bobId)).toBe(false);
    });

    test("listSelf paginates and filters by action", async () => {
      const { headers } = await signUpAndVerify("page-alice@example.com", "Alice");
      const current = await changePassword(headers, "second passphrase 123");
      const other = await auth.api.signInEmail({
        body: { email: "page-alice@example.com", password: "second passphrase 123" },
        asResponse: true,
      });
      expect(other.status).toBe(200);
      await auth.api.revokeOtherSessions({ headers: current });

      const context = await buildContext(current);
      const first = await call(auditRouter.listSelf, { perPage: 1 }, { context });
      expect(first.rows).toHaveLength(1);
      expect(first.total).toBeGreaterThan(1);

      const filtered = await call(
        auditRouter.listSelf,
        {
          filters: [
            { id: "action", variant: "select", operator: "eq", value: "user.password_changed" },
          ],
        },
        { context },
      );
      expect(filtered.rows.map((row) => row.action)).toEqual(["user.password_changed"]);
    });

    test("listUser: a superadmin reads any user's rows by id; a deleted user's trail survives", async () => {
      const { headers: targetHeaders, userId: targetId } = await signUpAndVerify(
        "admin-target@example.com",
        "Target",
      );
      const targetCurrent = await changePassword(targetHeaders, "target second passphrase 1");
      const superContext = await superadminContext();

      const page = await call(
        auditRouter.listUser,
        { userId: targetId },
        { context: superContext },
      );
      expect(page.rows.map((row) => row.action)).toEqual(["user.password_changed"]);

      await auth.api.deleteUser({ body: {}, headers: targetCurrent });
      await auth.api.deleteUserCallback({
        query: { token: emailSender.lastDeleteAccountTokenFor("admin-target@example.com") },
        headers: targetCurrent,
      });
      const afterDelete = await call(
        auditRouter.listUser,
        { userId: targetId },
        { context: superContext },
      );
      expect(afterDelete.rows.map((row) => row.action)).toEqual([
        "user.deleted",
        "user.password_changed",
      ]);
    });

    test("listUser is forbidden to plain users and unauthenticated callers", async () => {
      const { headers, userId } = await signUpAndVerify("iso-plain@example.com", "Plain");
      const current = await changePassword(headers, "plain second passphrase 1");
      const plainContext = await buildContext(current);

      expect(
        await codeOf(() => call(auditRouter.listUser, { userId }, { context: plainContext })),
      ).toBe("FORBIDDEN");
      const anonymous = await buildContext(new Headers());
      expect(
        await codeOf(() => call(auditRouter.listUser, { userId }, { context: anonymous })),
      ).toBe("UNAUTHORIZED");
    });

    test("user-scoped rows do not appear in the platform list", async () => {
      const { headers } = await signUpAndVerify("scope-plain@example.com", "Plain");
      await changePassword(headers, "plain second passphrase 1");

      const superContext = await superadminContext();
      const platformPage = await call(
        auditRouter.listPlatform,
        { perPage: 100 },
        { context: superContext },
      );
      expect(platformPage.rows.some((row) => row.scope === "user")).toBe(false);
    });
  });
});
