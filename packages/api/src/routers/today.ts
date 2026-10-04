import { enabledCardPillars } from "../features";
import { protectedProcedure } from "../index";
import { createTodayService } from "../services/today-service";

/**
 * Today home summary (ADR-19). The user id comes from the session only. The import status is read
 * from the port without enqueuing a sync: the Today loader already calls `lichess.status`, which
 * owns the auto-sync rule.
 */
export const todayRouter = {
  summary: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const [counts, sync] = await Promise.all([
      createTodayService({ db: context.db }).getCounts(userId, {
        enabledPillars: enabledCardPillars(context.features),
      }),
      context.lichess.status(userId),
    ]);
    return { ...counts, sync };
  }),
};
