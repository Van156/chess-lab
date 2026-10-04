/** Months of history a user's first import covers. Change to widen or narrow the window. */
export const IMPORT_WINDOW_MONTHS = 3;

/** Safety bound on the first import for very active players (the window bounds normal users). */
export const FIRST_IMPORT_MAX_GAMES = 1000;

/** `lichess.status` enqueues a sync when the last one is older than this. */
export const AUTO_SYNC_AFTER_MS = 6 * 60 * 60 * 1000;

/** How long one lease holds the import; every committed batch extends it. */
export const IMPORT_LEASE_MS = 2 * 60 * 1000;

/** Games persisted (and the cursor advanced) per transaction. */
export const IMPORT_BATCH_SIZE = 50;

/**
 * Incremental syncs ask Lichess for games from this long before the cursor. `since` filters by
 * creation time, so a game created before a sync but finished after it would otherwise be missed;
 * the idempotent upsert on `(user_id, lichess_game_id)` absorbs the re-fetched duplicates.
 * Correspondence games are excluded from the import, so a day covers the longest live game.
 */
export const IMPORT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
