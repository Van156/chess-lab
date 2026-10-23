import { defineRelationsPart } from "drizzle-orm";

import { user } from "./auth";
import { card, reviewLog } from "./cards";
import { game, gameAnalysis, mistake } from "./games";
import { lichessProfile } from "./lichess";
import { ideaNote, repertoire, repertoireMove, repertoirePosition } from "./repertoire";
import { userSettings } from "./settings";

/** Relations of the Phase 1 chess tables (ADR-03), spread into `relations.ts`. */
export const chessRelations = defineRelationsPart(
  {
    user,
    lichessProfile,
    userSettings,
    game,
    gameAnalysis,
    mistake,
    card,
    reviewLog,
    repertoire,
    repertoirePosition,
    repertoireMove,
    ideaNote,
  },
  (r) => ({
    user: {
      lichessProfile: r.one.lichessProfile({ from: r.user.id, to: r.lichessProfile.userId }),
      settings: r.one.userSettings({ from: r.user.id, to: r.userSettings.userId }),
      games: r.many.game({ from: r.user.id, to: r.game.userId }),
      repertoires: r.many.repertoire({ from: r.user.id, to: r.repertoire.userId }),
    },
    lichessProfile: {
      user: r.one.user({ from: r.lichessProfile.userId, to: r.user.id }),
    },
    userSettings: {
      user: r.one.user({ from: r.userSettings.userId, to: r.user.id }),
    },
    game: {
      user: r.one.user({ from: r.game.userId, to: r.user.id }),
      analysis: r.one.gameAnalysis({ from: r.game.id, to: r.gameAnalysis.gameId }),
      mistakes: r.many.mistake({ from: r.game.id, to: r.mistake.gameId }),
    },
    gameAnalysis: {
      game: r.one.game({ from: r.gameAnalysis.gameId, to: r.game.id }),
    },
    mistake: {
      game: r.one.game({ from: r.mistake.gameId, to: r.game.id }),
      card: r.one.card({ from: r.mistake.id, to: r.card.mistakeId }),
    },
    card: {
      mistake: r.one.mistake({ from: r.card.mistakeId, to: r.mistake.id }),
      repertoirePosition: r.one.repertoirePosition({
        from: r.card.repertoirePositionId,
        to: r.repertoirePosition.id,
      }),
      reviews: r.many.reviewLog({ from: r.card.id, to: r.reviewLog.cardId }),
    },
    reviewLog: {
      card: r.one.card({ from: r.reviewLog.cardId, to: r.card.id }),
    },
    repertoire: {
      user: r.one.user({ from: r.repertoire.userId, to: r.user.id }),
      positions: r.many.repertoirePosition({
        from: r.repertoire.id,
        to: r.repertoirePosition.repertoireId,
      }),
      moves: r.many.repertoireMove({ from: r.repertoire.id, to: r.repertoireMove.repertoireId }),
    },
    repertoirePosition: {
      repertoire: r.one.repertoire({
        from: r.repertoirePosition.repertoireId,
        to: r.repertoire.id,
      }),
      outgoingMoves: r.many.repertoireMove({
        from: r.repertoirePosition.id,
        to: r.repertoireMove.fromPositionId,
        alias: "moveFrom",
      }),
      incomingMoves: r.many.repertoireMove({
        from: r.repertoirePosition.id,
        to: r.repertoireMove.toPositionId,
        alias: "moveTo",
      }),
      note: r.one.ideaNote({
        from: r.repertoirePosition.id,
        to: r.ideaNote.repertoirePositionId,
      }),
      card: r.one.card({ from: r.repertoirePosition.id, to: r.card.repertoirePositionId }),
    },
    repertoireMove: {
      repertoire: r.one.repertoire({
        from: r.repertoireMove.repertoireId,
        to: r.repertoire.id,
      }),
      from: r.one.repertoirePosition({
        from: r.repertoireMove.fromPositionId,
        to: r.repertoirePosition.id,
        alias: "moveFrom",
      }),
      to: r.one.repertoirePosition({
        from: r.repertoireMove.toPositionId,
        to: r.repertoirePosition.id,
        alias: "moveTo",
      }),
    },
    ideaNote: {
      position: r.one.repertoirePosition({
        from: r.ideaNote.repertoirePositionId,
        to: r.repertoirePosition.id,
      }),
    },
  }),
);
