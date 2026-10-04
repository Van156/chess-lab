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

/** `GamesSource` for the import service: looks up the token per run and streams from Lichess. */
export function createGamesSource(
  client: LichessClient,
  resolveToken: AccessTokenResolver,
): GamesSource {
  return {
    async *exportGames(args) {
      const token = await resolveToken(args.userId);
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
