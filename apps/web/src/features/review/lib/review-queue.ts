import {
  CARD_STATE,
  LEARNING_CARD_STATES,
  MAX_ELAPSED_MS,
  QUEUE_MAX_PAGE_SIZE,
  grade as scheduleGrade,
  newCardState,
  type CardState,
  type Grade,
} from "@b2c-template/study";

import { QUEUE_PAGE_SIZE, QUEUE_PREFETCH_THRESHOLD, RESHOW_GAP, RESHOW_WINDOW_MS } from "../config";
import type { QueueItem } from "./review-types";

/** One grade given in this session (an Again card can appear more than once). */
export type GradedCard = { cardId: string; grade: Grade; elapsedMs: number };

/** In-memory session queue (ADR-14): the head of `upcoming` is the card on screen. */
export type SessionState = {
  upcoming: readonly QueueItem[];
  /** Every card id ever loaded, so a later page never repeats a card. */
  seen: Readonly<Record<string, true>>;
  history: readonly GradedCard[];
  /** True once the server has no more cards to give. */
  exhausted: boolean;
  loading: boolean;
  /** A page request failed; paging pauses until the next grade. */
  pageFailed: boolean;
  /** When the current card appeared, for `elapsedMs`. */
  shownAt: number;
};

export type SessionAction =
  | { type: "graded"; grade: Grade; now: number }
  | { type: "pageRequested" }
  | { type: "pageLoaded"; items: readonly QueueItem[]; requested: number }
  | { type: "pageFailed" }
  | { type: "pageRetry" };

function seenIds(items: readonly QueueItem[]): Record<string, true> {
  return Object.fromEntries(items.map((entry) => [entry.cardId, true as const]));
}

export function initSession(items: readonly QueueItem[], now: number): SessionState {
  return {
    upcoming: items,
    seen: seenIds(items),
    history: [],
    exhausted: items.length < QUEUE_PAGE_SIZE,
    loading: false,
    pageFailed: false,
    shownAt: now,
  };
}

export function currentItem(state: SessionState): QueueItem | null {
  return state.upcoming[0] ?? null;
}

/** Whole milliseconds on the card, within what `review.grade` accepts. */
export function elapsedSince(shownAt: number, now: number): number {
  return Math.min(MAX_ELAPSED_MS, Math.max(0, Math.round(now - shownAt)));
}

/**
 * The queue item only carries state and due date, so the rest of the card is a neutral stand-in:
 * the scheduler is only asked what an Again does, and the server stays authoritative.
 */
function cardStateOf(item: QueueItem, now: Date): CardState {
  const fresh = newCardState(now);
  if (item.state === CARD_STATE.New) return fresh;
  return {
    ...fresh,
    state: item.state,
    due: item.due,
    stability: 1,
    difficulty: 5,
    reps: 1,
    lastReview: item.due,
  };
}

/** The Again card as the scheduler would see it, or null when it is not due again this session. */
function reshowAfterAgain(item: QueueItem, now: number): QueueItem | null {
  const at = new Date(now);
  const { next } = scheduleGrade(cardStateOf(item, at), 1, at);
  const learning = LEARNING_CARD_STATES.some((state) => state === next.state);
  if (!learning || next.due.getTime() - now > RESHOW_WINDOW_MS) return null;
  return { ...item, state: next.state, due: next.due };
}

function applyGrade(state: SessionState, grade: Grade, now: number): SessionState {
  const [head, ...rest] = state.upcoming;
  if (!head) return state;
  const reshown = grade === 1 ? reshowAfterAgain(head, now) : null;
  const upcoming = reshown
    ? [...rest.slice(0, RESHOW_GAP), reshown, ...rest.slice(RESHOW_GAP)]
    : rest;
  return {
    ...state,
    upcoming,
    history: [
      ...state.history,
      { cardId: head.cardId, grade, elapsedMs: elapsedSince(state.shownAt, now) },
    ],
    pageFailed: false,
    shownAt: now,
  };
}

function applyPage(
  state: SessionState,
  items: readonly QueueItem[],
  requested: number,
): SessionState {
  const fresh = items.filter((entry) => !state.seen[entry.cardId]);
  return {
    ...state,
    upcoming: [...state.upcoming, ...fresh],
    seen: { ...state.seen, ...seenIds(fresh) },
    // Nothing new in a full page means the server only has cards this session already holds.
    exhausted: items.length < requested || fresh.length === 0,
    loading: false,
    pageFailed: false,
  };
}

export function reduceSession(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "graded":
      return applyGrade(state, action.grade, action.now);
    case "pageRequested":
      return { ...state, loading: true };
    case "pageLoaded":
      return applyPage(state, action.items, action.requested);
    case "pageFailed":
      return { ...state, loading: false, pageFailed: true };
    case "pageRetry":
      return { ...state, pageFailed: false };
  }
}

export function shouldFetchMore(state: SessionState): boolean {
  return (
    !state.exhausted &&
    !state.loading &&
    !state.pageFailed &&
    state.upcoming.length < QUEUE_PREFETCH_THRESHOLD
  );
}

/**
 * The server has no offset, so a page can repeat cards graded here whose grade has not been
 * flushed yet; asking for that many extra cards leaves room for new ones after the repeats are
 * skipped.
 */
export function pageRequestSize(state: SessionState): number {
  return Math.min(QUEUE_MAX_PAGE_SIZE, QUEUE_PAGE_SIZE + state.history.length);
}

export function progressOf(state: SessionState): { done: number; total: number } {
  return { done: state.history.length, total: state.history.length + state.upcoming.length };
}

export type SessionSummary = {
  cards: number;
  answers: number;
  byGrade: Record<Grade, number>;
  durationMs: number;
};

export function summarize(history: readonly GradedCard[]): SessionSummary {
  const byGrade: Record<Grade, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const entry of history) byGrade[entry.grade] += 1;
  return {
    cards: new Set(history.map((entry) => entry.cardId)).size,
    answers: history.length,
    byGrade,
    durationMs: history.reduce((total, entry) => total + entry.elapsedMs, 0),
  };
}

/** What the screen shows: a card, a wait for the next page, a paging failure, or the end. */
export type SessionPhase = "card" | "waiting" | "failed" | "done";

export function sessionPhase(state: SessionState): SessionPhase {
  if (state.upcoming.length > 0) return "card";
  if (state.exhausted) return "done";
  return state.pageFailed ? "failed" : "waiting";
}
