import { describe, expect, test } from "bun:test";
import type { PlyEval } from "@b2c-template/chess";

import { CONFIRM_DEPTH, ENGINE_ID, SCREEN_DEPTH } from "../config";
import { positionFens } from "./analysis-plan";
import {
  createAnalysisRun,
  type AnalysisApi,
  type AnalysisGame,
  type AnalysisRun,
} from "./analysis-run";
import type { AnalysisEvent } from "./analysis-status";
import {
  EngineJobCancelledError,
  EngineUnavailableError,
  type EngineJobRequest,
  type EngineResult,
} from "./engine-queue";
import { createPauseGate } from "./pause-gate";
import { SCHOLAR } from "./test-games";

const fens = positionFens(SCHOLAR);

const game = (overrides: Partial<AnalysisGame> = {}): AnalysisGame => ({
  gameId: "g1",
  pgn: SCHOLAR,
  userColor: "white",
  evals: [],
  nextPly: 0,
  ...overrides,
});

const result = (cp: number, depth: number): EngineResult => ({
  bestMove: "e2e4",
  score: { kind: "cp", value: cp },
  depth,
  pv: [],
  lines: [],
});

interface Harness {
  calls: Array<{ index: number; depth: number }>;
  submits: Parameters<AnalysisApi["submitEvals"]>[0][];
  completed: string[];
  events: AnalysisEvent[];
  run: AnalysisRun;
}

/** Queue of games is served once each; `score` decides the engine answer for a position. */
function setup(
  games: AnalysisGame[],
  score: (index: number, depth: number) => EngineResult = (_, depth) => result(20, depth),
  engineFails = false,
): Harness & { gate: ReturnType<typeof createPauseGate> } {
  const pending = [...games];
  const h = { calls: [], submits: [], completed: [], events: [] } as unknown as Harness;
  const gate = createPauseGate();
  h.run = createAnalysisRun({
    gate,
    onEvent: (event) => h.events.push(event),
    api: {
      next: async () => pending.shift() ?? null,
      submitEvals: async (input) => {
        h.submits.push(input);
      },
      complete: async ({ gameId }) => {
        h.completed.push(gameId);
      },
    },
    engine: {
      analyse: (request: EngineJobRequest) => {
        const index = fens.indexOf(request.fen);
        const depth = "depth" in request.limit ? request.limit.depth : 0;
        h.calls.push({ index, depth });
        return {
          cancel: () => {},
          result: engineFails
            ? Promise.reject(new EngineUnavailableError())
            : Promise.resolve(score(index, depth)),
        };
      },
    },
  });
  return Object.assign(h, { gate });
}

