import type { Grade } from "@b2c-template/study";

import { OUTBOX_BACKOFF_BASE_MS, OUTBOX_BACKOFF_MAX_MS, OUTBOX_MAX_ATTEMPTS } from "../config";

/** One grade waiting to reach the server; `reviewLogId` is the server idempotency key (ADR-15). */
export type GradeEntry = {
  reviewLogId: string;
  cardId: string;
  grade: Grade;
  elapsedMs: number;
  /** ISO 8601 with offset: the entry must survive JSON storage. */
  reviewedAt: string;
};

export type GradeInput = Omit<GradeEntry, "reviewLogId">;

/** The slice of `Storage` the outbox needs, so tests use a fake. */
export type OutboxStorage = Pick<Storage, "getItem" | "setItem">;

export type GradeOutboxDeps = {
  userId: string;
  storage: OutboxStorage;
  /** Sends one grade (`client.review.grade`); rejects on failure. */
  submit: (entry: GradeEntry) => Promise<unknown>;
  newId?: () => string;
  /** True while this user's session is the live one; an inactive outbox never submits. */
  isActive?: () => boolean;
  /** Runs `run` once after `delayMs` and returns a canceller; defaults to `setTimeout`. */
  schedule?: (run: () => void, delayMs: number) => void | (() => void);
  log?: (message: string, detail?: unknown) => void;
};

export type GradeOutbox = {
  /** Persists synchronously, so the grade survives an immediate tab close. */
  append: (input: GradeInput) => GradeEntry;
  pending: () => GradeEntry[];
  /** Sends pending entries in order; concurrent calls share one pass. */
  flush: () => Promise<void>;
  /** Cancels any pending retry; later flushes do nothing. The queue stays in storage. */
  dispose: () => void;
};

/** One queue per user, so a shared browser never sends another account's grades. */
export function outboxKey(userId: string): string {
  return `chesslab.grade-outbox.v1.${userId}`;
}

/** Delay before retry number `attempt` (1-based): doubles from the base, capped. */
export function backoffDelay(attempt: number): number {
  return Math.min(OUTBOX_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1), OUTBOX_BACKOFF_MAX_MS);
}

/** Server rejections that no retry can fix: card deleted, invalid input, id owned elsewhere. */
const NON_RETRYABLE_CODES = new Set(["NOT_FOUND", "BAD_REQUEST", "CONFLICT"]);

export function isNonRetryableGradeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return typeof error.code === "string" && NON_RETRYABLE_CODES.has(error.code);
}

/**
 * Failures that say nothing about the grade itself: no server answer (network) or a signed-out
 * session. They are retried forever and never count towards `OUTBOX_MAX_ATTEMPTS`.
 */
function isTransientGradeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return true;
  return typeof error.code !== "string" || error.code === "UNAUTHORIZED";
}

function isGradeEntry(value: unknown): value is GradeEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.reviewLogId === "string" &&
    typeof entry.cardId === "string" &&
    typeof entry.grade === "number" &&
    typeof entry.elapsedMs === "number" &&
    typeof entry.reviewedAt === "string"
  );
}

