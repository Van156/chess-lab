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
/** The signed-in user; an outbox only submits while its owner is this user. */
let activeUserId: string | undefined;

function discardOutbox(userId: string) {
  outboxes.get(userId)?.dispose();
  outboxes.delete(userId);
}

/** One outbox per user for the page's lifetime, so every flush trigger shares a single pass. */
export function getGradeOutbox(userId: string): GradeOutbox {
  let outbox = outboxes.get(userId);
  if (!outbox) {
    outbox = createGradeOutbox({
      userId,
      isActive: () => activeUserId === userId,
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
    activeUserId = userId;
    const unbind = bindFlushTriggers(getGradeOutbox(userId), window, document);
    return () => {
      unbind();
      if (activeUserId === userId) activeUserId = undefined;
      discardOutbox(userId);
    };
  }, [userId]);
}

/** Best-effort flush before sign-out; never blocks longer than the timeout. */
export function flushPendingGrades(): Promise<void> {
  const userId = activeUserId;
  const outbox = userId ? outboxes.get(userId) : undefined;
  if (!userId || !outbox) return Promise.resolve();
  return flushWithin(outbox, SIGN_OUT_FLUSH_TIMEOUT_MS).finally(() => discardOutbox(userId));
}
