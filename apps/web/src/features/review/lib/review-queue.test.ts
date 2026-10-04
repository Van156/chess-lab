import { describe, expect, test } from "bun:test";

import {
  QUEUE_MAX_PAGE_SIZE,
  QUEUE_PAGE_SIZE,
  QUEUE_PREFETCH_THRESHOLD,
  RESHOW_GAP,
} from "../config";
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
} from "./review-queue";
import type { QueueItem } from "./review-types";

const NOW = Date.parse("2026-10-04T12:00:00Z");

function item(id: string, state: QueueItem["state"] = 2): QueueItem {
  return {
    cardId: id,
    pillar: "mistakes",
    state,
    due: new Date(NOW - 3_600_000),
    prompt: {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      orientation: "white",
    },
    answers: [{ san: "e4", uci: "e2e4" }],
    context: { playedSan: "a3", gameId: "g1", evalLossCp: 120, ply: 1 },
  };
}

const items = (count: number, prefix = "c") =>
  Array.from({ length: count }, (_, index) => item(`${prefix}${index + 1}`));
const ids = (list: readonly QueueItem[]) => list.map((entry) => entry.cardId);

describe("initSession", () => {
  test("a short first page is the whole queue; a full page may have more", () => {
    expect(initSession(items(3), NOW).exhausted).toBe(true);
    expect(initSession(items(QUEUE_PAGE_SIZE), NOW).exhausted).toBe(false);
  });

  test("starts on the first card", () => {
    expect(currentItem(initSession(items(2), NOW))?.cardId).toBe("c1");
    expect(currentItem(initSession([], NOW))).toBeNull();
  });
});

describe("grading", () => {
  test("advances to the next card and records the grade with the elapsed time", () => {
    const state = reduceSession(initSession(items(3), NOW), {
      type: "graded",
      grade: 3,
      now: NOW + 4_000,
    });
    expect(currentItem(state)?.cardId).toBe("c2");
    expect(state.history).toEqual([{ cardId: "c1", grade: 3, elapsedMs: 4_000 }]);
    expect(state.shownAt).toBe(NOW + 4_000);
  });

  test("grading an empty session changes nothing", () => {
    const state = initSession([], NOW);
    expect(reduceSession(state, { type: "graded", grade: 3, now: NOW })).toBe(state);
  });

  test("elapsed time is clamped to what the server accepts", () => {
    expect(elapsedSince(NOW, NOW - 5)).toBe(0);
    expect(elapsedSince(NOW, NOW + 10_000_000)).toBe(3_600_000);
    expect(elapsedSince(NOW, NOW + 1_234.6)).toBe(1_235);
  });

  test("Again re-shows the card after a few others, with an optimistic learning state", () => {
    const state = reduceSession(initSession(items(6), NOW), { type: "graded", grade: 1, now: NOW });
    expect(RESHOW_GAP).toBe(3);
    expect(ids(state.upcoming)).toEqual(["c2", "c3", "c4", "c1", "c5", "c6"]);
    const reshown = state.upcoming[RESHOW_GAP];
    expect(reshown?.cardId).toBe("c1");
    expect(reshown?.state).toBe(3);
    expect(reshown && reshown.due.getTime() - NOW).toBeLessThanOrEqual(15 * 60_000);
  });

  test("Again on a short queue re-shows at the end", () => {
    const state = reduceSession(initSession(items(2), NOW), { type: "graded", grade: 1, now: NOW });
    expect(ids(state.upcoming)).toEqual(["c2", "c1"]);
  });

  test.each([0, 1, 2, 3] as const)(
    "Again on a card in state %i is re-shown in learning",
    (from) => {
      const state = reduceSession(initSession([item("x", from)], NOW), {
        type: "graded",
        grade: 1,
        now: NOW,
      });
      expect(state.upcoming).toHaveLength(1);
      expect([1, 3]).toContain(state.upcoming[0]?.state);
    },
  );

  test.each([2, 3, 4] as const)("grade %i does not re-show a review card", (grade) => {
    const state = reduceSession(initSession(items(2), NOW), { type: "graded", grade, now: NOW });
    expect(ids(state.upcoming)).toEqual(["c2"]);
  });
});

