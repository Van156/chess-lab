import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for the platform audit write path against a real Postgres database: each
 * platform-admin action must produce exactly one audit event (recorded here through a
 * `RecordingAuditLogger` fake wired into a real `createAuth` instance), with the correct
 * scope/actor/target.
 *
 * Skips cleanly locally (fails loudly in CI) when no test database is reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "audit log write path");

describe.skipIf(!reachable)("audit log write path", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
    };
    auth = createAuth(authConfig, handle.db, emailSender, auditLogger, {
      extraPlugins: [testUtils()],
    });
    const context = await auth.$context;
    testHelpers = (context as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  function signUpAndVerify(
    email: string,
    name: string,
  ): Promise<{ headers: Headers; userId: string }> {
    return sharedSignUpAndVerify(auth, emailSender, email, name);
  }

  async function superadminHeaders(
    emailPrefix: string,
  ): Promise<{ headers: Headers; userId: string }> {
    const user = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(user);
    const { headers } = await testHelpers.login({ userId: user.id });
    void emailPrefix;
    return { headers, userId: user.id };
  }

  describe("platform events", () => {
    test("user.banned / user.unbanned each produce exactly one row", async () => {
      const { userId: targetUserId } = await signUpAndVerify("ban-target@example.com", "Target");
      const { headers: superadminHeadersValue } = await superadminHeaders("ban");
      auditLogger.reset();

      await auth.api.banUser({
        body: { userId: targetUserId, banReason: "spam" },
        headers: superadminHeadersValue,
      });
      const banned = auditLogger.eventsFor("user.banned");
      expect(banned).toHaveLength(1);
      expect(banned[0]).toMatchObject({
        scope: "platform",
        targetType: "user",
        targetId: targetUserId,
      });

      await auth.api.unbanUser({ body: { userId: targetUserId }, headers: superadminHeadersValue });
      expect(auditLogger.eventsFor("user.unbanned")).toHaveLength(1);
    });

    test("user.platform_role_changed produces exactly one row via /admin/set-role", async () => {
      const { userId: targetUserId } = await signUpAndVerify(
        "role-change-target@example.com",
        "Target",
      );
      const { headers: superadminHeadersValue } = await superadminHeaders("role-change");
      auditLogger.reset();

      await auth.api.setRole({
        body: { userId: targetUserId, role: "superadmin" },
        headers: superadminHeadersValue,
      });

      const changed = auditLogger.eventsFor("user.platform_role_changed");
      expect(changed).toHaveLength(1);
      expect(changed[0]).toMatchObject({ scope: "platform", targetId: targetUserId });
    });

    test("user.impersonation_started / user.impersonation_stopped each produce exactly one row", async () => {
      const { userId: targetUserId } = await signUpAndVerify(
        "impersonation-target@example.com",
        "Target",
      );
      const { headers: superadminHeadersValue, userId: superadminId } =
        await superadminHeaders("impersonation");
      auditLogger.reset();

      const impersonation = await auth.api.impersonateUser({
        body: { userId: targetUserId },
        headers: superadminHeadersValue,
        asResponse: true,
      });
      const started = auditLogger.eventsFor("user.impersonation_started");
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        scope: "platform",
        actorUserId: superadminId,
        targetId: targetUserId,
      });

      const impersonatedHeaders = cookieHeaderFromSetCookie(
        impersonation.headers.get("set-cookie"),
      );
      auditLogger.reset();

      await auth.api.stopImpersonating({
        headers: impersonatedHeaders,
      });
      const stopped = auditLogger.eventsFor("user.impersonation_stopped");
      expect(stopped).toHaveLength(1);
      expect(stopped[0]).toMatchObject({
        scope: "platform",
        actorUserId: superadminId,
        targetId: targetUserId,
        impersonatorUserId: null,
      });
    });
  });
});
