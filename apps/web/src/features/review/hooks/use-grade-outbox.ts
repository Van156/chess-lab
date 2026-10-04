import { useEffect } from "react";

import { authClient } from "@/app/auth-client";
import { client } from "@/app/orpc";

import { SIGN_OUT_FLUSH_TIMEOUT_MS } from "../config";
import {
  bindFlushTriggers,
  createGradeOutbox,
  flushWithin,
  type GradeOutbox,
} from "../lib/grade-outbox";

const outboxes = new Map<string, GradeOutbox>();

/** One outbox per user for the page's lifetime, so every flush trigger shares a single pass. */
export function getGradeOutbox(userId: string): GradeOutbox {
  let outbox = outboxes.get(userId);
  if (!outbox) {
    outbox = createGradeOutbox({
      userId,
      storage: window.localStorage,
      submit: (entry) => client.review.grade(entry),
    });
    outboxes.set(userId, outbox);
  }
  return outbox;
}

/**
 * Keeps pending grades flowing app-wide: flushes at app start, when the connection returns and
 * when the tab becomes visible (ADR-15). Mounted once in the authenticated layout.
 */
export function useGradeOutboxSync(): void {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    return bindFlushTriggers(getGradeOutbox(userId), window, document);
  }, [userId]);
}

/** Best-effort flush before sign-out; never blocks longer than the timeout. */
export function flushPendingGrades(): Promise<void> {
  const flushAll = Promise.all([...outboxes.values()].map((outbox) => outbox.flush())).then(
    () => undefined,
  );
  return flushWithin({ flush: () => flushAll }, SIGN_OUT_FLUSH_TIMEOUT_MS);
}
