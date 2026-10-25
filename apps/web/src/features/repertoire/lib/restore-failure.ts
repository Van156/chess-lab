/** What to tell the user about a failed restore, and whether the entry may be tried again. */
export type RestoreFailure = { message: string; retryable: boolean };

const CONFLICT_MESSAGES: Record<string, string> = {
  parent_missing: "Can't undo: the move it came from was deleted.",
  edge_exists: "Can't undo: that move was added again.",
  move_exists: "Can't undo: that move already exists.",
  position_conflict: "Can't undo: the position changed since.",
};

const field = (error: unknown, key: string): unknown =>
  typeof error === "object" && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

const TRANSIENT_CODES = new Set(["TOO_MANY_REQUESTS", "TIMEOUT"]);

/** True for the `CONFLICT` that says the deleted move is already back in the tree. */
export function isMoveExistsConflict(error: unknown): boolean {
  return (
    field(error, "code") === "CONFLICT" && field(field(error, "data"), "reason") === "move_exists"
  );
}

/**
 * Maps a `restoreDeleted` error to a short message. Only a failure that may pass is retryable: a
 * network error (no code), a 5xx, a rate limit or a timeout. Every other answer is final, so the
 * snapshot is dropped instead of failing again.
 */
export function describeRestoreFailure(error: unknown): RestoreFailure {
  const code = field(error, "code");
  const status = field(error, "status");
  if (
    typeof code !== "string" ||
    TRANSIENT_CODES.has(code) ||
    (typeof status === "number" && status >= 500)
  ) {
    return { message: "Couldn't undo. Try again.", retryable: true };
  }
  switch (code) {
    case "CONFLICT": {
      const reason = field(field(error, "data"), "reason");
      return {
        message:
          (typeof reason === "string" ? CONFLICT_MESSAGES[reason] : undefined) ??
          "Can't undo: the repertoire changed since.",
        retryable: false,
      };
    }
    case "BAD_REQUEST":
      return {
        message: "Can't undo: this deletion can no longer be restored.",
        retryable: false,
      };
    case "NOT_FOUND":
      return { message: "Can't undo: this repertoire is no longer available.", retryable: false };
    case "UNAUTHORIZED":
    case "FORBIDDEN":
      return {
        message: "Can't undo: you are not allowed to change this repertoire.",
        retryable: false,
      };
    default:
      return { message: "Can't undo right now.", retryable: false };
  }
}
