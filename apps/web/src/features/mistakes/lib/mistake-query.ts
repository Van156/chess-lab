import { isNotFound } from "./mistake-format";

/** TanStack Query's default retry budget, kept for errors that may be transient. */
export const MISTAKE_MAX_RETRIES = 3;

/**
 * Retry predicate for loading one mistake. `NOT_FOUND` is an answer, not a fault: retrying it would
 * hold the "Mistake not found" page behind the full backoff. Anything else may be transient.
 */
export const shouldRetryMistake = (failureCount: number, error: unknown): boolean =>
  !isNotFound(error) && failureCount < MISTAKE_MAX_RETRIES;
