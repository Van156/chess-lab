/**
 * The analysis pipeline loop (ADR-12), independent of React: fetch the oldest unanalysed game,
 * screen from the server's resume point, confirm candidate moves, complete, repeat. The server,
 * the engine and the pause gate are injected, so the loop is tested with fakes.
 */
import type { PlyEval } from "@b2c-template/chess";

import { CONFIRM_DEPTH, ENGINE_ID, SCREEN_DEPTH, SUBMIT_EVERY_PLIES } from "../config";
import {
  append,
  canAppend,
  confirmIndices,
  emptyBatch,
  isFull,
  positionFens,
  screenIndices,
  toPlyEval,
  type Batch,
  type SubmitPhase,
} from "./analysis-plan";
import type { AnalysisEvent } from "./analysis-status";
import {
  EngineJobCancelledError,
  EngineUnavailableError,
  type EngineJobHandle,
  type EngineJobRequest,
} from "./engine-queue";
import type { PauseGate } from "./pause-gate";

export interface AnalysisGame {
  gameId: string;
  pgn: string;
  userColor: "white" | "black";
  evals: PlyEval[];
  nextPly: number;
}

export interface AnalysisApi {
  next: () => Promise<AnalysisGame | null>;
  submitEvals: (input: {
    gameId: string;
    fromPly: number;
    evals: PlyEval[];
    phase: SubmitPhase;
    engineId: string;
  }) => Promise<unknown>;
  complete: (input: { gameId: string }) => Promise<unknown>;
}

export interface AnalysisEngine {
  analyse: (request: EngineJobRequest) => EngineJobHandle;
}

/** How a run ended: no more games, or it stopped early for the given reason. */
export type RunOutcome = "finished" | "stopped" | "unavailable" | "failed";

export interface AnalysisRun {
  start: () => Promise<RunOutcome>;
  /**
   * Best-effort send of the evaluations gathered so far (tab hidden or closing). Never rejects and
   * never changes the run: a failure leaves the evaluations pending for the regular submit.
   */
  flush: () => Promise<void>;
  /** Ends the run: cancels the running search; `start` resolves `"stopped"`. */
  stop: () => void;
}

export interface AnalysisRunOptions {
  api: AnalysisApi;
  engine: AnalysisEngine;
  gate: PauseGate;
  onEvent: (event: AnalysisEvent) => void;
}

class StopSignal extends Error {}

export function createAnalysisRun({ api, engine, gate, onEvent }: AnalysisRunOptions): AnalysisRun {
  let stopped = false;
  let active: EngineJobHandle | null = null;
  let batch: Batch = emptyBatch("screen");
  let gameId = "";
  let sendQueue: Promise<void> = Promise.resolve();
  // Identifies the pending batch, and how many of its evaluations a flush already delivered.
  let batchId = 0;
  let flushed: { batchId: number; count: number } = { batchId: 0, count: 0 };
  let wake: (() => void) | null = null;
  const stopWaiter = new Promise<never>((_, reject) => {
    wake = () => reject(new StopSignal());
  });
  // The waiter is only raced; keep an abandoned rejection from surfacing as unhandled.
  stopWaiter.catch(() => {});

  const checkStopped = () => {
    if (stopped) throw new StopSignal();
  };

  async function evaluate(fen: string, depth: number): Promise<PlyEval> {
    for (;;) {
      await Promise.race([gate.whenOpen(), stopWaiter]);
      checkStopped();
      const handle = engine.analyse({ fen, limit: { depth }, priority: "background" });
      active = handle;
      const offPause = gate.onPause(() => handle.cancel());
      try {
        return toPlyEval(await handle.result);
      } catch (error) {
        // A pause cancels the search; it is redone once the gate reopens.
        if (error instanceof EngineJobCancelledError) {
          checkStopped();
          continue;
        }
        throw error;
      } finally {
        offPause();
        active = null;
      }
    }
  }

  /** A position the PGN could not replay has no evaluation. */
  const evaluateAt = (fens: readonly string[], index: number, depth: number) => {
    const fen = fens[index];
    return fen ? evaluate(fen, depth) : Promise.resolve(null);
  };

  /** Queues the pending batch; sends are serial and a failed send fails every later one. */
  function sendBatch(): Promise<void> {
    const taken = batch;
    batch = emptyBatch(taken.phase);
    batchId += 1;
    if (taken.evals.length === 0) return sendQueue;
    sendQueue = sendQueue.then(() =>
      api
        .submitEvals({
          gameId,
          fromPly: taken.fromPly,
          evals: taken.evals,
          phase: taken.phase,
          engineId: ENGINE_ID,
        })
        .then(() => undefined),
    );
    return sendQueue;
  }

  async function record(index: number, value: PlyEval, phase: SubmitPhase): Promise<void> {
    if (!canAppend(batch, index, phase)) await sendBatch();
    batch = append({ ...batch, phase }, index, value);
    if (isFull(batch, SUBMIT_EVERY_PLIES)) await sendBatch();
  }

  async function analyseGame(game: AnalysisGame): Promise<void> {
    gameId = game.gameId;
    batch = emptyBatch("screen");
    batchId += 1;
    const fens = positionFens(game.pgn);
    const evals = [...game.evals];

    const screen = screenIndices(game.nextPly, fens.length);
    for (const [done, index] of screen.entries()) {
      onEvent({ type: "progress", stage: "screen", done, total: screen.length });
      const value = await evaluateAt(fens, index, SCREEN_DEPTH);
      evals[index] = value;
      await record(index, value, "screen");
    }
    await sendBatch();

    const confirm = confirmIndices(game.pgn, evals, game.userColor);
    for (const [done, index] of confirm.entries()) {
      onEvent({ type: "progress", stage: "confirm", done, total: confirm.length });
      await record(index, await evaluateAt(fens, index, CONFIRM_DEPTH), "confirm");
    }
    await sendBatch();

    checkStopped();
    await api.complete({ gameId });
    onEvent({ type: "gameCompleted" });
  }

  /**
   * Sends a copy of the pending batch and leaves the batch itself untouched, so a failed flush
   * loses nothing: the regular submit resends the same plies from the same `fromPly` (the server
   * stores them idempotently). Consuming the batch instead would leave a gap after a failure, and
   * the server rejects a batch that starts past its resume point. The flush waits behind the
   * queued regular sends so it never overtakes them, but it is not part of that queue: its
   * failure is swallowed here and cannot reject the queue the run depends on.
   */
  async function flush(): Promise<void> {
    const snapshot = batch;
    const id = batchId;
    if (snapshot.evals.length === 0) return;
    if (flushed.batchId === id && flushed.count >= snapshot.evals.length) return;
    try {
      await sendQueue;
      await api.submitEvals({
        gameId,
        fromPly: snapshot.fromPly,
        evals: snapshot.evals,
        phase: snapshot.phase,
        engineId: ENGINE_ID,
      });
      if (flushed.batchId !== id || flushed.count < snapshot.evals.length) {
        flushed = { batchId: id, count: snapshot.evals.length };
      }
    } catch {
      // Best effort: the evaluations stay pending in the batch.
    }
  }

  async function start(): Promise<RunOutcome> {
    try {
      for (;;) {
        checkStopped();
        const game = await api.next();
        if (!game) return "finished";
        await analyseGame(game);
      }
    } catch (error) {
      if (error instanceof StopSignal) return "stopped";
      return error instanceof EngineUnavailableError ? "unavailable" : "failed";
    }
  }

  return {
    start,
    flush,
    stop() {
      stopped = true;
      active?.cancel();
      wake?.();
    },
  };
}