export function createGradeOutbox({
  userId,
  storage,
  submit,
  newId = () => crypto.randomUUID(),
  isActive = () => true,
  schedule = (run, delayMs) => {
    const timer = setTimeout(run, delayMs);
    return () => clearTimeout(timer);
  },
  log = (message, detail) => console.warn(`[grade-outbox] ${message}`, detail),
}: GradeOutboxDeps): GradeOutbox {
  const key = outboxKey(userId);
  let inFlight: Promise<void> | null = null;
  let retryScheduled = false;
  let failures = 0;
  let disposed = false;
  let cancelRetry: void | (() => void);
  // In-memory safety nets for a storage that fails; none of them is ever persisted.
  /** Grades `append` could not persist; `drain` still sends them while the tab lives. */
  const unpersisted: GradeEntry[] = [];
  /** Grades already sent whose removal could not be written; `readStored` hides them. */
  const acknowledged = new Set<string>();
  /** Consecutive server failures per grade. */
  const attempts = new Map<string, number>();
  /**
   * Grades the server keeps failing: skipped for the rest of the session so they do not block
   * later grades. They stay in storage (and in `pending`), so the next session tries them again.
   */
  const setAside = new Set<string>();

  function readStored(): GradeEntry[] {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isGradeEntry).filter((entry) => !acknowledged.has(entry.reviewLogId));
      }
      log("stored queue is not a list; treating it as empty");
    } catch (error) {
      log("stored queue is unreadable; treating it as empty", error);
    }
    return [];
  }

  /** Stored entries plus the ones that never reached storage, oldest first. */
  function read(): GradeEntry[] {
    return [...readStored(), ...unpersisted];
  }

  function write(entries: GradeEntry[]): boolean {
    try {
      storage.setItem(key, JSON.stringify(entries));
      return true;
    } catch (error) {
      log("could not persist the queue", error);
      return false;
    }
  }

  /** Re-reads before writing, so a grade appended mid-flush (or by another tab) is kept. */
  function remove(reviewLogId: string) {
    attempts.delete(reviewLogId);
    setAside.delete(reviewLogId);
    const index = unpersisted.findIndex((entry) => entry.reviewLogId === reviewLogId);
    if (index >= 0) unpersisted.splice(index, 1);
    if (!write(readStored().filter((entry) => entry.reviewLogId !== reviewLogId))) {
      // Without this the next pass would resubmit the same head forever.
      acknowledged.add(reviewLogId);
    }
  }

  function append(input: GradeInput): GradeEntry {
    const entry: GradeEntry = { reviewLogId: newId(), ...input };
    if (!write([...readStored(), entry])) {
      log("keeping the grade in memory only; it is lost if the tab closes before it is sent", {
        reviewLogId: entry.reviewLogId,
      });
      unpersisted.push(entry);
    }
    return entry;
  }

  function scheduleRetry() {
    if (retryScheduled) return;
    retryScheduled = true;
    failures += 1;
    cancelRetry = schedule(() => {
      retryScheduled = false;
      void flush();
    }, backoffDelay(failures));
  }

  async function drain() {
    const next = () => read().find((entry) => !setAside.has(entry.reviewLogId));
    for (let head = next(); head; head = next()) {
      if (disposed || !isActive()) return;
      try {
        await submit(head);
      } catch (error) {
        if (isNonRetryableGradeError(error)) {
          log("dropping a grade the server rejected", { reviewLogId: head.reviewLogId, error });
          remove(head.reviewLogId);
          continue;
        }
        if (isTransientGradeError(error)) {
          // The server did not answer, so earlier server failures no longer count as consecutive.
          attempts.delete(head.reviewLogId);
        } else {
          const count = (attempts.get(head.reviewLogId) ?? 0) + 1;
          attempts.set(head.reviewLogId, count);
          if (count >= OUTBOX_MAX_ATTEMPTS) {
            log("setting aside a grade the server keeps failing; it stays queued", {
              reviewLogId: head.reviewLogId,
              error,
            });
            setAside.add(head.reviewLogId);
            continue;
          }
        }
        scheduleRetry();
        return;
      }
      failures = 0;
      remove(head.reviewLogId);
    }
  }

  function flush(): Promise<void> {
    if (disposed) return Promise.resolve();
    inFlight ??= drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function dispose() {
    disposed = true;
    retryScheduled = false;
    if (cancelRetry) cancelRetry();
  }

  return { append, pending: read, flush, dispose };
}

/**
 * Flushes at app start (now), when the connection returns and when the tab becomes visible
 * (ADR-15). Returns the function that removes the listeners.
 */
export function bindFlushTriggers(
  outbox: Pick<GradeOutbox, "flush">,
  win: EventTarget,
  doc: EventTarget & Pick<Document, "visibilityState">,
): () => void {
  const flush = () => void outbox.flush();
  const onVisibility = () => {
    if (doc.visibilityState === "visible") flush();
  };
  win.addEventListener("online", flush);
  doc.addEventListener("visibilitychange", onVisibility);
  flush();
  return () => {
    win.removeEventListener("online", flush);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

/** Best-effort flush for sign-out: resolves when the queue is sent or after `timeoutMs`. */
export async function flushWithin(
  outbox: Pick<GradeOutbox, "flush">,
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([outbox.flush().catch(() => {}), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
