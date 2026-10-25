/** Public API of the Engine feature. Everything else is internal. */
export {
  CONFIRM_DEPTH,
  ENGINE_ID,
  PAUSE_HIDDEN_MS,
  RANKING_DEPTH,
  RANKING_TOP_LINES,
  SCREEN_DEPTH,
  SUBMIT_EVERY_PLIES,
  SUGGESTION_DEPTH,
  SUGGESTION_LINES,
  SUGGESTION_PV_PLIES,
} from "./config";
export { default as AnalysisStatus } from "./components/analysis-status";
export { useGameAnalysis } from "./hooks/use-game-analysis";
export { default as LicensesPage } from "./components/licenses-page";
export { createEngineClient } from "./lib/engine-client";
export type { EngineClient } from "./lib/engine-client";
export {
  EngineJobCancelledError,
  EngineUnavailableError,
  type EngineInfo,
  type EngineJobHandle,
  type EngineJobRequest,
  type EngineLine,
  type EnginePriority,
  type EngineResult,
} from "./lib/engine-queue";
export { clampElo, type EloRange, type UciStrength } from "./lib/uci";

export { engine } from "./lib/shared-engine";
