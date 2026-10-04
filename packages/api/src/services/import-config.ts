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
