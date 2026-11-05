/** Cards requested per queue page; matches the server default of `review.queue` (ADR-14). */
export const QUEUE_PAGE_SIZE = 50;
/** A next page is fetched while fewer than this many cards remain (ADR-14). */
export const QUEUE_PREFETCH_THRESHOLD = 10;
// `QUEUE_MAX_PAGE_SIZE` and `MAX_ELAPSED_MS` (the server caps) come from `@b2c-template/study`,
// the single source shared with the `review` router.

/** An Again card comes back after this many other cards (fewer when the queue is short). */
export const RESHOW_GAP = 3;
/** An optimistic Again card is re-shown in this session only when it is due within this window. */
export const RESHOW_WINDOW_MS = 15 * 60_000;

/** Outbox retry backoff: base doubles per consecutive failure up to the cap (ADR-15). */
export const OUTBOX_BACKOFF_BASE_MS = 2_000;
export const OUTBOX_BACKOFF_MAX_MS = 60_000;
/** Server failures (not network, not signed-out) tolerated per grade before it is set aside. */
export const OUTBOX_MAX_ATTEMPTS = 5;
/** Sign-out waits at most this long for pending grades before it proceeds. */
export const SIGN_OUT_FLUSH_TIMEOUT_MS = 3_000;
