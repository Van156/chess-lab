import type { AppRouterClient } from "@b2c-template/api/routers/index";

/** What `today.summary` returns (due counts, new budget, streak, sync status). */
export type TodaySummary = Awaited<ReturnType<AppRouterClient["today"]["summary"]>>;

/** Lichess import status as the server reports it (`today.summary.sync`, `lichess.status`). */
export type SyncStatus = TodaySummary["sync"];
