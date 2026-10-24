import { describe, expect, test } from "bun:test";

import type {
  EngineInfo,
  EngineJobHandle,
  EngineJobRequest,
  EngineResult,
} from "@/features/engine";

import { startSuggestionSearch } from "./suggestion-run";
import type { SuggestionEvent } from "./suggestion-state";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Fool's mate: White is checkmated, so there is nothing to search.
const MATE_FEN = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

class TestCancelled extends Error {}

const info = (depth: number): EngineInfo => ({ depth, lines: [] }) as unknown as EngineInfo;
const result = (depth: number): EngineResult => ({ depth, lines: [] }) as unknown as EngineResult;

function setup(fen = START_FEN, multiPv = 3) {
  const events: SuggestionEvent[] = [];
  const requests: EngineJobRequest[] = [];
  let cancels = 0;
  let resolve!: (value: EngineResult) => void;
  let reject!: (error: unknown) => void;
  const handle: EngineJobHandle = {
    result: new Promise<EngineResult>((res, rej) => {
      resolve = res;
      reject = rej;
    }),
    cancel: () => void (cancels += 1),
  };
  let nextFrame = 1;
  const frames = new Map<number, () => void>();
  let frameCancels = 0;
  const close = startSuggestionSearch({
    fen,
    job: 7,
    depth: 18,
    multiPv,
    engine: {
      analyse: (request) => {
        requests.push(request);
        return handle;
      },
    },
    isCancelled: (error) => error instanceof TestCancelled,
    requestFrame: (run) => {
      const id = nextFrame++;
      frames.set(id, run);
      return id;
    },
    cancelFrame: (id) => {
      frameCancels += 1;
      frames.delete(id);
    },
    dispatch: (event) => events.push(event),
  });
  const runFrames = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const run of pending) run();
  };
  // Lets the settled promise callbacks run.
  const flush = () => new Promise<void>((done) => setTimeout(done, 0));
  return {
    events,
    requests,
    close,
    resolve,
    reject,
    runFrames,
    flush,
    frames,
    cancels: () => cancels,
    frameCancels: () => frameCancels,
  };
}

describe("startSuggestionSearch", () => {
  test("dispatches started and searches at interactive priority with the depth and lines", () => {
    const run = setup();
    expect(run.events).toEqual([{ type: "started", job: 7, fen: START_FEN }]);
    expect(run.requests).toHaveLength(1);
    expect(run.requests[0]).toMatchObject({
      fen: START_FEN,
      limit: { depth: 18 },
      priority: "interactive",
      multiPv: 3,
    });
  });

  test("searches as many lines as it is told to, from one to five", () => {
    expect(setup(START_FEN, 1).requests[0]?.multiPv).toBe(1);
    expect(setup(START_FEN, 5).requests[0]?.multiPv).toBe(5);
  });

  test("a position without legal moves is terminal and never reaches the engine", () => {
    const run = setup(MATE_FEN);
    expect(run.events).toEqual([{ type: "terminal", job: 7, fen: MATE_FEN }]);
    expect(run.requests).toHaveLength(0);
    expect(() => run.close()).not.toThrow();
  });

  test("close cancels the engine handle", () => {
    const run = setup();
    run.close();
    expect(run.cancels()).toBe(1);
  });

  test("after close, no progress, finished or failed is dispatched", async () => {
    const run = setup();
    run.requests[0]?.onProgress?.(info(5));
    run.close();
    run.runFrames();
    run.requests[0]?.onProgress?.(info(6));
    run.runFrames();
    run.resolve(result(18));
    await run.flush();
    expect(run.events).toEqual([{ type: "started", job: 7, fen: START_FEN }]);

    const failing = setup();
    failing.close();
    failing.reject(new Error("late"));
    await failing.flush();
    expect(failing.events).toEqual([{ type: "started", job: 7, fen: START_FEN }]);
  });

  test("a cancellation rejection dispatches nothing", async () => {
    const run = setup();
    run.reject(new TestCancelled());
    await run.flush();
    expect(run.events).toEqual([{ type: "started", job: 7, fen: START_FEN }]);
  });

  test("any other rejection dispatches failed", async () => {
    const run = setup();
    run.reject(new Error("worker crashed"));
    await run.flush();
    expect(run.events.at(-1)).toEqual({ type: "failed", job: 7 });
  });

  test("progress inside one frame is one dispatch with the latest snapshot", () => {
    const run = setup();
    const [first, second, third] = [info(1), info(2), info(3)];
    run.requests[0]?.onProgress?.(first);
    run.requests[0]?.onProgress?.(second);
    run.requests[0]?.onProgress?.(third);
    expect(run.frames.size).toBe(1);
    run.runFrames();
    expect(run.events.filter((event) => event.type === "progress")).toEqual([
      { type: "progress", job: 7, info: third },
    ]);
    run.requests[0]?.onProgress?.(info(4));
    run.runFrames();
    expect(run.events.filter((event) => event.type === "progress")).toHaveLength(2);
  });

  test("finishing drops the pending frame, so no progress follows finished", async () => {
    const run = setup();
    run.requests[0]?.onProgress?.(info(5));
    const done = result(18);
    run.resolve(done);
    await run.flush();
    expect(run.frameCancels()).toBe(1);
    run.runFrames();
    expect(run.events.map((event) => event.type)).toEqual(["started", "finished"]);
    expect(run.events.at(-1)).toEqual({ type: "finished", job: 7, result: done });
  });

  test("close drops the pending frame", () => {
    const run = setup();
    run.requests[0]?.onProgress?.(info(5));
    run.close();
    expect(run.frameCancels()).toBe(1);
    expect(run.frames.size).toBe(0);
  });
});
