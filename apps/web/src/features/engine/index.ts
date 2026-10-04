/** Public API of the Engine feature. Everything else is internal. */
import { createEngineClient, createWorkerTransport } from "./lib/engine-client";

export { CONFIRM_DEPTH, ENGINE_ID, SCREEN_DEPTH, SUBMIT_EVERY_PLIES } from "./config";
export { default as LicensesPage } from "./components/licenses-page";
export { createEngineClient } from "./lib/engine-client";
export type { EngineClient } from "./lib/engine-client";
export {
  EngineJobCancelledError,
  EngineUnavailableError,
  type EngineJobHandle,
  type EngineJobRequest,
  type EnginePriority,
  type EngineResult,
} from "./lib/engine-queue";
export { clampElo, type EloRange, type UciStrength } from "./lib/uci";

/** Shared client: the worker is created on the first `analyse` call, not at import time. */
export const engine = createEngineClient({ createTransport: () => createWorkerTransport() });
