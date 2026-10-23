/** TanStack Query's default retry budget, kept for errors that may be transient. */
export const REPERTOIRE_MAX_RETRIES = 3;

/** True for an oRPC `NOT_FOUND` error (unknown repertoire, someone else's, or the pillar flag off). */
export function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "NOT_FOUND"
  );
}

/** `NOT_FOUND` is an answer, not a fault: retrying it would only delay the "not found" screen. */
export const shouldRetryRepertoire = (failureCount: number, error: unknown): boolean =>
  !isNotFound(error) && failureCount < REPERTOIRE_MAX_RETRIES;
