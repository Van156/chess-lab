import { enabledCardPillars } from "../features";
import type { ImportStatus } from "../context";
import { protectedProcedure } from "../index";
import { createTodayService } from "../services/today-service";

/**
 * Today home summary (ADR-19). The user id comes from the session only. The import status is read
 * from the port without enqueuing a sync: the web `useToday` hook's status query already calls
 * `lichess.status`, which owns the auto-sync rule. A failing status read is settled separately:
 * `sync` becomes `null` (the UI shows no sync state) while counts, budget and streak still return.
 * Output: `{ ...TodayCounts, sync: ImportStatus | null }`.
 */
export const todayRouter = {
  summary: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const [counts, sync] = await Promise.all([
      createTodayService({ db: context.db }).getCounts(userId, {
        enabledPillars: enabledCardPillars(context.features),
      }),
      context.lichess.status(userId).then(
        (status): ImportStatus | null => status,
        () => null,
      ),
    ]);
    return { ...counts, sync };
  }),
};
