import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import * as schema from "@b2c-template/db/schema";
import { testUtils } from "better-auth/plugins";
import type { TestHelpers } from "better-auth/plugins";
import { getColumns, getTableName, isTable, sql } from "drizzle-orm";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import { DELETE_FRESH_WINDOW_MS, LICHESS_DELETE_ERROR_CODES } from "./lichess-account";
import {
  cookieHeaderFromSetCookie,
  RecordingAuditLogger,
  RecordingEmailSender,
  resolveTestDatabaseUrl,
  signUpAndVerify as sharedSignUpAndVerify,
  truncateAllTables,
} from "./testing";

/**
 * Sign in with Lichess (lichess-account spec, ADR-07). Lichess' token and account endpoints are
 * stubbed through `fetch`. Skips cleanly without a test database.
 */
const TEST_DATABASE_URL = resolveTestDatabaseUrl();
const reachable = await requireTestDatabaseOrSkip(TEST_DATABASE_URL, "lichess sign-in");

const BASE_URL = "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3001";
const TOKEN_URL = "https://lichess.org/api/token";
const ACCOUNT_URL = "https://lichess.org/api/account";
// Longer than 512 characters: Lichess tokens may exceed that and must still fit the column.
const LONG_TOKEN = `lio_${"a1b2c3d4".repeat(80)}`;

type FakeAccount = { id: string; username: string; rating: number };

