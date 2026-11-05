import { describe, expect, test } from "bun:test";

import { DEFAULT_STUDY_PARAMS } from "./config";
import { clampReviewedAt, grade, newCardState, type CardState, type Grade } from "./fsrs";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const GRADES: Grade[] = [1, 2, 3, 4];
// Fuzz makes intervals random; tests that compare them pin it off.
const NO_FUZZ = { ...DEFAULT_STUDY_PARAMS, enableFuzz: false };

describe("newCardState", () => {
  test("is a new card due now with no history", () => {
    const card = newCardState(NOW);
    expect(card.state).toBe(0);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.due.getTime()).toBe(NOW.getTime());
    expect(card.lastReview).toBeNull();
  });

  test("does not alias the input date", () => {
    const now = new Date(NOW);
    const card = newCardState(now);
    now.setUTCFullYear(2000);
    expect(card.due.getUTCFullYear()).toBe(2026);
  });
});

describe("grade", () => {
  test.each(GRADES)("grade %i moves a new card forward and counts a rep", (g) => {
    const { next, log } = grade(newCardState(NOW), g, NOW, NO_FUZZ);
    expect(next.reps).toBe(1);
    expect(next.due.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next.lastReview?.getTime()).toBe(NOW.getTime());
    expect(next.state).not.toBe(0);
    expect(log.grade).toBe(g);
    expect(log.reviewedAt.getTime()).toBe(NOW.getTime());
    expect(log.stateBefore.state).toBe(0);
  });

  test("Good on a new card is due in the future with updated memory state", () => {
    const { next } = grade(newCardState(NOW), 3, NOW, NO_FUZZ);
    expect(next.reps).toBe(1);
    expect(next.stability).toBeGreaterThan(0);
    expect(next.difficulty).toBeGreaterThan(0);
  });

  test("Easy schedules at least as far out as Good", () => {
    const good = grade(newCardState(NOW), 3, NOW, NO_FUZZ).next;
    const easy = grade(newCardState(NOW), 4, NOW, NO_FUZZ).next;
    expect(easy.due.getTime()).toBeGreaterThanOrEqual(good.due.getTime());
  });

  test("Again on a Review card adds a lapse and is due sooner than before", () => {
    let card: CardState = newCardState(NOW);
    let at = NOW;
    // Graduate the card to Review state with Good/Easy.
    for (let i = 0; i < 6 && card.state !== 2; i++) {
      card = grade(card, 3, at, NO_FUZZ).next;
      at = card.due;
    }
    expect(card.state).toBe(2);
    const previousInterval = card.due.getTime() - card.lastReview!.getTime();
    const { next } = grade(card, 1, at, NO_FUZZ);
    expect(next.lapses).toBe(card.lapses + 1);
    expect(next.state).toBe(3);
    expect(next.due.getTime() - at.getTime()).toBeLessThan(previousInterval);
  });

  test("log records the state before grading", () => {
    const first = grade(newCardState(NOW), 3, NOW, NO_FUZZ).next;
    const later = new Date(first.due);
    const { log } = grade(first, 3, later, NO_FUZZ);
    expect(log.stateBefore).toEqual(first);
    expect(log.elapsedDays).toBeGreaterThanOrEqual(0);
  });

  test("is pure for a fixed now (does not mutate the input, same output twice)", () => {
    const card = newCardState(NOW);
    const snapshot = structuredClone(card);
    const a = grade(card, 3, NOW, NO_FUZZ);
    const b = grade(card, 3, NOW, NO_FUZZ);
    expect(card).toEqual(snapshot);
    expect(a).toEqual(b);
  });

  test("fuzz is deterministic for a fixed card and time", () => {
    const a = grade(newCardState(NOW), 3, NOW).next;
    const b = grade(newCardState(NOW), 3, NOW).next;
    expect(a).toEqual(b);
  });

  test("maximum interval caps scheduling", () => {
    let card: CardState = newCardState(NOW);
    let at = NOW;
    const params = { ...NO_FUZZ, maximumInterval: 10 };
    for (let i = 0; i < 30; i++) {
      // Good, not Easy: ts-fsrs forces Easy above Good by a day, past the cap.
      card = grade(card, 3, at, params).next;
      at = card.due;
    }
    expect(card.scheduledDays).toBeLessThanOrEqual(10);
  });
});

describe("clampReviewedAt", () => {
  const last = new Date("2026-03-10T10:00:00.000Z");
  test("passes through a time inside the window", () => {
    expect(clampReviewedAt(NOW, last, NOW).getTime()).toBe(NOW.getTime());
  });
  test("raises a time before the last review", () => {
    const early = new Date("2026-03-09T00:00:00.000Z");
    expect(clampReviewedAt(early, last, NOW).getTime()).toBe(last.getTime());
  });
  test("lowers a time beyond now plus 5 minutes", () => {
    const far = new Date("2026-03-11T00:00:00.000Z");
    expect(clampReviewedAt(far, last, NOW).getTime()).toBe(NOW.getTime() + 5 * 60 * 1000);
  });
  test("accepts a null last review (new card)", () => {
    const early = new Date("2020-01-01T00:00:00.000Z");
    expect(clampReviewedAt(early, null, NOW).getTime()).toBe(early.getTime());
  });
});
