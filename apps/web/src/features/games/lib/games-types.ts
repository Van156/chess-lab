import type { AppRouterClient } from "@b2c-template/api/routers/index";

/** One row of `games.list`. */
export type GameItem = Awaited<ReturnType<AppRouterClient["games"]["list"]>>["items"][number];

/** Where a game is in the analysis pipeline (`pending` until the first evaluations arrive). */
export type AnalysisState = GameItem["analysisStatus"];
