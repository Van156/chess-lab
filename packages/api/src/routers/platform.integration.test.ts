import { createAuth } from "@b2c-template/auth";
import type { AuthConfig } from "@b2c-template/auth";
import { createDrizzleAuditLogger } from "@b2c-template/auth/audit";
import {
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "@b2c-template/auth/testing";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "../authorization";
import type { Context } from "../context";
import { createBetterAuthPlatformAdmin } from "../platform-admin";
import { platformRouter } from "./platform";

/**
 * Integration tests for the platform admin router against a real Postgres database, following
 * `audit.integration.test.ts`'s setup pattern (real `createAuth` +
 * `createBetterAuthAuthorization`/`createBetterAuthPlatformAdmin`). Uses a real
 * `createDrizzleAuditLogger` so the "exactly one audit_log entry, not duplicated by this router"
 * claim is checked against actual rows, not an in-memory fake. Skips cleanly locally (fails
 * loudly in CI) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "platform admin router");

describe.skipIf(!reachable)("platform admin router", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
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
    };
  }

  async function superadminContext(): Promise<{
    context: Context;
    headers: Headers;
    userId: string;
  }> {
    const superadminUser = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadminUser);
    const { headers } = await testHelpers.login({ userId: superadminUser.id });
    return { context: await buildContext(headers), headers, userId: superadminUser.id };
  }

  async function countAuditRows(action: string): Promise<number> {
    const { auditLog } = await import("@b2c-template/db/schema/audit");
    const rows = await handle.db.select().from(auditLog).where(eq(auditLog.action, action));
    return rows.length;
  }

  describe("access control", () => {
    test("a plain user is forbidden from every platform procedure, including when acting on their own account", async () => {
      const { headers: plainHeaders, userId: plainId } = await signUpAndVerify(
        "layer-plain@example.com",
        "Plain",
      );
      const context = await buildContext(plainHeaders);
      const { userId: targetId } = await signUpAndVerify("layer-target@example.com", "Target");

      const invocations: Array<[string, () => Promise<unknown>]> = [
        ["users.list", () => call(platformRouter.users.list, {}, { context })],
        [
          "users.ban",
          () => call(platformRouter.users.ban, { userId: targetId, reason: "x" }, { context }),
        ],
        ["users.unban", () => call(platformRouter.users.unban, { userId: targetId }, { context })],
        [
          "users.ban (self)",
          () => call(platformRouter.users.ban, { userId: plainId, reason: "x" }, { context }),
        ],
      ];

      for (const [name, invoke] of invocations) {
        let error: unknown;
        try {
          await invoke();
        } catch (thrown) {
          error = thrown;
        }
        expect(error, `${name} should be forbidden for a plain user`).toBeInstanceOf(ORPCError);
        expect((error as ORPCError<string, unknown>).code, name).toBe("FORBIDDEN");
      }
    });

    test("an unauthenticated caller is unauthorized, not forbidden", async () => {
      const context = await buildContext(new Headers());

      let error: unknown;
      try {
        await call(platformRouter.users.list, {}, { context });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("UNAUTHORIZED");
    });
  });

  describe("list users", () => {
    test("a superadmin searches/paginates users", async () => {
      const { userId } = await signUpAndVerify("alice-search@example.com", "Alice");
      const { context } = await superadminContext();

      const page = await call(
        platformRouter.users.list,
        { filters: [{ id: "email", variant: "text", operator: "iLike", value: "ALICE-search" }] },
        { context },
      );

      expect(page.total).toBe(1);
      expect(page.users.map((user) => user.id)).toEqual([userId]);
    });

    test("users filter by role and status", async () => {
      const { userId } = await signUpAndVerify("carol-plain@example.com", "Carol");
      const { context } = await superadminContext();

      const supers = await call(
        platformRouter.users.list,
        { filters: [{ id: "role", variant: "select", operator: "eq", value: "superadmin" }] },
        { context },
      );
      expect(supers.total).toBeGreaterThanOrEqual(1);
      expect(supers.users.every((user) => user.role?.includes("superadmin"))).toBe(true);
      expect(supers.users.some((user) => user.id === userId)).toBe(false);

      const banned = await call(
        platformRouter.users.list,
        { filters: [{ id: "status", variant: "select", operator: "eq", value: "banned" }] },
        { context },
      );
      expect(banned.users.some((user) => user.id === userId)).toBe(false);
    });

    test("an unknown status value is rejected as a bad request by the input allowlist (the UnsupportedFilterError mapping is defense in depth)", async () => {
      const { context } = await superadminContext();

      let error: unknown;
      try {
        await call(
          platformRouter.users.list,
          { filters: [{ id: "status", variant: "select", operator: "eq", value: "suspended" }] },
          { context },
        );
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    });

    test("users sort by email in both directions (collation-independent probe)", async () => {
      // Lowercase letters only with one shared suffix, so every collation (C, glibc, ICU)
      // orders them alike. Signed up out of order so insertion order cannot pass the test.
      const probes = ["orderprobec", "orderprobea", "orderprobeb"].map(
        (local) => `${local}@example.com`,
      );
      for (const email of probes) {
        await signUpAndVerify(email, "Probe");
      }
      const { context } = await superadminContext();
      const sortedEmails = async (desc: boolean) => {
        const page = await call(
          platformRouter.users.list,
          {
            sort: [{ id: "email", desc }],
            filters: [{ id: "email", variant: "text", operator: "iLike", value: "orderprobe" }],
          },
          { context },
        );
        return page.users.map((user) => user.email);
      };

      const ascending = ["orderprobea", "orderprobeb", "orderprobec"].map(
        (local) => `${local}@example.com`,
      );
      expect(await sortedEmails(false)).toEqual(ascending);
      expect(await sortedEmails(true)).toEqual([...ascending].reverse());
    });

    test("a literal % or _ in a user search matches itself, not any text", async () => {
      const { userId: percentId } = await signUpAndVerify("wild-percent@example.com", "zq%zq");
      await signUpAndVerify("wild-plain-a@example.com", "zqxzq");
      const { userId: underscoreId } = await signUpAndVerify(
        "wild-underscore@example.com",
        "zq_zq",
      );
      const { context } = await superadminContext();
      const searchName = async (value: string) => {
        const page = await call(
          platformRouter.users.list,
          { filters: [{ id: "name", variant: "text", operator: "iLike", value }] },
          { context },
        );
        return page.users.map((user) => user.id);
      };

      expect(await searchName("q%z")).toEqual([percentId]);
      expect(await searchName("q_z")).toEqual([underscoreId]);
    });

    test("users accept several sorts and several filters at once", async () => {
      await signUpAndVerify("multi-zed@example.com", "Multi Zed");
      const { userId: keptId } = await signUpAndVerify("multi-kept@example.com", "Multi Kept");
      const { context } = await superadminContext();

      const page = await call(
        platformRouter.users.list,
        {
          sort: [
            { id: "name", desc: false },
            { id: "email", desc: false },
          ],
          filters: [
            { id: "email", variant: "text", operator: "iLike", value: "multi-" },
            { id: "name", variant: "text", operator: "iLike", value: "KEPT" },
          ],
        },
        { context },
      );

      expect(page.users.map((user) => user.id)).toEqual([keptId]);
      expect(page.total).toBe(1);
    });
  });

  describe("users.get", () => {
    test("fetches a single user by id", async () => {
      const { userId } = await signUpAndVerify("bob-detail@example.com", "Bob");
      const { context } = await superadminContext();

      const result = await call(platformRouter.users.get, { userId }, { context });

      expect(result.id).toBe(userId);
      expect(result.email).toBe("bob-detail@example.com");
    });

    test("a plain user is forbidden", async () => {
      const { headers: plainHeaders } = await signUpAndVerify(
        "get-user-plain@example.com",
        "Plain",
      );
      const context = await buildContext(plainHeaders);

      let error: unknown;
      try {
        await call(platformRouter.users.get, { userId: "whoever" }, { context });
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
    });
  });

  describe("ban / unban", () => {
    test("bans with a reason and optional expiry; sessions are revoked and sign-in is refused; unban restores sign-in", async () => {
      const { headers: targetHeaders, userId: targetId } = await signUpAndVerify(
        "ban-target@example.com",
        "Target",
      );
      const { context } = await superadminContext();

      const banned = await call(
        platformRouter.users.ban,
        { userId: targetId, reason: "spam", expiresInSeconds: 3600 },
        { context },
      );
      expect(banned.banned).toBe(true);
      expect(banned.banReason).toBe("spam");

      // The target's pre-ban session is revoked (better-auth's own banUser).
      const sessionAfterBan = await auth.api.getSession({ headers: targetHeaders });
      expect(sessionAfterBan).toBeNull();

      // Sign-in is refused while banned.
      await expect(
        auth.api.signInEmail({
          body: { email: "ban-target@example.com", password: "correct horse battery staple" },
        }),
      ).rejects.toThrow();

      const unbanned = await call(platformRouter.users.unban, { userId: targetId }, { context });
      expect(unbanned.banned).toBe(false);

      const signInAfterUnban = await auth.api.signInEmail({
        body: { email: "ban-target@example.com", password: "correct horse battery staple" },
      });
      expect(signInAfterUnban.user.id).toBe(targetId);
    });

    test("produces exactly one audit_log entry each for ban and unban, not duplicated by this router", async () => {
      const { userId: targetId } = await signUpAndVerify("ban-audit@example.com", "Target");
      const { context } = await superadminContext();

      await call(platformRouter.users.ban, { userId: targetId, reason: "test" }, { context });
      expect(await countAuditRows("user.banned")).toBe(1);

      await call(platformRouter.users.unban, { userId: targetId }, { context });
      expect(await countAuditRows("user.unbanned")).toBe(1);
    });
  });
});
