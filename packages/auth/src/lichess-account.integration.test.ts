import { createTestDatabase, requireTestDatabaseOrSkip } from "@b2c-template/db/testing";
import type { TestDatabaseHandle } from "@b2c-template/db/testing";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import type { AuthConfig } from "./index";
import { createAuth } from "./index";
import {
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
    auth = createAuth(authConfig, handle.db, emailSender, new RecordingAuditLogger());
  });

  afterAll(async () => {
    await handle.close();
  });

  beforeEach(async () => {
    emailSender.reset();
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
});
