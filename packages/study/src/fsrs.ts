import { createEmptyCard, fsrs, generatorParameters, type Card } from "ts-fsrs";

import { DEFAULT_STUDY_PARAMS, MAX_REVIEW_CLOCK_SKEW_MS, type StudyParams } from "./config";

/** 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Grade = 1 | 2 | 3 | 4;

/** Named card states; the values match ts-fsrs `State` and the `card.state` column. */
export const CARD_STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;

/** States `selectQueue` treats as learning: due ones lead the queue. */
export const LEARNING_CARD_STATES = [CARD_STATE.Learning, CARD_STATE.Relearning] as const;

/** 0 New, 1 Learning, 2 Review, 3 Relearning. */
export type CardState = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  lastReview: Date | null;
};

export type ReviewLogEntry = {
  grade: Grade;
  reviewedAt: Date;
  /** Whole days since the previous review (0 for a new card). */
  elapsedDays: number;
  /** Snapshot of the card before this grade was applied. */
  stateBefore: CardState;
};

const DAY_MS = 86_400_000;

function cloneState(card: CardState): CardState {
  return {
    ...card,
    due: new Date(card.due),
    lastReview: card.lastReview ? new Date(card.lastReview) : null,
  };
}

export function newCardState(now: Date): CardState {
  return fromFsrs(createEmptyCard(new Date(now)));
}

function fromFsrs(card: Card): CardState {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

function toFsrs(card: CardState): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.lastReview ? { last_review: new Date(card.lastReview) } : {}),
  };
}

export function grade(
  card: CardState,
  g: Grade,
  reviewedAt: Date,
  params: StudyParams = DEFAULT_STUDY_PARAMS,
): { next: CardState; log: ReviewLogEntry } {
  const scheduler = fsrs(
    generatorParameters({
      request_retention: params.desiredRetention,
      maximum_interval: params.maximumInterval,
      enable_fuzz: params.enableFuzz,
    }),
  );
  const { card: nextCard } = scheduler.next(toFsrs(card), new Date(reviewedAt), g);
  const elapsedDays = card.lastReview
    ? Math.max(0, Math.floor((reviewedAt.getTime() - card.lastReview.getTime()) / DAY_MS))
    : 0;
  return {
    next: capInterval(fromFsrs(nextCard), reviewedAt, params.maximumInterval),
    log: {
      grade: g,
      reviewedAt: new Date(reviewedAt),
      elapsedDays,
      stateBefore: cloneState(card),
    },
  };
}

/**
 * ts-fsrs keeps Hard < Good < Easy at least a day apart even past the maximum
 * interval, so the cap is enforced here to make `maximumInterval` a real bound.
 */
function capInterval(card: CardState, reviewedAt: Date, maximumInterval: number): CardState {
  if (card.scheduledDays <= maximumInterval) return card;
  return {
    ...card,
    scheduledDays: maximumInterval,
    due: new Date(reviewedAt.getTime() + maximumInterval * DAY_MS),
  };
}

/**
 * Keeps a client-supplied review time inside `[lastReview, now + 5 min]` so a
 * skewed clock cannot schedule into the past or far future.
 */
export function clampReviewedAt(reviewedAt: Date, lastReview: Date | null, now: Date): Date {
  const max = now.getTime() + MAX_REVIEW_CLOCK_SKEW_MS;
  const min = lastReview ? lastReview.getTime() : Number.NEGATIVE_INFINITY;
  return new Date(Math.min(Math.max(reviewedAt.getTime(), min), max));
}
