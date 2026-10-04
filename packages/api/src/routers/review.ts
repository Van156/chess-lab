import { z } from "zod";

import { enabledCardPillars } from "../features";
import { protectedProcedure } from "../index";
import { createReviewService } from "../services/review-service";

/** Page size bounds for `review.queue` (ADR-13, ADR-14). */
const DEFAULT_QUEUE_LIMIT = 50;
const MAX_QUEUE_LIMIT = 200;
/** One hour; anything longer is a forgotten tab, not a review. */
const MAX_ELAPSED_MS = 3_600_000;

const queueInput = z.object({
  limit: z.int().min(1).max(MAX_QUEUE_LIMIT).default(DEFAULT_QUEUE_LIMIT),
});

const gradeInput = z.object({
  reviewLogId: z.uuid(),
  cardId: z.string().min(1),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  elapsedMs: z.int().min(0).max(MAX_ELAPSED_MS),
});

/**
 * Review queue and grading (ADR-13, ADR-19). The user id comes from the session only, never from
 * input; the service filters every query by it.
 */
export const reviewRouter = {
  /** Hydrated daily queue: the client needs no per-card fetch. */
  queue: protectedProcedure
    .input(queueInput.optional().transform((value) => value ?? queueInput.parse({})))
    .handler(({ input, context }) =>
      createReviewService({ db: context.db }).getQueue(context.session.user.id, {
        limit: input.limit,
        enabledPillars: enabledCardPillars(context.features),
      }),
    ),
  /** Applies a grade at most once per `reviewLogId`; a replay returns the stored state. */
  grade: protectedProcedure
    .input(gradeInput)
    .handler(({ input, context }) =>
      createReviewService({ db: context.db }).gradeCard(context.session.user.id, input),
    ),
};
