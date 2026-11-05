/** Public API of the Today feature. Everything else is internal. */
export { default as TodayPage } from "./components/today-page";
/** Lichess sync presentation, shared with the Games screen so both show the same status and messages. */
export { default as SyncStatus } from "./components/sync-status";
export { useNow } from "./hooks/use-now";
export { shouldRefreshSummary, syncPollInterval } from "./lib/sync-schedule";
export { describeSync, type SyncDescription } from "./lib/today-view-model";
