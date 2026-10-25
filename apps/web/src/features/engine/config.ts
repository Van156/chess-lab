/**
 * Engine constants (design ADR-11, S0.8 pin). The files below are copied unmodified from the
 * `stockfish` package into `public/engine/` by `scripts/copy-engine.ts`.
 */

/** Depth of the shallow pass that gives early results (ADR-12). */
export const SCREEN_DEPTH = 10;
/** Depth of the deep confirmation pass. */
export const CONFIRM_DEPTH = 18;
/** Lines (MultiPV) searched for the suggestions in the repertoire builder. */
export const SUGGESTION_LINES = 3;
/** Depth the builder suggestions search to. */
export const SUGGESTION_DEPTH = 18;
/**
 * Depth of the search that ranks the stored continuations of a position. Shallower than the
 * suggestions: it only has to order a handful of known moves, and it queues at the same priority
 * as the suggestions, so a deep search would hold up the Engine tab (and the next position).
 */
export const RANKING_DEPTH = 12;
/** Lines (MultiPV) of the unrestricted search that grades stored moves against the engine's best. */
export const RANKING_TOP_LINES = 3;
/** Plies of each suggested line shown in the builder. */
export const SUGGESTION_PV_PLIES = 8;
/** Evaluations are submitted to the server every this many plies. */
export const SUBMIT_EVERY_PLIES = 10;

/** Stored with every analysis: the pinned build, equal to the worker file name without extension. */
export const ENGINE_ID = "stockfish-19-lite-single";
/** Version of the pinned npm `stockfish` package. */
export const ENGINE_PACKAGE_VERSION = "19.0.0";

export const ENGINE_BASE_PATH = "/engine";
export const ENGINE_WORKER_PATH = `${ENGINE_BASE_PATH}/${ENGINE_ID}.js`;
export const ENGINE_WASM_PATH = `${ENGINE_BASE_PATH}/${ENGINE_ID}.wasm`;
export const ENGINE_LICENSE_PATH = `${ENGINE_BASE_PATH}/Copying.txt`;

/** Upstream source of the pinned build (npm `stockfish` 19.0.0 is published from this repository). */
export const ENGINE_SOURCE_URL = "https://github.com/nmrugg/stockfish.js";
export const ENGINE_LICENSE_URL = "https://www.gnu.org/licenses/gpl-3.0.html";

/** UCI options sent once after the handshake. */
export const ENGINE_HASH_MB = 16;
export const ENGINE_THREADS = 1;

/** The worker must answer `uci` and `isready` within this time, otherwise it is unavailable. */
export const ENGINE_HANDSHAKE_TIMEOUT_MS = 30_000;

/**
 * Search silence watchdog: a running search that emits no engine output line (`info` and so on)
 * for this long is terminated and restarted. Each line re-arms it, so the window does not bound the
 * total search time, only the gap between lines. A fixed window replaces the old depth-derived
 * budget: a depth-18 search legitimately runs far longer than any per-depth estimate, while a
 * healthy engine reports at least once per iteration, so only the gap matters.
 */
export const ENGINE_SEARCH_SILENCE_MS = 30_000;
/** After `stop`, the engine must answer `bestmove` within this time, otherwise it is stalled. */
export const ENGINE_STOP_TIMEOUT_MS = 5_000;

/**
 * Analysis stops (and must be resumed by the user) once the tab has been hidden this long (ADR-12).
 * The design gives no value; 5 minutes keeps a quick tab switch or a phone lock running while
 * freeing the CPU and battery for a tab the user has left. Decision gap, easy to change.
 */
export const PAUSE_HIDDEN_MS = 5 * 60_000;
