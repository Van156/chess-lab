import { describe, expect, test } from "bun:test";

import {
  LICHESS_AUTHORIZATION_URL,
  LICHESS_TOKEN_URL,
  buildLichessOAuthConfig,
  fetchLichessAccount,
} from "./lichess-provider";

const ACCOUNT = {
  id: "thibault",
  username: "Thibault",
  perfs: {
    blitz: { games: 120, rating: 1850, rd: 60, prog: 12 },
    rapid: { games: 8, rating: 1500, rd: 180, prog: 0, prov: true },
  },
};

function fakeFetch(response: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("buildLichessOAuthConfig", () => {
  const config = buildLichessOAuthConfig({ clientId: "chess-lab" });

  test("is a public PKCE client with no secret, no scopes and post authentication", () => {
    expect(config.providerId).toBe("lichess");
    expect(config.clientId).toBe("chess-lab");
    expect(config.clientSecret).toBeUndefined();
    expect(config.pkce).toBe(true);
    expect(config.scopes).toEqual([]);
    expect(config.authentication).toBe("post");
    expect(config.authorizationUrl).toBe(LICHESS_AUTHORIZATION_URL);
    expect(config.tokenUrl).toBe(LICHESS_TOKEN_URL);
  });

  test("refreshes the username on every sign-in", () => {
    expect(config.overrideUserInfo).toBe(true);
  });

  test("uses the immutable Lichess id as the account subject, not the username", async () => {
    const subject = await config.accountSubject?.({
      tokens: { accessToken: "t" },
      profile: { id: "thibault", name: "Thibault" },
    } as never);
    expect(subject).toBe("thibault");
  });

  test("maps the profile to a verified synthetic-email user named after the username", async () => {
    const mapped = await config.mapProfileToUser?.({
      id: "thibault",
      username: "Thibault",
      emailVerified: true,
    });
    expect(mapped).toEqual({
      name: "Thibault",
      email: "thibault@lichess.invalid",
      emailVerified: true,
    });
  });

  test("getUserInfo fetches /api/account with the access token", async () => {
    const { impl, calls } = fakeFetch(Response.json(ACCOUNT));
    const custom = buildLichessOAuthConfig({ clientId: "chess-lab", fetch: impl });
    const profile = await custom.getUserInfo?.({ accessToken: "lip_secret" });
    expect(calls[0]?.url).toBe("https://lichess.org/api/account");
    expect(profile).toMatchObject({ id: "thibault", username: "Thibault" });
  });

  test("honours a custom scope set", () => {
    expect(buildLichessOAuthConfig({ clientId: "c", scopes: ["email:read"] }).scopes).toEqual([
      "email:read",
    ]);
  });
});

describe("fetchLichessAccount", () => {
  test("sends a bearer token and maps id, username and ratings", async () => {
    const { impl, calls } = fakeFetch(Response.json(ACCOUNT));
    const account = await fetchLichessAccount("lip_secret", impl);
    const headers = new Headers(calls[0]?.init?.headers as never);
    expect(headers.get("authorization")).toBe("Bearer lip_secret");
    expect(account).toEqual({
      id: "thibault",
      username: "Thibault",
      perfs: {
        blitz: { games: 120, rating: 1850, rd: 60, prog: 12 },
        rapid: { games: 8, rating: 1500, rd: 180, prog: 0, prov: true },
      },
    });
  });

  test("lowercases the id so the subject is stable", async () => {
    const { impl } = fakeFetch(Response.json({ ...ACCOUNT, id: "Thibault" }));
    expect((await fetchLichessAccount("t", impl)).id).toBe("thibault");
  });

  test("rejects a non-OK response without leaking the token", async () => {
    const { impl } = fakeFetch(new Response("nope", { status: 401 }));
    const error = await fetchLichessAccount("lip_secret", impl).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("401");
    expect((error as Error).message).not.toContain("lip_secret");
  });

  test("rejects a body without an id or username", async () => {
    const { impl } = fakeFetch(Response.json({ perfs: {} }));
    await expect(fetchLichessAccount("t", impl)).rejects.toThrow(/id/);
  });
});
