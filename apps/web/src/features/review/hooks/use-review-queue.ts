import type { Grade } from "@b2c-template/study";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer } from "react";

import { client, orpc } from "@/app/orpc";

import type { GradeOutbox } from "../lib/grade-outbox";
import {
  currentItem,
  elapsedSince,
  initSession,
  pageRequestSize,
  progressOf,
  reduceSession,
  sessionPhase,
  shouldFetchMore,
  summarize,
} from "../lib/review-queue";
import type { QueueItem } from "../lib/review-types";

/** A queue fetched this recently is reused (Today's hover prefetch); older is refetched. */
const FIRST_PAGE_STALE_MS = 30_000;

/**
 * First page of the queue. It uses the same query key and input (`{}`) as the Today prefetch, so
 * "Start review" renders from cache when the user hovered or focused it first.
 */
export function useFirstPage() {
  const query = useQuery({
    ...orpc.review.queue.queryOptions({ input: {} }),
    staleTime: FIRST_PAGE_STALE_MS,
    refetchOnWindowFocus: false,
  });
  return { items: query.data, isPending: query.isPending, retry: () => void query.refetch() };
}

/**
 * The review session queue (ADR-14, ADR-15). The first page seeds an in-memory queue, so the next
 * card renders synchronously from memory; later pages are fetched while fewer than the prefetch
 * threshold remain. Grading writes to the outbox and advances at once, never waiting on the
 * network; an Again card is re-shown optimistically (see `review-queue.ts`). Later refetches of
 * the first page are ignored on purpose: the session owns its queue once it has started.
 */
export function useReviewQueue(initialItems: readonly QueueItem[], outbox: GradeOutbox) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reduceSession, undefined, () =>
    initSession(initialItems, Date.now()),
  );

  useEffect(() => {
    if (!shouldFetchMore(state)) return;
    const requested = pageRequestSize(state);
    dispatch({ type: "pageRequested" });
    client.review.queue({ limit: requested }).then(
      (items) => dispatch({ type: "pageLoaded", items, requested }),
      () => dispatch({ type: "pageFailed" }),
    );
  }, [state]);

  function grade(value: Grade) {
    const item = currentItem(state);
    if (!item) return;
    const now = Date.now();
    outbox.append({
      cardId: item.cardId,
      grade: value,
      elapsedMs: elapsedSince(state.shownAt, now),
      reviewedAt: new Date(now).toISOString(),
    });
    void outbox.flush();
    if (state.history.length === 0) {
      // The cached first page and Today's counts are now out of date; refetch on next use.
      void queryClient.invalidateQueries({
        queryKey: orpc.review.queue.key(),
        refetchType: "none",
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.today.summary.key(),
        refetchType: "none",
      });
    }
    dispatch({ type: "graded", grade: value, now });
  }

  return {
    phase: sessionPhase(state),
    card: currentItem(state),
    progress: progressOf(state),
    summary: summarize(state.history),
    grade,
    retryPage: () => dispatch({ type: "pageRetry" }),
  };
}
