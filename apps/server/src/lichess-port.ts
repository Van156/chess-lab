import type { GamesSource, ImportService } from "@b2c-template/api/services/import-service";
import type { LichessPort } from "@b2c-template/api/context";
import { LichessUnauthorized } from "@b2c-template/lichess";
import type { LichessClient } from "@b2c-template/lichess";

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
  const { name, body } = error as { name?: unknown; body?: { code?: unknown } | null };
  return name === "APIError" && typeof body?.code === "string"
    ? UNUSABLE_CREDENTIAL_CODES.has(body.code)
    : false;
}

/** `GamesSource` for the import service: looks up the token per run and streams from Lichess. */
export function createGamesSource(
  client: LichessClient,
  resolveToken: AccessTokenResolver,
): GamesSource {
  return {
    async *exportGames(args) {
      let token: string | null;
      try {
        token = await resolveToken(args.userId);
      } catch (error) {
        // Only an unusable stored sign-in (no account, or a refresh that was rejected) means the
        // user must sign in with Lichess again. Anything else (DB error, network timeout, abort)
        // is rethrown unchanged so the import service records a retryable failure.
        if (isUnusableCredentialError(error)) throw new LichessUnauthorized();
        throw error;
      }
      if (!token) {
        throw new LichessUnauthorized();
      }
      const { userId: _userId, ...request } = args;
      yield* client.exportGames({ ...request, token });
    },
  };
}

/** `LichessPort` backed by the import service (reads) and the runner (background syncs). */
export function createLichessPort(
  service: Pick<ImportService, "status">,
  runner: Pick<ImportRunner, "start">,
): LichessPort {
  return {
    status: (userId) => service.status(userId),
    requestSync: (userId) => runner.start(userId),
  };
}
