import type { AppRouterClient } from "@b2c-template/api/routers/index";

/** One hydrated card of `review.queue` (prompt position, accepted answers, game context). */
export type QueueItem = Awaited<ReturnType<AppRouterClient["review"]["queue"]>>[number];
