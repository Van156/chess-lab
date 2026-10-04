import type { Grade } from "@b2c-template/study";

import { OUTBOX_BACKOFF_BASE_MS, OUTBOX_BACKOFF_MAX_MS } from "../config";

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
  /** Runs `run` once after `delayMs`; defaults to `setTimeout`. */
  schedule?: (run: () => void, delayMs: number) => void;
  log?: (message: string, detail?: unknown) => void;
};

export type GradeOutbox = {
  /** Persists synchronously, so the grade survives an immediate tab close. */
  append: (input: GradeInput) => GradeEntry;
  pending: () => GradeEntry[];
  /** Sends pending entries in order; concurrent calls share one pass. */
  flush: () => Promise<void>;
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
  schedule = (run, delayMs) => void setTimeout(run, delayMs),
  log = (message, detail) => console.warn(`[grade-outbox] ${message}`, detail),
}: GradeOutboxDeps): GradeOutbox {
  const key = outboxKey(userId);
  let inFlight: Promise<void> | null = null;
  let retryScheduled = false;
  let failures = 0;

  function read(): GradeEntry[] {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isGradeEntry);
      log("stored queue is not a list; treating it as empty");
    } catch (error) {
      log("stored queue is unreadable; treating it as empty", error);
    }
    return [];
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
    write(read().filter((entry) => entry.reviewLogId !== reviewLogId));
  }

  function append(input: GradeInput): GradeEntry {
    const entry: GradeEntry = { reviewLogId: newId(), ...input };
    write([...read(), entry]);
    return entry;
  }

  function scheduleRetry() {
    if (retryScheduled) return;
    retryScheduled = true;
    failures += 1;
    schedule(() => {
      retryScheduled = false;
      void flush();
    }, backoffDelay(failures));
  }

  async function drain() {
    for (let head = read()[0]; head; head = read()[0]) {
      try {
        await submit(head);
      } catch (error) {
        if (isNonRetryableGradeError(error)) {
          log("dropping a grade the server rejected", { reviewLogId: head.reviewLogId, error });
          remove(head.reviewLogId);
          continue;
        }
        scheduleRetry();
        return;
      }
      failures = 0;
      remove(head.reviewLogId);
    }
  }

  function flush(): Promise<void> {
    inFlight ??= drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return { append, pending: read, flush };
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
