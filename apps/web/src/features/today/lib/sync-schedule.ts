import type { SyncStatus } from "./today-types";

/** While an import is running, re-read its status this often. */
export const RUNNING_POLL_MS = 5000;
/** Lower and upper bounds for the backoff poll; it targets just after `retryAt`. */
const BACKOFF_MIN_POLL_MS = 5000;
const BACKOFF_MAX_POLL_MS = 60_000;
const BACKOFF_GRACE_MS = 2000;

const isInFlight = (state: SyncStatus["state"]) => state === "running" || state === "backoff";

/**
 * Whether the due summary may be stale given two consecutive sync observations. Counts change when
 * a sync leaves running/backoff, or when a sync finished between polls (`lastSyncedAt` or
 * `gamesImported` moved). The first observation never refreshes: the summary loads alongside it.
 */
export function shouldRefreshSummary(
  previous: SyncStatus | undefined,
  next: SyncStatus | undefined,
): boolean {
  if (!previous || !next) {
    return false;
  }
  if (isInFlight(previous.state) && !isInFlight(next.state)) {
    return true;
  }
  return (
    previous.gamesImported !== next.gamesImported ||
    previous.lastSyncedAt?.getTime() !== next.lastSyncedAt?.getTime()
  );
}

/**
 * `refetchInterval` for the sync status: 5 s while running; during backoff, until shortly after
 * `retryAt` (bounded to 5-60 s); `false` when nothing is in flight.
 */
export function syncPollInterval(sync: SyncStatus | undefined, now: number): number | false {
  if (sync?.state === "running") {
    return RUNNING_POLL_MS;
  }
  if (sync?.state !== "backoff") {
    return false;
  }
  const untilRetry = sync.retryAt ? sync.retryAt.getTime() - now + BACKOFF_GRACE_MS : 0;
  return Math.min(BACKOFF_MAX_POLL_MS, Math.max(BACKOFF_MIN_POLL_MS, untilRetry));
}