describe.skipIf(!reachable)("lichess sign-in", () => {
  let handle: TestDatabaseHandle;
  let emailSender: RecordingEmailSender;
  let authConfig: AuthConfig;
  let auth: ReturnType<typeof createAuth>;
  let auditLogger: RecordingAuditLogger;
  let testHelpers: TestHelpers;
  const realFetch = globalThis.fetch;
  let lichessAccount: FakeAccount = { id: "thibault", username: "Thibault", rating: 1850 };
  let tokenRequestBodies: string[] = [];

  beforeAll(async () => {
    handle = createTestDatabase(TEST_DATABASE_URL);
    emailSender = new RecordingEmailSender();
    authConfig = {
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "a-32-character-long-test-secret",
      CORS_ORIGIN: WEB_ORIGIN,
      LICHESS_CLIENT_ID: "chess-lab-test",
    };
    auditLogger = new RecordingAuditLogger();
    auth = createAuth(authConfig, handle.db, emailSender, auditLogger, {
      extraPlugins: [testUtils()],
    });
    testHelpers = ((await auth.$context) as unknown as { test: TestHelpers }).test;
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
    auditLogger.reset();
    tokenRequestBodies = [];
    lichessAccount = { id: "thibault", username: "Thibault", rating: 1850 };
    await truncateAllTables(handle.db);
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === TOKEN_URL) {
          tokenRequestBodies.push(String(init?.body ?? ""));
          return Response.json({
            access_token: LONG_TOKEN,
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        if (url === ACCOUNT_URL) {
          return Response.json({
            id: lichessAccount.id,
            username: lichessAccount.username,
            perfs: { blitz: { games: 120, rating: lichessAccount.rating, rd: 60, prog: 5 } },
          });
        }
        return realFetch(input, init);
      },
      { preconnect: realFetch.preconnect },
    );
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /** `POST /sign-in/social` then the provider callback; returns the final redirect and cookies. */
  async function lichessRoundTrip(): Promise<{ location: URL; setCookie: string | null }> {
    const start = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: WEB_ORIGIN },
        body: JSON.stringify({
          provider: "lichess",
          callbackURL: `${WEB_ORIGIN}/dashboard`,
          errorCallbackURL: `${WEB_ORIGIN}/sign-in`,
        }),
      }),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const authorizeUrl = new URL(url);
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe("https://lichess.org/oauth");
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(authorizeUrl.searchParams.get("scope") ?? "").toBe("");
    const state = authorizeUrl.searchParams.get("state");
    const cookie = (start.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; ");

    const callback = await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/lichess?code=fake-code&state=${state}`, {
        headers: { cookie },
      }),
    );
    expect(callback.status).toBe(302);
    return {
      location: new URL(callback.headers.get("location") ?? ""),
      setCookie: callback.headers.get("set-cookie"),
    };
  }

  async function rows<T extends Record<string, unknown>>(query: ReturnType<typeof sql>) {
    return (await handle.db.execute<T>(query)).rows;
  }

  test("PKCE is used and no client secret is sent to the token endpoint", async () => {
    await lichessRoundTrip();
    const body = new URLSearchParams(tokenRequestBodies[0]);
    expect(body.get("code_verifier")).toBeTruthy();
    expect(body.get("client_id")).toBe("chess-lab-test");
    expect(body.has("client_secret")).toBe(false);
  });

  test("first sign-in creates a user with a verified synthetic email and a session", async () => {
    const { location, setCookie } = await lichessRoundTrip();
    expect(location.href).toBe(`${WEB_ORIGIN}/dashboard`);
    expect(setCookie).toContain("session_token");
    const users = await rows<{ email: string; name: string; email_verified: boolean }>(
      sql`SELECT email, name, email_verified FROM "user"`,
    );
    expect(users).toEqual([
      { email: "thibault@lichess.invalid", name: "Thibault", email_verified: true },
    ]);
    expect(emailSender.verifications).toEqual([]);
  });

  test("stores the access token encrypted at rest", async () => {
    await lichessRoundTrip();
    const [account] = await rows<{ account_id: string; access_token: string }>(
      sql`SELECT account_id, access_token FROM account WHERE provider_id = 'lichess'`,
    );
    expect(account?.account_id).toBe("thibault");
    expect(account?.access_token).not.toBe(LONG_TOKEN);
    expect(account?.access_token).not.toContain("lio_");
    // `$ba$` prefix or hex form, per better-auth's encrypted-token detection.
    expect(account?.access_token).toMatch(/^(\$ba\$|[0-9a-f]+$)/);
  });

  test("upserts lichess_profile with id, username and ratings", async () => {
    await lichessRoundTrip();
    const profiles = await rows<{
      lichess_id: string;
      username: string;
      rating_snapshot: { blitz: { rating: number } };
    }>(sql`SELECT lichess_id, username, rating_snapshot FROM lichess_profile`);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.lichess_id).toBe("thibault");
    expect(profiles[0]?.username).toBe("Thibault");
    expect(profiles[0]?.rating_snapshot.blitz.rating).toBe(1850);
  });

  test("a second sign-in refreshes the username and ratings and keeps the same user", async () => {
    await lichessRoundTrip();
    const [first] = await rows<{ id: string }>(sql`SELECT id FROM "user"`);
    lichessAccount = { id: "thibault", username: "ThibaultRenamed", rating: 1900 };
    await lichessRoundTrip();

    const users = await rows<{ id: string; name: string }>(sql`SELECT id, name FROM "user"`);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(first?.id);
    expect(users[0]?.name).toBe("ThibaultRenamed");
    const profiles = await rows<{
      username: string;
      rating_snapshot: { blitz: { rating: number } };
    }>(sql`SELECT username, rating_snapshot FROM lichess_profile`);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.username).toBe("ThibaultRenamed");
    expect(profiles[0]?.rating_snapshot.blitz.rating).toBe(1900);
  });

  test("two different Lichess users get distinct synthetic emails and accounts", async () => {
    await lichessRoundTrip();
    lichessAccount = { id: "other", username: "Other", rating: 1200 };
    await lichessRoundTrip();
    const emails = await rows<{ email: string }>(sql`SELECT email FROM "user" ORDER BY email`);
    expect(emails.map((row) => row.email)).toEqual([
      "other@lichess.invalid",
      "thibault@lichess.invalid",
    ]);
  });

  test("never auto-links to an existing email account", async () => {
    const { userId } = await sharedSignUpAndVerify(
      auth,
      emailSender,
      "someone@example.com",
      "Someone",
    );
    await lichessRoundTrip();
    const users = await rows<{ id: string }>(sql`SELECT id FROM "user"`);
    expect(users).toHaveLength(2);
    const linked = await rows<{ provider_id: string }>(
      sql`SELECT provider_id FROM account WHERE user_id = ${userId} AND provider_id = 'lichess'`,
    );
    expect(linked).toEqual([]);
  });

  test("denied authorization creates no user and no session", async () => {
    const start = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: WEB_ORIGIN },
        body: JSON.stringify({
          provider: "lichess",
          callbackURL: `${WEB_ORIGIN}/dashboard`,
          errorCallbackURL: `${WEB_ORIGIN}/sign-in`,
        }),
      }),
    );
    const { url } = (await start.json()) as { url: string };
    const state = new URL(url).searchParams.get("state");
    const cookie = (start.headers.getSetCookie?.() ?? [])
      .map((value) => value.split(";")[0])
      .join("; ");
    const callback = await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/lichess?error=access_denied&state=${state}`, {
        headers: { cookie },
      }),
    );
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get("location") ?? "").searchParams.get("error")).toBeTruthy();
    expect(callback.headers.get("set-cookie") ?? "").not.toContain("session_token");
    expect(await rows(sql`SELECT 1 FROM "user"`)).toEqual([]);
    expect(await rows(sql`SELECT 1 FROM lichess_profile`)).toEqual([]);
  });

  test("lichess is not registered without LICHESS_CLIENT_ID", async () => {
    const { LICHESS_CLIENT_ID: _id, ...without } = authConfig;
    const plain = createAuth(without, handle.db, emailSender, new RecordingAuditLogger());
    const response = await plain.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: WEB_ORIGIN },
        body: JSON.stringify({ provider: "lichess", callbackURL: `${WEB_ORIGIN}/dashboard` }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  describe("POST /api/auth/lichess/delete-account (ADR-08)", () => {
    const DELETE_URL = `${BASE_URL}/api/auth/lichess/delete-account`;

    /** Signs in with Lichess and returns the session cookie plus the new user id. */
    async function signInWithLichess() {
      const { setCookie } = await lichessRoundTrip();
      const headers = cookieHeaderFromSetCookie(setCookie);
      const [user] = await rows<{ id: string }>(
        sql`SELECT id FROM "user" WHERE email = ${`${lichessAccount.id}@lichess.invalid`}`,
      );
      return { headers, userId: user!.id };
    }

    function deleteAccount(
      headers: Headers | null,
      confirmUsername: unknown,
      instance: ReturnType<typeof createAuth> = auth,
    ) {
      const request = new Headers({ "content-type": "application/json", origin: WEB_ORIGIN });
      const cookie = headers?.get("cookie");
      if (cookie) {
        request.set("cookie", cookie);
      }
      return instance.handler(
        new Request(DELETE_URL, {
          method: "POST",
          headers: request,
          body: JSON.stringify({ confirmUsername }),
        }),
      );
    }

    async function ageSessions(userId: string, ms: number) {
      await handle.db.execute(
        sql`UPDATE session SET created_at = created_at - ${`${ms} milliseconds`}::interval WHERE user_id = ${userId}`,
      );
    }

    /** Every table that owns rows through a `user_id` column, derived so new tables are covered. */
    const userOwnedTables = (Object.values(schema) as unknown[])
      .filter(isTable)
      .filter((table) =>
        Object.values(getColumns(table)).some((column) => column.name === "user_id"),
      )
      .map((table) => getTableName(table));

    async function countsFor(userId: string) {
      const counts: Record<string, number> = {};
      for (const name of userOwnedTables) {
        const [row] = await rows<{ n: number }>(
          sql`SELECT count(*)::int AS n FROM ${sql.identifier(name)} WHERE user_id = ${userId}`,
        );
        counts[name] = row?.n ?? 0;
      }
      return counts;
    }

    /** One row in every Phase 1 chess table for `userId` (settings and profile are 1:1). */
    async function seedChess(userId: string) {
      const [g] = await handle.db
        .insert(schema.game)
        .values({
          userId,
          lichessGameId: `${userId}-game`,
          pgn: "1. e4 e5 *",
          userColor: "white",
          speed: "blitz",
          rated: true,
          result: "*",
          playedAt: new Date("2026-01-01T00:00:00.000Z"),
        })
        .returning({ id: schema.game.id });
      await handle.db
        .insert(schema.gameAnalysis)
        .values({ gameId: g!.id, userId, status: "complete" });
      const [m] = await handle.db
        .insert(schema.mistake)
        .values({
          userId,
          gameId: g!.id,
          ply: 3,
          fenBefore: "fen",
          positionKey: "key",
          playedSan: "h3",
          playedUci: "h2h3",
          bestSan: "Nf3",
          bestUci: "g1f3",
          evalBeforeCp: 30,
          evalAfterCp: -400,
          evalLossCp: 430,
          severity: "blunder",
          phase: "opening",
        })
        .returning({ id: schema.mistake.id });
      const [c] = await handle.db
        .insert(schema.card)
        .values({ userId, mistakeId: m!.id, due: new Date("2026-03-11T00:00:00.000Z") })
        .returning({ id: schema.card.id });
      await handle.db.insert(schema.reviewLog).values({
        id: `${userId}-log`,
        userId,
        cardId: c!.id,
        grade: 3,
        reviewedAt: new Date("2026-03-10T00:00:00.000Z"),
        elapsedMs: 1200,
        stateBefore: { state: 0 },
        stateAfter: { state: 1 },
      });
      await handle.db.insert(schema.userSettings).values({ userId, timeZone: "Europe/Madrid" });
    }

    test("exposes a 10 minute fresh window (ADR-08)", () => {
      expect(DELETE_FRESH_WINDOW_MS).toBe(10 * 60 * 1000);
    });

    test("rejects a request without a session", async () => {
      const { userId } = await signInWithLichess();
      const response = await deleteAccount(null, "Thibault");
      expect(response.status).toBe(401);
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
    });

    test("rejects an impersonated session", async () => {
      const { userId } = await signInWithLichess();
      const admin = testHelpers.createUser({ role: "superadmin" });
      await testHelpers.saveUser(admin);
      const { headers: adminHeaders } = await testHelpers.login({ userId: admin.id });
      const impersonation = await auth.api.impersonateUser({
        body: { userId },
        headers: adminHeaders,
        asResponse: true,
      });
      const impersonated = cookieHeaderFromSetCookie(impersonation.headers.get("set-cookie"));

      const response = await deleteAccount(impersonated, "Thibault");
      expect(response.status).toBe(403);
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
    });

    test("a session older than the fresh window gets 403 REAUTH_REQUIRED", async () => {
      const { headers, userId } = await signInWithLichess();
      await ageSessions(userId, DELETE_FRESH_WINDOW_MS + 60_000);
      const response = await deleteAccount(headers, "Thibault");
      expect(response.status).toBe(403);
      expect(((await response.json()) as { code: string }).code).toBe(
        LICHESS_DELETE_ERROR_CODES.REAUTH_REQUIRED,
      );
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
    });

    test("a session just inside the fresh window is accepted", async () => {
      const { headers, userId } = await signInWithLichess();
      await ageSessions(userId, DELETE_FRESH_WINDOW_MS - 60_000);
      const response = await deleteAccount(headers, "Thibault");
      expect(response.status).toBe(200);
    });

    test("a wrong username gets 400 USERNAME_MISMATCH and deletes nothing", async () => {
      const { headers, userId } = await signInWithLichess();
      const response = await deleteAccount(headers, "NotThibault");
      expect(response.status).toBe(400);
      expect(((await response.json()) as { code: string }).code).toBe(
        LICHESS_DELETE_ERROR_CODES.USERNAME_MISMATCH,
      );
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
      expect(auditLogger.eventsFor("user.deleted")).toEqual([]);
    });

    test("an email-account user cannot use the Lichess-only endpoint", async () => {
      const { headers, userId } = await sharedSignUpAndVerify(
        auth,
        emailSender,
        "someone@example.com",
        "Someone",
      );
      const response = await deleteAccount(headers, "Someone");
      expect(response.status).toBe(403);
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
    });

    test("fails closed when the audit write fails: nothing is deleted", async () => {
      const { headers, userId } = await signInWithLichess();
      await seedChess(userId);
      const failing = createAuth(authConfig, handle.db, emailSender, new RecordingAuditLogger(), {
        accountSecurityEvents: {
          userDeleting: () => Promise.reject(new Error("audit store down")),
        },
      });
      const before = await countsFor(userId);

      const response = await deleteAccount(headers, "Thibault", failing);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=;");
      expect(await countsFor(userId)).toEqual(before);
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
    });

    test("a user delete that fails after the audit write is recorded, keeps the account and the cookie", async () => {
      const { headers, userId } = await signInWithLichess();
      await seedChess(userId);
      const before = await countsFor(userId);
      // A real database failure on the user row, after the audit write.
      await handle.db.execute(sql`
        CREATE OR REPLACE FUNCTION block_user_delete() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'user delete blocked'; END; $$ LANGUAGE plpgsql`);
      await handle.db.execute(
        sql`CREATE TRIGGER block_user_delete BEFORE DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION block_user_delete()`,
      );
      let response: Response;
      try {
        response = await deleteAccount(headers, "Thibault");
      } finally {
        await handle.db.execute(sql`DROP TRIGGER block_user_delete ON "user"`);
        await handle.db.execute(sql`DROP FUNCTION block_user_delete()`);
      }

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=;");
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toHaveLength(1);
      const chessOnly = (counts: Record<string, number>) =>
        Object.fromEntries(
          Object.entries(counts).filter(([name]) => !["session", "account"].includes(name)),
        );
      expect(chessOnly(await countsFor(userId))).toEqual(chessOnly(before));
      // The audit trail says the delete failed, so `user.deleted` is never the last word.
      expect(auditLogger.eventsFor("user.deleted")).toHaveLength(1);
      const [failed] = auditLogger.eventsFor("user.delete_failed");
      expect(failed?.actorUserId).toBe(userId);
    });

    test("exports every delete error code as a named constant", () => {
      expect(LICHESS_DELETE_ERROR_CODES).toEqual({
        IMPERSONATION_NOT_ALLOWED: "IMPERSONATION_NOT_ALLOWED",
        LICHESS_ONLY_ACCOUNT_REQUIRED: "LICHESS_ONLY_ACCOUNT_REQUIRED",
        REAUTH_REQUIRED: "REAUTH_REQUIRED",
        USERNAME_MISMATCH: "USERNAME_MISMATCH",
      });
    });

    test("matches the username case-insensitively, then deletes everything and clears the cookie", async () => {
      const { headers, userId } = await signInWithLichess();
      await seedChess(userId);
      // Another user's rows must survive.
      lichessAccount = { id: "other", username: "Other", rating: 1200 };
      const other = await signInWithLichess();
      await seedChess(other.userId);

      // The derived list covers every table the seed fills, so a new owned table fails here.
      const before = await countsFor(userId);
      expect(Object.keys(before).length).toBeGreaterThan(5);
      expect(Object.values(before).every((n) => n >= 1)).toBe(true);
      const otherBefore = await countsFor(other.userId);

      const response = await deleteAccount(headers, "tHiBaUlT");

      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie") ?? "").toMatch(/session_token=;/);
      expect(await rows(sql`SELECT 1 FROM "user" WHERE id = ${userId}`)).toEqual([]);
      expect(await countsFor(userId)).toEqual(
        Object.fromEntries(userOwnedTables.map((name) => [name, 0])),
      );
      expect(await countsFor(other.userId)).toEqual(otherBefore);
      const [event] = auditLogger.eventsFor("user.deleted");
      expect(event?.actorUserId).toBe(userId);

      // The old cookie no longer authenticates.
      const replay = await deleteAccount(headers, "Thibault");
      expect(replay.status).toBe(401);
    });
  });
});
