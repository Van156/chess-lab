import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { analysisRouter } from "./analysis";
import { auditRouter } from "./audit";
import { gamesRouter } from "./games";
import { lichessRouter } from "./lichess";
import { mistakesRouter } from "./mistakes";
import { platformRouter } from "./platform";
import { reviewRouter } from "./review";
import { settingsRouter } from "./settings";
import { todayRouter } from "./today";

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
  // Game analysis: next game, evaluation upload, classification into mistakes and cards.
  analysis: analysisRouter,
  // Imported games: cursor list with analysis status, detail with PGN.
  games: gamesRouter,
  // Classified mistakes: cursor list and detail with the game.
  mistakes: mistakesRouter,
  // Review queue and idempotent grading.
  review: reviewRouter,
  // Per-user settings (daily new-card limit, time zone).
  settings: settingsRouter,
  // Today home: due counts, new-card budget, streak and import status.
  today: todayRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
