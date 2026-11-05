/**
 * Serial engine job queue (ADR-11). One search runs at a time; `interactive` jobs pre-empt a
 * running `background` job by sending `stop`; every job can be cancelled. The engine is reached
 * through an injected transport, so the queue is pure logic and testable without a worker.
 */
import { ENGINE_SEARCH_SILENCE_MS, ENGINE_STOP_TIMEOUT_MS } from "../config";
import {
  STOP,
  buildGo,
  buildMultiPvOption,
  buildPosition,
  buildStrengthOptions,
  parseUciLine,
  sanitizeSearchMoves,
  type GoLimit,
  type UciScore,
  type UciStrength,
} from "./uci";

/** Minimal line-based channel to an engine process (a Web Worker in the app). */
export interface EngineTransport {
  send: (command: string) => void;
  /** Subscribes to engine output lines; returns the unsubscribe function. */
  onLine: (listener: (line: string) => void) => () => void;
}

export type EnginePriority = "interactive" | "background";

/** One principal variation of a search: the latest report for its MultiPV index. */
export interface EngineLine {
  multipv: number;
  depth: number;
  score: UciScore;
  pv: string[];
}

/** A progress snapshot. `depth`, `score` and `pv` always describe line 1; `lines` holds all indexes. */
export interface EngineInfo {
  depth: number;
  score: UciScore;
  pv: string[];
  /** Latest line per MultiPV index, sorted by index. */
  lines: EngineLine[];
}

export interface EngineJobRequest {
  fen: string;
  limit: GoLimit;
  priority: EnginePriority;
  /** Omitted for analysis, which always runs at full strength. */
  strength?: UciStrength;
  /** Number of lines to search; omitted means 1, and every job resets it so it never leaks. */
  multiPv?: number;
  /**
   * Restricts the search to these moves (UCI). Malformed tokens are dropped; when none is left the
   * search is unrestricted. MultiPV defaults to the number of kept moves so each one gets a line.
   */
  searchMoves?: string[];
  onProgress?: (info: EngineInfo) => void;
}

export interface EngineResult {
  bestMove: string | null;
  score: UciScore | null;
  depth: number;
  pv: string[];
  /** Latest line per MultiPV index, sorted by index. */
  lines: EngineLine[];
}

export interface EngineJobHandle {
  result: Promise<EngineResult>;
  cancel: () => void;
}

export class EngineJobCancelledError extends Error {
  constructor() {
    super("Engine job cancelled");
    this.name = "EngineJobCancelledError";
  }
}

export class EngineUnavailableError extends Error {
  constructor(message = "Engine unavailable") {
    super(message);
    this.name = "EngineUnavailableError";
  }
}

export interface EngineQueue {
  submit: (request: EngineJobRequest) => EngineJobHandle;
  /** The engine is gone: rejects the running and queued jobs and every later submission. */
  fail: (error: Error) => void;
}

export interface EngineQueueOptions {
  /**
   * Silence watchdog: a running search that emits no output line for this long counts as stalled.
   * Every line re-arms it, so a healthy search that keeps reporting is never cut short.
   */
  silenceMs?: number;
  /** Bounded wait for `bestmove` after `stop`. */
  stopTimeoutMs?: number;
  /** Injected timers (defaults to `setTimeout`/`clearTimeout`) so tests control the clock. */
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Called once when the watchdog fires, after the queue failed itself; the owner kills the engine. */
  onStall?: (error: EngineUnavailableError) => void;
}

interface Job {
  request: EngineJobRequest;
  /** Line 1's snapshot: drives the headline score, depth and pv. */
  latest: EngineInfo | null;
  lines: Map<number, EngineLine>;
  resolve: (result: EngineResult) => void;
  reject: (error: Error) => void;
}

const sortedLines = (lines: ReadonlyMap<number, EngineLine>): EngineLine[] =>
  [...lines.values()].sort((a, b) => a.multipv - b.multipv);

type StopReason = "cancel" | "preempt";