describe("paging", () => {
  test("fetches the next page while fewer than the threshold remain", () => {
    expect(shouldFetchMore(initSession(items(QUEUE_PREFETCH_THRESHOLD - 1), NOW))).toBe(false);
    const full = initSession(items(QUEUE_PAGE_SIZE), NOW);
    expect(shouldFetchMore(full)).toBe(false);
    let state = full;
    while (state.upcoming.length >= QUEUE_PREFETCH_THRESHOLD) {
      state = reduceSession(state, { type: "graded", grade: 3, now: NOW });
    }
    expect(state.upcoming.length).toBe(QUEUE_PREFETCH_THRESHOLD - 1);
    expect(shouldFetchMore(state)).toBe(true);
  });

  test("does not fetch while loading, after a failure (until the next grade) or when exhausted", () => {
    let state = initSession(items(QUEUE_PAGE_SIZE), NOW);
    while (state.upcoming.length >= QUEUE_PREFETCH_THRESHOLD) {
      state = reduceSession(state, { type: "graded", grade: 3, now: NOW });
    }
    const loading = reduceSession(state, { type: "pageRequested" });
    expect(shouldFetchMore(loading)).toBe(false);
    const failed = reduceSession(loading, { type: "pageFailed" });
    expect(failed.loading).toBe(false);
    expect(shouldFetchMore(failed)).toBe(false);
    expect(shouldFetchMore(reduceSession(failed, { type: "graded", grade: 3, now: NOW }))).toBe(
      true,
    );
    expect(shouldFetchMore(initSession(items(2), NOW))).toBe(false);
  });

  test("a page asks for enough extra cards to cover grades the server may not have yet", () => {
    let state = initSession(items(QUEUE_PAGE_SIZE), NOW);
    expect(pageRequestSize(state)).toBe(QUEUE_PAGE_SIZE);
    state = reduceSession(state, { type: "graded", grade: 3, now: NOW });
    state = reduceSession(state, { type: "graded", grade: 3, now: NOW });
    expect(pageRequestSize(state)).toBe(QUEUE_PAGE_SIZE + 2);
    const many = { ...state, history: Array.from({ length: 500 }, () => state.history[0]!) };
    expect(pageRequestSize(many)).toBe(QUEUE_MAX_PAGE_SIZE);
  });

  test("a loaded page skips cards already seen, including graded and re-shown ones", () => {
    let state = initSession(items(2), NOW);
    state = reduceSession(state, { type: "graded", grade: 1, now: NOW }); // c1 re-shown
    state = reduceSession(state, { type: "graded", grade: 3, now: NOW }); // c2 done
    const next = reduceSession(
      { ...state, loading: true },
      { type: "pageLoaded", items: [item("c1"), item("c2"), item("c9")], requested: 5 },
    );
    expect(ids(next.upcoming)).toEqual(["c1", "c9"]);
    expect(next.loading).toBe(false);
    expect(next.exhausted).toBe(true); // 3 returned < 5 requested
  });

  test("a full page with nothing new ends paging instead of looping", () => {
    const state = reduceSession(initSession(items(QUEUE_PAGE_SIZE), NOW), {
      type: "pageLoaded",
      items: items(QUEUE_PAGE_SIZE),
      requested: QUEUE_PAGE_SIZE,
    });
    expect(state.exhausted).toBe(true);
    expect(state.upcoming).toHaveLength(QUEUE_PAGE_SIZE);
  });

  test("a full page with new cards keeps paging open", () => {
    const page = items(QUEUE_PAGE_SIZE, "n");
    const state = reduceSession(initSession([], NOW), {
      type: "pageLoaded",
      items: page,
      requested: QUEUE_PAGE_SIZE,
    });
    expect(state.exhausted).toBe(false);
    expect(state.upcoming).toHaveLength(QUEUE_PAGE_SIZE);
  });
});

describe("progress and summary", () => {
  test("progress counts answered grades against answered plus remaining", () => {
    let state = initSession(items(4), NOW);
    state = reduceSession(state, { type: "graded", grade: 3, now: NOW });
    expect(progressOf(state)).toEqual({ done: 1, total: 4 });
  });

  test("summary counts distinct cards, grades and time", () => {
    let state = initSession(items(2), NOW);
    state = reduceSession(state, { type: "graded", grade: 1, now: NOW + 2_000 });
    state = reduceSession(state, { type: "graded", grade: 3, now: NOW + 5_000 });
    state = reduceSession(state, { type: "graded", grade: 4, now: NOW + 9_000 });
    expect(summarize(state.history)).toEqual({
      cards: 2,
      answers: 3,
      byGrade: { 1: 1, 2: 0, 3: 1, 4: 1 },
      durationMs: 9_000,
    });
  });
});

describe("sessionPhase", () => {
  const drained = (state: ReturnType<typeof initSession>) => ({ ...state, upcoming: [] });

  test("shows a card while any remain", () => {
    expect(sessionPhase(initSession(items(1), NOW))).toBe("card");
  });

  test("is done when nothing remains and the server has no more", () => {
    expect(sessionPhase(initSession([], NOW))).toBe("done");
  });

  test("waits for the next page, and reports a paging failure that can be retried", () => {
    const open = drained(initSession(items(QUEUE_PAGE_SIZE), NOW));
    expect(sessionPhase(open)).toBe("waiting");
    const failed = reduceSession(open, { type: "pageFailed" });
    expect(sessionPhase(failed)).toBe("failed");
    expect(sessionPhase(reduceSession(failed, { type: "pageRetry" }))).toBe("waiting");
    expect(shouldFetchMore(reduceSession(failed, { type: "pageRetry" }))).toBe(true);
  });
});