describe("createAnalysisRun", () => {
  test("screens every position, submits in batches, completes and finishes", async () => {
    const h = setup([game()]);
    expect(await h.run.start()).toBe("finished");
    expect(h.calls).toHaveLength(8);
    expect(h.calls.every((c) => c.depth === SCREEN_DEPTH)).toBe(true);
    // 8 positions, below the batch size of 10: one submit from the end of the screen pass.
    expect(h.submits).toHaveLength(1);
    expect(h.submits[0]).toMatchObject({
      gameId: "g1",
      fromPly: 0,
      phase: "screen",
      engineId: ENGINE_ID,
    });
    expect(h.submits[0]?.evals).toHaveLength(8);
    expect(h.completed).toEqual(["g1"]);
    expect(h.events.at(-1)).toEqual({ type: "gameCompleted" });
  });

  test("resumes screening at the server's resume point", async () => {
    const stored: PlyEval[] = Array.from({ length: 5 }, () => ({ cp: 10, depth: SCREEN_DEPTH }));
    const h = setup([game({ evals: stored, nextPly: 5 })]);
    await h.run.start();
    expect(h.calls.map((c) => c.index)).toEqual([5, 6, 7]);
    expect(h.submits[0]).toMatchObject({ fromPly: 5, phase: "screen" });
  });

  test("confirms the positions around a costly move at the deeper depth", async () => {
    // White's ply 3 (positions 2 -> 3) swings from +30 to +400 for black at screen depth.
    const h = setup([game()], (index, depth) => {
      if (depth === SCREEN_DEPTH) return result(index === 3 ? 400 : index === 2 ? 30 : 20, depth);
      return result(index === 3 ? 400 : 30, depth);
    });
    await h.run.start();
    const deep = h.calls.filter((c) => c.depth === CONFIRM_DEPTH).map((c) => c.index);
    expect(deep).toEqual([2, 3]);
    const confirm = h.submits.filter((s) => s.phase === "confirm");
    expect(confirm).toHaveLength(1);
    expect(confirm[0]).toMatchObject({ fromPly: 2 });
    expect(confirm[0]?.evals).toHaveLength(2);
    expect(h.completed).toEqual(["g1"]);
  });

  test("submits every 10 plies", async () => {
    const long = "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. Nf3 Nf6";
    const longFens = positionFens(long);
    const h = setup([game({ pgn: long })]);
    // Same harness engine resolves fens through the scholar list; positions repeat there, so only
    // count submissions: 11 positions give a batch of 10 then a batch of 1.
    expect(longFens).toHaveLength(11);
    await h.run.start();
    expect(h.submits.map((s) => s.evals.length)).toEqual([10, 1]);
  });

  test("analyses the next game after completing one", async () => {
    const h = setup([game({ gameId: "a" }), game({ gameId: "b" })]);
    expect(await h.run.start()).toBe("finished");
    expect(h.completed).toEqual(["a", "b"]);
  });

  test("an engine that cannot load ends the run as unavailable without completing", async () => {
    const h = setup([game()], undefined, true);
    expect(await h.run.start()).toBe("unavailable");
    expect(h.completed).toEqual([]);
  });

  test("a failed submit ends the run as failed and never completes the game", async () => {
    const completed: string[] = [];
    const failing = createAnalysisRun({
      gate: createPauseGate(),
      onEvent: () => {},
      api: {
        next: async () => game(),
        submitEvals: async () => {
          throw new Error("network");
        },
        complete: async ({ gameId }) => {
          completed.push(gameId);
        },
      },
      engine: { analyse: () => ({ cancel: () => {}, result: Promise.resolve(result(20, 10)) }) },
    });
    expect(await failing.start()).toBe("failed");
    expect(completed).toEqual([]);
  });

  test("flush sends the evaluations gathered so far", async () => {
    let release: (value: EngineResult) => void = () => {};
    let calls = 0;
    const submits: Array<{ fromPly: number; evals: PlyEval[] }> = [];
    const flushRun = createAnalysisRun({
      gate: createPauseGate(),
      onEvent: () => {},
      api: {
        next: async () => game(),
        submitEvals: async (input) => {
          submits.push(input);
        },
        complete: async () => {},
      },
      engine: {
        analyse: () => {
          calls++;
          return {
            cancel: () => {},
            result:
              calls <= 3
                ? Promise.resolve(result(20, 10))
                : new Promise<EngineResult>((resolve) => (release = resolve)),
          };
        },
      },
    });
    const started = flushRun.start();
    while (calls < 4) await new Promise((resolve) => setTimeout(resolve, 0));
    await flushRun.flush();
    expect(submits).toHaveLength(1);
    expect(submits[0]).toMatchObject({ fromPly: 0 });
    expect(submits[0]?.evals).toHaveLength(3);
    flushRun.stop();
    release(result(20, 10));
    expect(await started).toBe("stopped");
  });

  test("stop cancels the running search and ends the run", async () => {
    let cancelled = 0;
    let reject: (error: Error) => void = () => {};
    const stopRun = createAnalysisRun({
      gate: createPauseGate(),
      onEvent: () => {},
      api: { next: async () => game(), submitEvals: async () => {}, complete: async () => {} },
      engine: {
        analyse: () => ({
          cancel: () => {
            cancelled++;
            reject(new EngineJobCancelledError());
          },
          result: new Promise<EngineResult>((_, rej) => (reject = rej)),
        }),
      },
    });
    const started = stopRun.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    stopRun.stop();
    expect(await started).toBe("stopped");
    expect(cancelled).toBe(1);
  });

  test("pausing cancels the search and redoes the position once the gate reopens", async () => {
    const gate = createPauseGate();
    const searches: Array<{ settle: (value: EngineResult) => void; fail: (e: Error) => void }> = [];
    let cancels = 0;
    const completed: string[] = [];
    const pausedRun = createAnalysisRun({
      gate,
      onEvent: () => {},
      api: {
        next: async () => (completed.length === 0 ? game() : null),
        submitEvals: async () => {},
        complete: async ({ gameId }) => {
          completed.push(gameId);
        },
      },
      engine: {
        analyse: () => {
          let settle: (value: EngineResult) => void = () => {};
          let fail: (e: Error) => void = () => {};
          const promise = new Promise<EngineResult>((resolve, reject) => {
            settle = resolve;
            fail = reject;
          });
          searches.push({ settle, fail });
          return {
            cancel: () => {
              cancels++;
              fail(new EngineJobCancelledError());
            },
            result: promise,
          };
        },
      },
    });
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    const started = pausedRun.start();
    await tick();
    expect(searches).toHaveLength(1);

    gate.setPaused(true);
    await tick();
    expect(cancels).toBe(1);
    expect(searches).toHaveLength(1); // no new search while paused

    gate.setPaused(false);
    await tick();
    expect(searches).toHaveLength(2); // the same position, restarted
    for (let i = 1; i < 20; i++) {
      searches.at(-1)?.settle(result(20, 10));
      await tick();
    }
    expect(await started).toBe("finished");
    expect(completed).toEqual(["g1"]);
  });

  describe("flush", () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

    /** Three positions are evaluated at once; the fourth waits until `resumeEngine` is called. */
    const flushHarness = (submitFails: (call: number) => boolean) => {
      let release: (value: EngineResult) => void = () => {};
      let calls = 0;
      let submitCalls = 0;
      const submits: Array<{ fromPly: number; evals: PlyEval[] }> = [];
      const completed: string[] = [];
      const run = createAnalysisRun({
        gate: createPauseGate(),
        onEvent: () => {},
        api: {
          next: async () => (completed.length === 0 ? game() : null),
          submitEvals: async (input) => {
            submitCalls += 1;
            if (submitFails(submitCalls)) throw new Error("network");
            submits.push(input);
          },
          complete: async ({ gameId }) => {
            completed.push(gameId);
          },
        },
        engine: {
          analyse: () => {
            calls += 1;
            return {
              cancel: () => {},
              result:
                calls === 4
                  ? new Promise<EngineResult>((resolve) => (release = resolve))
                  : Promise.resolve(result(20, 10)),
            };
          },
        },
      });
      return {
        run,
        submits,
        completed,
        started: async () => {
          const outcome = run.start();
          while (calls < 4) await tick();
          return { outcome };
        },
        resumeEngine: () => release(result(20, 10)),
      };
    };

    test("a failed flush neither poisons the run nor loses evaluations: the run still completes", async () => {
      const h = flushHarness((call) => call === 1);
      const { outcome } = await h.started();
      await h.run.flush(); // rejected by the server: must be swallowed
      h.resumeEngine();
      expect(await outcome).toBe("finished");
      expect(h.completed).toEqual(["g1"]);
      // The unsent evaluations were not dropped: the next submit still starts at ply 0, so the
      // server (which rejects a batch past its resume point) sees no gap.
      expect(h.submits).toHaveLength(1);
      expect(h.submits[0]?.fromPly).toBe(0);
      expect(h.submits[0]?.evals).toHaveLength(8);
    });

    test("a flush that succeeded is not repeated while nothing new was evaluated", async () => {
      const h = flushHarness(() => false);
      const { outcome } = await h.started();
      await h.run.flush();
      await h.run.flush();
      expect(h.submits).toHaveLength(1);
      h.resumeEngine();
      expect(await outcome).toBe("finished");
      expect(h.completed).toEqual(["g1"]);
    });

    /**
     * Two games; engine calls listed in `blockedCalls` wait for `releaseEngine(n)` and submits
     * numbered in `heldSubmits` wait for `releaseSubmit(n)`. `submits` records a submit when it
     * starts, so a held one is visible before it resolves.
     */
    const racingHarness = (blockedCalls: number[], heldSubmits: number[]) => {
      const engineGates = new Map<number, (value: EngineResult) => void>();
      const submitGates = new Map<number, () => void>();
      let calls = 0;
      let submitCalls = 0;
      let served = 0;
      const submits: Array<{ gameId: string; fromPly: number; evals: PlyEval[] }> = [];
      const run = createAnalysisRun({
        gate: createPauseGate(),
        onEvent: () => {},
        api: {
          next: async () => {
            served += 1;
            return served <= 2 ? game({ gameId: `g${served}` }) : null;
          },
          submitEvals: async (input) => {
            submitCalls += 1;
            submits.push(input);
            if (heldSubmits.includes(submitCalls)) {
              await new Promise<void>((resolve) => submitGates.set(submitCalls, resolve));
            }
          },
          complete: async () => {},
        },
        engine: {
          analyse: () => {
            calls += 1;
            const call = calls;
            return {
              cancel: () => {},
              result: blockedCalls.includes(call)
                ? new Promise<EngineResult>((resolve) => engineGates.set(call, resolve))
                : Promise.resolve(result(20, 10)),
            };
          },
        },
      });
      return {
        run,
        submits,
        reachEngineCall: async (n: number) => {
          while (calls < n) await tick();
        },
        releaseEngine: (n: number) => engineGates.get(n)?.(result(20, 10)),
        releaseSubmit: (n: number) => submitGates.get(n)?.(),
      };
    };

    test("a flush still pending when the run moves to the next game submits the original game", async () => {
      const h = racingHarness([4], [1]);
      const outcome = h.run.start();
      await h.reachEngineCall(4);
      const flushing = h.run.flush(); // g1, three evaluations; its submit is held
      while (h.submits.length < 1) await tick();
      h.releaseEngine(4);
      expect(await outcome).toBe("finished"); // the run moved on to g2 and finished
      h.releaseSubmit(1);
      await flushing;
      expect(h.submits[0]).toMatchObject({ gameId: "g1", fromPly: 0 });
      expect(h.submits[0]?.evals).toHaveLength(3);
      expect(h.submits.slice(1).map((s) => s.gameId)).toEqual(["g1", "g2"]);
    });

    test("evaluations appended during a pending flush are not counted as flushed", async () => {
      const h = racingHarness([4, 6], [1]);
      const outcome = h.run.start();
      await h.reachEngineCall(4);
      const first = h.run.flush(); // three evaluations; its submit is held
      while (h.submits.length < 1) await tick();
      h.releaseEngine(4);
      await h.reachEngineCall(6); // two more evaluations land in the same batch meanwhile
      h.releaseSubmit(1);
      await first;
      await h.run.flush(); // must send all five, not be skipped as "already flushed"
      expect(h.submits).toHaveLength(2);
      expect(h.submits[0]?.evals).toHaveLength(3);
      expect(h.submits[1]).toMatchObject({ gameId: "g1", fromPly: 0 });
      expect(h.submits[1]?.evals).toHaveLength(5);
      h.releaseEngine(6);
      expect(await outcome).toBe("finished");
    });
  });
});