export const createEngineQueue = (
  transport: EngineTransport,
  {
    silenceMs = ENGINE_SEARCH_SILENCE_MS,
    stopTimeoutMs = ENGINE_STOP_TIMEOUT_MS,
    setTimer = (run, ms) => setTimeout(run, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    onStall,
  }: EngineQueueOptions = {},
): EngineQueue => {
  const pending: Job[] = [];
  let running: Job | null = null;
  let stopReason: StopReason | null = null;
  let failure: Error | null = null;
  let watchdog: unknown = null;

  const disarm = () => {
    if (watchdog !== null) clearTimer(watchdog);
    watchdog = null;
  };
  const arm = (ms: number, message: string) => {
    disarm();
    watchdog = setTimer(() => {
      watchdog = null;
      const error = new EngineUnavailableError(message);
      fail(error);
      onStall?.(error);
    }, ms);
  };

  const armSilence = () => arm(silenceMs, "Engine search went silent");

  const insertPending = (job: Job, atFront: boolean) => {
    if (atFront || job.request.priority === "interactive") {
      // Interactive jobs (and a pre-empted background job) go ahead of waiting background jobs.
      const firstBackground = pending.findIndex((p) => p.request.priority === "background");
      pending.splice(firstBackground < 0 ? pending.length : firstBackground, 0, job);
    } else {
      pending.push(job);
    }
  };

  const startNext = () => {
    if (running || failure) return;
    const job = pending.shift();
    if (!job) return;
    running = job;
    armSilence();
    const { fen, limit, strength } = job.request;
    const searchMoves = sanitizeSearchMoves(job.request.searchMoves);
    const multiPv =
      job.request.multiPv ?? (searchMoves.length > 0 ? searchMoves.length : undefined);
    for (const option of buildStrengthOptions(strength)) transport.send(option);
    transport.send(buildMultiPvOption(multiPv));
    transport.send(buildPosition(fen));
    transport.send(buildGo(limit, searchMoves));
  };

  const finishRunning = (move: string | null) => {
    const job = running;
    if (!job) return;
    const reason = stopReason;
    disarm();
    running = null;
    stopReason = null;

    if (reason === "cancel") {
      job.reject(new EngineJobCancelledError());
    } else if (reason === "preempt") {
      // The pre-empted background job restarts from scratch once the interactive work is done.
      job.latest = null;
      job.lines.clear();
      insertPending(job, true);
    } else {
      job.resolve({
        bestMove: move,
        score: job.latest?.score ?? null,
        depth: job.latest?.depth ?? 0,
        pv: job.latest?.pv ?? [],
        lines: sortedLines(job.lines),
      });
    }
    startNext();
  };

  transport.onLine((raw) => {
    const line = parseUciLine(raw);
    if (!running) return;
    // Any output proves the engine is alive; while stopping, the bounded stop wait stays in charge.
    if (stopReason === null && line.type !== "bestmove") armSilence();
    if (line.type === "info") {
      if (stopReason !== null) return;
      const job = running;
      job.lines.set(line.multipv, {
        multipv: line.multipv,
        depth: line.depth,
        score: line.score,
        pv: line.pv,
      });
      if (line.multipv === 1) {
        job.latest = { depth: line.depth, score: line.score, pv: line.pv, lines: [] };
      }
      // Progress needs line 1 for the headline fields; engines report it first at each depth.
      if (job.latest) {
        job.latest = { ...job.latest, lines: sortedLines(job.lines) };
        job.request.onProgress?.(job.latest);
      }
    } else if (line.type === "bestmove") {
      finishRunning(line.move);
    }
  });

  const stopRunning = (reason: StopReason) => {
    if (!running) return;
    if (stopReason !== null) {
      // Already stopping: a cancel still wins over a pre-emption, without a second `stop`.
      if (reason === "cancel") stopReason = reason;
      return;
    }
    stopReason = reason;
    arm(stopTimeoutMs, "Engine did not stop in time");
    transport.send(STOP);
  };

  const submit = (request: EngineJobRequest): EngineJobHandle => {
    let resolve!: (result: EngineResult) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<EngineResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const job: Job = { request, latest: null, lines: new Map(), resolve, reject };

    if (failure) {
      reject(failure);
      return { result, cancel: () => undefined };
    }

    insertPending(job, false);
    if (running) {
      if (request.priority === "interactive" && running.request.priority === "background") {
        stopRunning("preempt");
      }
    } else {
      startNext();
    }

    const cancel = () => {
      const queuedAt = pending.indexOf(job);
      if (queuedAt >= 0) {
        pending.splice(queuedAt, 1);
        reject(new EngineJobCancelledError());
      } else if (running === job) {
        stopRunning("cancel");
      }
    };
    return { result, cancel };
  };

  function fail(error: Error) {
    disarm();
    failure = error;
    const jobs = [...(running ? [running] : []), ...pending.splice(0, pending.length)];
    running = null;
    stopReason = null;
    for (const job of jobs) job.reject(error);
  }

  return { submit, fail };
};
