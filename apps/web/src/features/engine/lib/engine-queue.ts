/**
 * Serial engine job queue (ADR-11). One search runs at a time; `interactive` jobs pre-empt a
 * running `background` job by sending `stop`; every job can be cancelled. The engine is reached
 * through an injected transport, so the queue is pure logic and testable without a worker.
 */
import {
  STOP,
  buildGo,
  buildPosition,
  buildStrengthOptions,
  parseUciLine,
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

export interface EngineInfo {
  depth: number;
  score: UciScore;
  pv: string[];
}

export interface EngineJobRequest {
  fen: string;
  limit: GoLimit;
  priority: EnginePriority;
  /** Omitted for analysis, which always runs at full strength. */
  strength?: UciStrength;
  onProgress?: (info: EngineInfo) => void;
}

export interface EngineResult {
  bestMove: string | null;
  score: UciScore | null;
  depth: number;
  pv: string[];
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

interface Job {
  request: EngineJobRequest;
  latest: EngineInfo | null;
  resolve: (result: EngineResult) => void;
  reject: (error: Error) => void;
}

type StopReason = "cancel" | "preempt";

export const createEngineQueue = (transport: EngineTransport): EngineQueue => {
  const pending: Job[] = [];
  let running: Job | null = null;
  let stopReason: StopReason | null = null;
  let failure: Error | null = null;

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
    const { fen, limit, strength } = job.request;
    for (const option of buildStrengthOptions(strength)) transport.send(option);
    transport.send(buildPosition(fen));
    transport.send(buildGo(limit));
  };

  const finishRunning = (move: string | null) => {
    const job = running;
    if (!job) return;
    const reason = stopReason;
    running = null;
    stopReason = null;

    if (reason === "cancel") {
      job.reject(new EngineJobCancelledError());
    } else if (reason === "preempt") {
      // The pre-empted background job restarts from scratch once the interactive work is done.
      job.latest = null;
      insertPending(job, true);
    } else {
      job.resolve({
        bestMove: move,
        score: job.latest?.score ?? null,
        depth: job.latest?.depth ?? 0,
        pv: job.latest?.pv ?? [],
      });
    }
    startNext();
  };

  transport.onLine((raw) => {
    const line = parseUciLine(raw);
    if (!running) return;
    if (line.type === "info") {
      if (stopReason !== null || line.multipv !== 1) return;
      const info: EngineInfo = { depth: line.depth, score: line.score, pv: line.pv };
      running.latest = info;
      running.request.onProgress?.(info);
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
    transport.send(STOP);
  };

  const submit = (request: EngineJobRequest): EngineJobHandle => {
    let resolve!: (result: EngineResult) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<EngineResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const job: Job = { request, latest: null, resolve, reject };

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

  const fail = (error: Error) => {
    failure = error;
    const jobs = [...(running ? [running] : []), ...pending.splice(0, pending.length)];
    running = null;
    stopReason = null;
    for (const job of jobs) job.reject(error);
  };

  return { submit, fail };
};
