import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

import { syntheticEmail } from "./synthetic-email";

/**
 * Lichess as a better-auth `generic-oauth` provider (ADR-07). Endpoints and constraints were
 * verified in S0.7: PKCE S256 only, unregistered public client (no secret), no refresh tokens.
 */
export const LICHESS_PROVIDER_ID = "lichess";
export const LICHESS_AUTHORIZATION_URL = "https://lichess.org/oauth";
export const LICHESS_TOKEN_URL = "https://lichess.org/api/token";
export const LICHESS_ACCOUNT_URL = "https://lichess.org/api/account";

/** One speed's rating from `/api/account`; `prov` is present only when the rating is provisional. */
export type LichessPerf = { games: number; rating: number; rd: number; prog: number; prov?: true };

/** The subset of `GET /api/account` this app stores. `id` is the immutable lowercase account id. */
export type LichessAccount = {
  id: string;
  username: string;
  perfs: Record<string, LichessPerf>;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function toPerfs(raw: unknown): Record<string, LichessPerf> {
  const perfs: Record<string, LichessPerf> = {};
  if (typeof raw !== "object" || raw === null) return perfs;
  for (const [speed, value] of Object.entries(raw)) {
    const perf = value as Partial<LichessPerf> | null;
    if (!perf || typeof perf.rating !== "number") continue;
    perfs[speed] = {
      games: perf.games ?? 0,
      rating: perf.rating,
      rd: perf.rd ?? 0,
      prog: perf.prog ?? 0,
      ...(perf.prov ? { prov: true as const } : {}),
    };
  }
  return perfs;
}

/** Reads the signed-in Lichess account. Errors never include the access token. */
export async function fetchLichessAccount(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<LichessAccount> {
  const response = await fetchImpl(LICHESS_ACCOUNT_URL, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Lichess /api/account failed with status ${response.status}`);
  }
  const body = (await response.json()) as { id?: unknown; username?: unknown; perfs?: unknown };
  if (typeof body.id !== "string" || typeof body.username !== "string") {
    throw new Error("Lichess /api/account response is missing the id or username");
  }
  return { id: body.id.toLowerCase(), username: body.username, perfs: toPerfs(body.perfs) };
}

export type LichessOAuthOptions = {
  clientId: string;
  /** Configuration-driven scope set; defaults to none (own-game export needs no scope). */
  scopes?: string[];
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Called with every account `getUserInfo` reads, so callers can persist it without a second call. */
  onAccount?: (account: LichessAccount) => void;
};

export function buildLichessOAuthConfig(options: LichessOAuthOptions): GenericOAuthConfig {
  // Resolved per call so the global `fetch` is never captured at construction time.
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    providerId: LICHESS_PROVIDER_ID,
    name: "Lichess",
    clientId: options.clientId,
    authorizationUrl: LICHESS_AUTHORIZATION_URL,
    tokenUrl: LICHESS_TOKEN_URL,
    scopes: options.scopes ?? [],
    pkce: true,
    authentication: "post",
    getUserInfo: async (tokens) => {
      if (!tokens.accessToken) return null;
      try {
        const account = await fetchLichessAccount(tokens.accessToken, fetchImpl);
        options.onAccount?.(account);
        return {
          ...account,
          name: account.username,
          email: syntheticEmail(account.id),
          emailVerified: true,
        };
      } catch (error) {
        // `null` makes better-auth redirect to the error callback instead of answering 500.
        console.error("[lichess] could not read the account", error);
        return null;
      }
    },
    accountSubject: ({ profile }) => String(profile.id),
    mapProfileToUser: (profile) => ({
      name: String(profile.username),
      email: syntheticEmail(String(profile.id)),
      emailVerified: true,
    }),
    overrideUserInfo: true,
  };
}
