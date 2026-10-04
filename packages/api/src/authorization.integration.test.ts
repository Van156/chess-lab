import type { AuthConfig } from "@b2c-template/auth";
import { createAuth } from "@b2c-template/auth";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "@b2c-template/auth/testing";
import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { call, ORPCError } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";

import { createBetterAuthAuthorization } from "./authorization";
import type { Context } from "./context";
import { createBetterAuthPlatformAdmin } from "./platform-admin";
import { platformProcedure } from "./index";

/**
 * Integration tests for the oRPC authorization port against a real Postgres database, using
 * `createBetterAuthAuthorization` wired to a real `createAuth` instance: the same adapter
 * `apps/server` uses in production. Skips cleanly (does not fail) when no test database is
 * reachable.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(
  TEST_DATABASE_URL,
  "createBetterAuthAuthorization integration",
);

describe.skipIf(!reachable)("createBetterAuthAuthorization integration", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let auth: ReturnType<typeof createAuth>;
  let testHelpers: TestHelpers;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
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
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  /** Builds a real oRPC `Context` for `headers`, mirroring `apps/server/src/context.ts`. */
  async function buildContext(headers: Headers): Promise<Context> {
    const session = await auth.api.getSession({ headers });
    return {
      db: handle.db,
      session,
      headers,
      authorization: createBetterAuthAuthorization(auth),
      platformAdmin: createBetterAuthPlatformAdmin(auth),
      auditLogger,
      lichess: {} as unknown as Context["lichess"],
    };
  }

  const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");

  test("a superadmin passes platformProcedure", async () => {
    const superadmin = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadmin);
    const { headers } = await testHelpers.login({ userId: superadmin.id });

    const result = await call(platformPing, undefined, { context: await buildContext(headers) });

    expect(result).toBe("pong");
  });

  test("a user without a platform role is FORBIDDEN", async () => {
    const { headers } = await sharedSignUpAndVerify(
      auth,
      emailSender,
      "plain@example.com",
      "Plain",
    );

    let error: unknown;
    try {
      await call(platformPing, undefined, { context: await buildContext(headers) });
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("a platform role does not leak a permission it lacks (impersonate-admins)", async () => {
    const superadmin = testHelpers.createUser({ role: "superadmin" });
    await testHelpers.saveUser(superadmin);
    const port = createBetterAuthAuthorization(auth);

    expect(await port.hasPlatformPermission(superadmin.id, { user: ["list"] })).toBe(true);
    expect(await port.hasPlatformPermission(superadmin.id, { user: ["impersonate-admins"] })).toBe(
      false,
    );
  });

  test("an unknown user id is denied, not an error", async () => {
    const port = createBetterAuthAuthorization(auth);

    expect(await port.hasPlatformPermission("no-such-user", { user: ["list"] })).toBe(false);
  });
});
