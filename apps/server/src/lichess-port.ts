import type { GamesSource, ImportService } from "@b2c-template/api/services/import-service";
import type { ExplorerResult, LichessPort } from "@b2c-template/api/context";
import { EXPLORER_WAIT_MS, LichessRateLimited, LichessUnauthorized } from "@b2c-template/lichess";
import type { ExplorerStats, LichessClient } from "@b2c-template/lichess";

import type { createExplorerCache } from "./explorer-cache";
import type { ImportRunner } from "./import-runner";

/**
 * Resolves the user's Lichess access token on the server (`auth.api.getAccessToken`, decrypted
 * from the account row). The token never leaves this process: it goes into the Lichess request
 * and nowhere else.
 */
export type AccessTokenResolver = (userId: string) => Promise<string | null>;

/**
 * better-auth 1.7.5 `getAccessToken` throws an `APIError` (`BAD_REQUEST`, `body.code`) when the
 * account is missing or its refresh failed. It wraps every failure inside the refresh step under
 * `FAILED_TO_GET_ACCESS_TOKEN`, so those are treated as a rejected refresh.
 */
const UNUSABLE_CREDENTIAL_CODES = new Set([
  "ACCOUNT_NOT_FOUND",
  "FAILED_TO_GET_ACCESS_TOKEN",
  "REFRESH_TOKEN_NOT_FOUND",
]);

function isUnusableCredentialError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, body } = error as {
    name?: unknown;
    body?: { code?: unknown } | null;
  };
  return name === "APIError" && typeof body?.code === "string"
    ? UNUSABLE_CREDENTIAL_CODES.has(body.code)
    : false;
}

/**
 * The user's token, or `LichessUnauthorized` when there is none or the stored sign-in is
 * unusable (no account, or a refresh that was rejected): the user must sign in with Lichess
 * again. Any other resolver failure (DB error, network timeout, abort) is rethrown unchanged.
 */
async function requireAccessToken(resolveToken: AccessTokenResolver, userId: string) {
  let token: string | null;
  try {
    token = await resolveToken(userId);
  } catch (error) {
    if (isUnusableCredentialError(error)) throw new LichessUnauthorized();
    throw error;
  }
  if (!token) throw new LichessUnauthorized();
  return token;
}

/** `GamesSource` for the import service: looks up the token per run and streams from Lichess. */
export function createGamesSource(
  client: LichessClient,
  resolveToken: AccessTokenResolver,
): GamesSource {
  return {
    async *exportGames(args) {
      const token = await requireAccessToken(resolveToken, args.userId);
      const { userId: _userId, ...request } = args;
      yield* client.exportGames({ ...request, token });
    },
  };
}

export type ExplorerPortDeps = {
  client: Pick<LichessClient, "explorer">;
  resolveToken: AccessTokenResolver;
  /** Shared across users: explorer data is public. */
  cache: Pick<ReturnType<typeof createExplorerCache<ExplorerStats>>, "get" | "peek">;
  /** Longest wait for an answer before serving stale or giving up. */
  waitMs?: number;
  setTimer?: (fire: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

const TIMED_OUT = Symbol("explorer-timed-out");

function unavailable(reason: Extract<ExplorerResult, { status: "unavailable" }>["reason"]) {
  return { status: "unavailable", reason } as const;
}

/**
 * `LichessPort.explorer`: resolves the caller's token first (a linked account is required, also
 * for cached positions), then asks the shared cache, which calls Lichess through the per-token
 * gate only on a miss. Waits at most `waitMs`; the load keeps running and fills the cache. Never
 * throws, and the token never leaves this function.
 */
export function createExplorerPort({
  client,
  resolveToken,
  cache,
  waitMs = EXPLORER_WAIT_MS,
  setTimer = (fire, ms) => setTimeout(fire, ms),
  clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: ExplorerPortDeps): LichessPort["explorer"] {
  return async (userId, query) => {
    let token: string;
    try {
      token = await requireAccessToken(resolveToken, userId);
    } catch (error) {
      return unavailable(error instanceof LichessUnauthorized ? "unauthorized" : "error");
    }

    const key = `${query.positionKey}|${query.band}|${query.speeds.join(",")}`;
    const request = cache.get(key, () =>
      client.explorer({
        fen: query.fen,
        ratings: [query.band],
        speeds: [...query.speeds],
        token,
      }),
    );
    // If the deadline wins, the load outlives this call: its failure must not go unhandled.
    request.catch(() => {});

    let timer: unknown;
    const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimer(() => resolve(TIMED_OUT), waitMs);
    });
    try {
      const outcome = await Promise.race([request, deadline]);
      if (outcome === TIMED_OUT) {
        const stored = cache.peek(key);
        return stored
          ? { status: "ok", stats: stored.value, stale: stored.stale }
          : unavailable("timeout");
      }
      return { status: "ok", stats: outcome.value, stale: outcome.stale };
    } catch (error) {
      if (error instanceof LichessRateLimited) return unavailable("rate_limited");
      if (error instanceof LichessUnauthorized) return unavailable("unauthorized");
      return unavailable("error");
    } finally {
      clearTimer(timer);
    }
  };
}

/** `LichessPort` backed by the import service (reads), the runner (background syncs) and the explorer adapter. */
export function createLichessPort(
  service: Pick<ImportService, "status">,
  runner: Pick<ImportRunner, "start">,
  explorer: LichessPort["explorer"],
): LichessPort {
  return {
    explorer,
    status: (userId) => service.status(userId),
    requestSync: (userId) => runner.start(userId),
  };
}
