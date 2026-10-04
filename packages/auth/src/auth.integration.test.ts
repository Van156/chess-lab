import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  TEST_PASSWORD,
  truncateAllTables,
} from "./testing";

/**
 * Integration tests for `createAuth` wiring against a real Postgres
 * database (R0).
 *
 * Skips cleanly (does not fail) when no test database is reachable; in a
 * normal `pnpm db:start` / CI setup, the suite actually executes.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "createAuth integration (R0)");

describe.skipIf(!reachable)("createAuth integration (R0)", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let auditLogger: RecordingAuditLogger;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    auditLogger = new RecordingAuditLogger();
    authConfig = {
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: "http://localhost:3001",
    };
    auth = createAuth(authConfig, handle.db, emailSender, auditLogger);
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    auditLogger.reset();
    await truncateAllTables(handle.db);
  });

  test("R0.1: sign-up sends a verification email; sign-in before verification is refused", async () => {
    const email = "r0-1@example.com";

    const signUpResult = await auth.api.signUpEmail({
      body: { email, password: TEST_PASSWORD, name: "R0.1 User" },
    });

    expect(signUpResult.token).toBeNull();
    expect(emailSender.verifications).toHaveLength(1);
    expect(emailSender.verifications[0]?.to).toBe(email);
    expect(emailSender.verifications[0]?.url).toContain("token=");

    await expect(
      auth.api.signInEmail({ body: { email, password: TEST_PASSWORD } }),
    ).rejects.toThrow();
  });

  test("R0.2: verifying via the captured link marks emailVerified and auto signs the user in", async () => {
    const email = "r0-2@example.com";
    await auth.api.signUpEmail({ body: { email, password: TEST_PASSWORD, name: "R0.2 User" } });
    const token = emailSender.lastVerificationTokenFor(email);

    const verifyResponse = await auth.api.verifyEmail({ query: { token }, asResponse: true });
    expect(verifyResponse.status).toBe(200);
    const setCookie = verifyResponse.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();

    const cookiePair = setCookie?.split(";")[0] ?? "";
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookiePair }) });
    expect(session?.user.emailVerified).toBe(true);
    expect(session?.session).toBeTruthy();
  });
});
