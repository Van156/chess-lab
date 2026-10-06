import { featureProcedure } from "../index";
import { completeSchema, submitEvalsSchema } from "../services/analysis-config";
import { createAnalysisService } from "../services/analysis-service";

/**
 * Game analysis pipeline (ADR-12, ADR-19), behind the `mistakes` pillar flag. The browser runs the
 * engine and submits evaluations; the server classifies and creates mistakes and cards. The user id
 * comes from the session only, never from input.
 */
export const analysisRouter = {
  /** The oldest game still to analyse with its stored evals and resume point, or null. */
  next: featureProcedure("mistakes").handler(({ context }) =>
    createAnalysisService({ db: context.db }).next(context.session.user.id),
  ),
  /** Merges evaluations by ply (idempotent) and advances the resume point. */
  submitEvals: featureProcedure("mistakes")
    .input(submitEvalsSchema)
    .handler(({ input, context }) =>
      createAnalysisService({ db: context.db }).submitEvals(context.session.user.id, input),
    ),
  /** Classifies the game; creates mistakes and one card per carded mistake; marks it complete. */
  complete: featureProcedure("mistakes")
    .input(completeSchema)
    .handler(({ input, context }) =>
      createAnalysisService({ db: context.db }).complete(context.session.user.id, input),
    ),
};
