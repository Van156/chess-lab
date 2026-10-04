import { protectedProcedure } from "../index";
import { shouldAutoSync } from "../services/import-service";

/**
 * Lichess import status and sync (ADR-10, ADR-19). Both act only on the session user: the user id
 * comes from the session, never from input, so there is nothing to forge.
 */
export const lichessRouter = {
  /** Current import status; enqueues a background sync first when the last one is stale. */
  status: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const current = await context.lichess.status(userId);
    return shouldAutoSync(current, Date.now()) ? context.lichess.requestSync(userId) : current;
  }),
  /** Manual "Sync now". The port never throws for "already running"; it returns the status. */
  sync: protectedProcedure.handler(({ context }) =>
    context.lichess.requestSync(context.session.user.id),
  ),
};
