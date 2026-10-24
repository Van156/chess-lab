import { EXPLORER_BAND_SPEEDS, ratingBandFor } from "@b2c-template/chess";
import { z } from "zod";

import type { ExplorerResult } from "../context";

import { featureProcedure } from "../index";
import {
  IDEA_NOTE_MAX_ITEMS,
  IDEA_NOTE_PLAN_MAX_LENGTH,
  REPERTOIRE_NAME_MAX_LENGTH,
} from "../lib/repertoire-limits";
import { createRepertoireService } from "../services/repertoire-service";

const repertoireProcedure = featureProcedure("repertoire");

const id = z.string().min(1);
const name = z.string().trim().min(1).max(REPERTOIRE_NAME_MAX_LENGTH);
const color = z.enum(["white", "black"]);
const square = z.string().regex(/^[a-h][1-8]$/);

const ideaNoteInput = z.object({
  repertoireId: id,
  positionId: id,
  arrows: z.array(z.object({ from: square, to: square })).max(IDEA_NOTE_MAX_ITEMS),
  highlights: z.array(square).max(IDEA_NOTE_MAX_ITEMS),
  plan: z
    .string()
    .trim()
    .max(IDEA_NOTE_PLAN_MAX_LENGTH)
    .regex(/^[^\r\n]*$/, "The plan must be one line."),
});

const service = (context: { db: Parameters<typeof createRepertoireService>[0] }) =>
  createRepertoireService(context.db);

/** The browser-facing explorer result: totals and per-move games added, no raw Lichess shape. */
function explorerView(result: ExplorerResult) {
  if (result.status === "unavailable") return result;
  const { stats } = result;
  return {
    status: "ok" as const,
    stale: result.stale,
    totals: {
      white: stats.white,
      draws: stats.draws,
      black: stats.black,
      games: stats.white + stats.draws + stats.black,
    },
    opening: stats.opening ? { eco: stats.opening.eco, name: stats.opening.name } : null,
    moves: stats.moves.map((m) => ({
      san: m.san,
      uci: m.uci,
      white: m.white,
      draws: m.draws,
      black: m.black,
      games: m.white + m.draws + m.black,
    })),
  };
}

/**
 * Opening repertoires (FR-02, FR-03). The user id comes from the session only; every service
 * query filters by it, so another user's ids behave as unknown ones (`NOT_FOUND`).
 */
export const repertoireRouter = {
  list: repertoireProcedure.handler(({ context }) =>
    service(context).list(context.session.user.id),
  ),
  create: repertoireProcedure
    .input(z.object({ color, name }))
    .handler(({ input, context }) => service(context).create(context.session.user.id, input)),
  rename: repertoireProcedure
    .input(z.object({ id, name }))
    .handler(({ input, context }) =>
      service(context).rename(context.session.user.id, input.id, input.name),
    ),
  delete: repertoireProcedure
    .input(z.object({ id }))
    .handler(({ input, context }) => service(context).remove(context.session.user.id, input.id)),
  /** The tree: positions and moves with ids, plus idea notes keyed by position id. */
  get: repertoireProcedure
    .input(z.object({ id }))
    .handler(({ input, context }) => service(context).get(context.session.user.id, input.id)),
  /** Lichess explorer stats for one position, in the caller's rating band (plus saved offset). */
  explorer: repertoireProcedure
    .input(z.object({ repertoireId: id, positionId: id }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { positionKey, fen, perfs, offset } = await service(context).explorerContext(
        userId,
        input.repertoireId,
        input.positionId,
      );
      const band = ratingBandFor(perfs, offset);
      const speeds = [...EXPLORER_BAND_SPEEDS];
      const result = await context.lichess.explorer(userId, { positionKey, fen, band, speeds });
      return { band, offset, speeds, result: explorerView(result) };
    }),
  /** Plays a SAN or UCI move; a repeat returns the existing move with `status: "duplicate"`. */
  addMove: repertoireProcedure
    .input(
      z.object({ repertoireId: id, fromPositionId: id, move: z.string().trim().min(1).max(16) }),
    )
    .handler(({ input, context }) => service(context).addMove(context.session.user.id, input)),
  /** Removes the move and every position no longer reachable from the start position. */
  deleteMove: repertoireProcedure
    .input(z.object({ repertoireId: id, moveId: id }))
    .handler(({ input, context }) => service(context).deleteMove(context.session.user.id, input)),
  /** Saves the note of a position; an empty note deletes it. */
  setIdeaNote: repertoireProcedure
    .input(ideaNoteInput)
    .handler(({ input, context }) => service(context).setIdeaNote(context.session.user.id, input)),
};
