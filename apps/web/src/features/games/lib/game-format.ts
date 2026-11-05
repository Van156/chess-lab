import type { AnalysisState, GameItem } from "./games-types";

export type AnalysisTone = "neutral" | "progress" | "success" | "error";

export type AnalysisDescription = { label: string; tone: AnalysisTone };

/** Text for the analysis state; the label carries the meaning, tone is only a colour hint. */
export function describeAnalysis(status: AnalysisState): AnalysisDescription {
  switch (status) {
    case "pending":
      return { label: "Waiting for analysis", tone: "neutral" };
    case "screening":
      return { label: "Analysing", tone: "progress" };
    case "confirming":
      return { label: "Confirming mistakes", tone: "progress" };
    case "complete":
      return { label: "Analysed", tone: "success" };
    case "failed":
      return { label: "Analysis failed", tone: "error" };
  }
}

export type GameOutcome = "Win" | "Loss" | "Draw" | "Unfinished";

/** The result from the user's side: "1-0" is a win for a White player and a loss for Black. */
export function gameOutcome(game: Pick<GameItem, "result" | "userColor">): GameOutcome {
  switch (game.result) {
    case "1/2-1/2":
      return "Draw";
    case "1-0":
      return game.userColor === "white" ? "Win" : "Loss";
    case "0-1":
      return game.userColor === "black" ? "Win" : "Loss";
    case "*":
      return "Unfinished";
  }
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Blitz, rated" / "Rapid, casual". */
export function describeFormat(game: Pick<GameItem, "speed" | "rated">): string {
  return `${capitalize(game.speed)}, ${game.rated ? "rated" : "casual"}`;
}

/** Only an analysed game has mistakes worth listing. */
export function hasMistakesToShow(status: AnalysisState): boolean {
  return status === "complete";
}
