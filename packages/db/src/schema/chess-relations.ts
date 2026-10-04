import { defineRelationsPart } from "drizzle-orm";

import { user } from "./auth";
import { card, reviewLog } from "./cards";
import { game, gameAnalysis, mistake } from "./games";
import { lichessProfile } from "./lichess";
import { userSettings } from "./settings";

/** Relations of the Phase 1 chess tables (ADR-03), spread into `relations.ts`. */
export const chessRelations = defineRelationsPart(
  { user, lichessProfile, userSettings, game, gameAnalysis, mistake, card, reviewLog },
  (r) => ({
    user: {
      lichessProfile: r.one.lichessProfile({ from: r.user.id, to: r.lichessProfile.userId }),
      settings: r.one.userSettings({ from: r.user.id, to: r.userSettings.userId }),
      games: r.many.game({ from: r.user.id, to: r.game.userId }),
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
      reviews: r.many.reviewLog({ from: r.card.id, to: r.reviewLog.cardId }),
    },
    reviewLog: {
      card: r.one.card({ from: r.reviewLog.cardId, to: r.card.id }),
    },
  }),
);
