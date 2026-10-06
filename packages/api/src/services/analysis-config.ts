import { z } from "zod";

/** Search depths the server accepts. The web side uses 10 (screen) and 18 (confirm). */
export const MIN_ANALYSIS_DEPTH = 1;
export const MAX_ANALYSIS_DEPTH = 40;

/**
 * Raw centipawn scores the server accepts. Engines report tablebase and near-mate scores above the
 * classification clamp, so the bound is wider than `EVAL_CLAMP_CP`; stored values are clamped.
 */
export const MAX_EVAL_CP = 32_000;

/** Largest forced-mate distance (in moves) the server accepts. */
export const MAX_MATE_MOVES = 500;

/** Evaluations per `submitEvals` call (the client sends every 10 plies; this leaves headroom). */
export const MAX_EVALS_PER_SUBMIT = 100;

/** Upper bound on the engine id string. */
export const MAX_ENGINE_ID_LENGTH = 64;

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** One engine evaluation: exactly one of `cp` or `mate`, at a bounded depth. */
export const plyEvalSchema = z
  .object({
    cp: z.int().min(-MAX_EVAL_CP).max(MAX_EVAL_CP).optional(),
    mate: z.int().min(-MAX_MATE_MOVES).max(MAX_MATE_MOVES).optional(),
    depth: z.int().min(MIN_ANALYSIS_DEPTH).max(MAX_ANALYSIS_DEPTH),
    bestUci: z.string().regex(UCI_MOVE).optional(),
  })
  .strict()
  .refine((value) => (value.cp === undefined) !== (value.mate === undefined), {
    message: "Provide exactly one of cp or mate.",
  });

export const ANALYSIS_PHASES = ["screen", "confirm"] as const;

export const submitEvalsSchema = z.object({
  gameId: z.string().min(1),
  /** Ply index of `evals[0]`; `evals[i]` is the position after `fromPly + i` plies. */
  fromPly: z.int().min(0),
  evals: z.array(plyEvalSchema.nullable()).min(1).max(MAX_EVALS_PER_SUBMIT),
  phase: z.enum(ANALYSIS_PHASES),
  engineId: z.string().min(1).max(MAX_ENGINE_ID_LENGTH).optional(),
});

export const completeSchema = z.object({ gameId: z.string().min(1) });

export type SubmitEvalsInput = z.infer<typeof submitEvalsSchema>;
export type CompleteInput = z.infer<typeof completeSchema>;
