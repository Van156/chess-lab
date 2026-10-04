import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { auditRouter } from "./audit";
import { lichessRouter } from "./lichess";
import { platformRouter } from "./platform";
import { reviewRouter } from "./review";
import { settingsRouter } from "./settings";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  // Platform-admin example demonstrating platformProcedure.
  platform: platformRouter,
  // Audit activity log: audit.list (the caller's own security log) and platform audit views.
  audit: auditRouter,
  // Lichess import status and manual sync.
  lichess: lichessRouter,
  // Review queue and idempotent grading.
  review: reviewRouter,
  // Per-user settings (daily new-card limit, time zone).
  settings: settingsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
