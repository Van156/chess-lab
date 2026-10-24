import { describe, expect, test } from "bun:test";

import {
  EngineJobCancelledError,
  EngineUnavailableError,
  createEngineQueue,
  type EngineQueueOptions,
  type EngineTransport,
} from "./engine-queue";

const FEN_A = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FEN_B = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const FEN_C = "8/8/8/8/8/8/8/K1k5 w - - 0 1";

const createFakeTransport = () => {
  const sent: string[] = [];
  const listeners = new Set<(line: string) => void>();
  const transport: EngineTransport = {
    send: (command) => {
      sent.push(command);
    },
    onLine: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    transport,
    sent,
    emit: (line: string) => {
      for (const listener of listeners) listener(line);
    },
    take: () => sent.splice(0, sent.length),
  };
};

const settle = (promise: Promise<unknown>) =>
  promise.then(
    (value) => ({ status: "ok" as const, value }),
    (error: unknown) => ({ status: "error" as const, error }),
  );

describe("engine queue", () => {
  test("starts a job with analysis options, position and go", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });

    expect(fake.take()).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
      "setoption name MultiPV value 1",
      `position fen ${FEN_A}`,
      "go depth 10",
    ]);
  });

  test("resolves with the deepest info and the best move", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const progress: number[] = [];
    const job = queue.submit({
      fen: FEN_A,
      limit: { depth: 10 },
      priority: "background",
      onProgress: (info) => progress.push(info.depth),
    });

    fake.emit("info depth 5 score cp 10 pv e2e4");
    fake.emit("info depth 10 score cp 31 pv d2d4 d7d5");
    fake.emit("bestmove d2d4 ponder d7d5");

    expect(await job.result).toEqual({
      bestMove: "d2d4",
      score: { kind: "cp", value: 31 },
      depth: 10,
      pv: ["d2d4", "d7d5"],
      lines: [{ multipv: 1, depth: 10, score: { kind: "cp", value: 31 }, pv: ["d2d4", "d7d5"] }],
    });
    expect(progress).toEqual([5, 10]);
  });

  test("a secondary multipv line never replaces line 1's score, depth or pv", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const job = queue.submit({ fen: FEN_A, limit: { depth: 4 }, priority: "background" });

    fake.emit("info depth 4 multipv 1 score cp 20 pv e2e4");
    fake.emit("info depth 6 multipv 2 score cp -50 pv a2a3");
    fake.emit("bestmove e2e4");

    const result = await job.result;
    expect(result.score).toEqual({ kind: "cp", value: 20 });
    expect(result.depth).toBe(4);
    expect(result.pv).toEqual(["e2e4"]);
  });

  test("a secondary line arriving before line 1 does not set the headline fields", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const job = queue.submit({ fen: FEN_A, limit: { depth: 4 }, priority: "background" });

    fake.emit("info depth 4 multipv 2 score cp -50 pv a2a3");
    fake.emit("bestmove a2a3");

    const result = await job.result;
    expect(result.score).toBeNull();
    expect(result.depth).toBe(0);
    expect(result.pv).toEqual([]);
    expect(result.lines).toEqual([
      { multipv: 2, depth: 4, score: { kind: "cp", value: -50 }, pv: ["a2a3"] },
    ]);
  });

  test("collects the latest line per multipv index, sorted by index", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const job = queue.submit({
      fen: FEN_A,
      limit: { depth: 8 },
      priority: "interactive",
      multiPv: 3,
    });

    fake.emit("info depth 7 multipv 3 score cp -10 pv c2c4");
    fake.emit("info depth 7 multipv 1 score cp 30 pv e2e4");
    fake.emit("info depth 7 multipv 2 score cp 10 pv d2d4");
    fake.emit("info depth 8 multipv 2 score cp 15 pv d2d4 d7d5");
    fake.emit("bestmove e2e4");

    expect((await job.result).lines).toEqual([
      { multipv: 1, depth: 7, score: { kind: "cp", value: 30 }, pv: ["e2e4"] },
      { multipv: 2, depth: 8, score: { kind: "cp", value: 15 }, pv: ["d2d4", "d7d5"] },
      { multipv: 3, depth: 7, score: { kind: "cp", value: -10 }, pv: ["c2c4"] },
    ]);
  });

  test("onProgress fires for every accepted line with the lines snapshot", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const snapshots: { depth: number; indexes: number[] }[] = [];
    queue.submit({
      fen: FEN_A,
      limit: { depth: 8 },
      priority: "interactive",
      multiPv: 2,
      onProgress: (info) =>
        snapshots.push({ depth: info.depth, indexes: info.lines.map((l) => l.multipv) }),
    });

    fake.emit("info depth 5 multipv 1 score cp 30 pv e2e4");
    fake.emit("info depth 5 multipv 2 score cp 10 pv d2d4");

    expect(snapshots).toEqual([
      { depth: 5, indexes: [1] },
      { depth: 5, indexes: [1, 2] },
    ]);
  });

  test("sends MultiPV with the requested value before position and go", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "interactive", multiPv: 3 });
    expect(fake.take()).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
      "setoption name MultiPV value 3",
      `position fen ${FEN_A}`,
      "go depth 18",
    ]);
  });

  test("a job without multiPv resets MultiPV to 1 after a multi-line job", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "interactive", multiPv: 3 });
    queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "background" });
    fake.take();
    fake.emit("bestmove e2e4");
    expect(fake.take()).toContain("setoption name MultiPV value 1");
  });

  test("lines from a stopping search are ignored", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const job = queue.submit({
      fen: FEN_A,
      limit: { depth: 18 },
      priority: "interactive",
      multiPv: 2,
    });
    fake.emit("info depth 5 multipv 1 score cp 30 pv e2e4");
    job.cancel();
    fake.emit("info depth 6 multipv 2 score cp 10 pv d2d4");
    fake.emit("bestmove e2e4");
    expect((await settle(job.result)).status).toBe("error");
  });

  test("a pre-empted background job restarts with no lines carried over", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const background = queue.submit({
      fen: FEN_A,
      limit: { depth: 18 },
      priority: "background",
      multiPv: 2,
    });
    fake.emit("info depth 5 multipv 1 score cp 30 pv e2e4");
    fake.emit("info depth 5 multipv 2 score cp 10 pv d2d4");
    const interactive = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "interactive" });
    fake.emit("bestmove e2e4");
    fake.emit("info depth 8 score cp 0 pv e7e5");
    fake.emit("bestmove e7e5");
    await interactive.result;

    // The restarted job only reports line 1 this time; stale line 2 must be gone.
    fake.emit("info depth 18 multipv 1 score cp 22 pv e2e4");
    fake.emit("bestmove e2e4");
    expect((await background.result).lines).toEqual([
      { multipv: 1, depth: 18, score: { kind: "cp", value: 22 }, pv: ["e2e4"] },
    ]);
  });

  test("runs jobs one at a time in submission order", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const first = queue.submit({ fen: FEN_A, limit: { depth: 8 }, priority: "background" });
    const second = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "background" });
    const third = queue.submit({ fen: FEN_C, limit: { depth: 8 }, priority: "background" });

    expect(fake.take().filter((c) => c.startsWith("go"))).toEqual(["go depth 8"]);
    expect(fake.sent).toEqual([]);

    fake.emit("info depth 8 score cp 1 pv e2e4");
    fake.emit("bestmove e2e4");
    expect((await first.result).bestMove).toBe("e2e4");
    expect(fake.take()).toContain(`position fen ${FEN_B}`);
    expect(fake.sent).toEqual([]);

    fake.emit("info depth 8 score cp 2 pv e7e5");
    fake.emit("bestmove e7e5");
    expect((await second.result).bestMove).toBe("e7e5");
    expect(fake.take()).toContain(`position fen ${FEN_C}`);

    fake.emit("info depth 8 score cp 3 pv a1a2");
    fake.emit("bestmove a1a2");
    expect((await third.result).bestMove).toBe("a1a2");
  });

  test("an interactive job pre-empts a running background job with stop", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const background = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    fake.take();

    const interactive = queue.submit({ fen: FEN_B, limit: { depth: 12 }, priority: "interactive" });
    expect(fake.take()).toEqual(["stop"]);

    // Nothing else is sent until the stopped search reports its bestmove.
    fake.emit("info depth 6 score cp 5 pv e2e4");
    fake.emit("bestmove e2e4");
    expect(fake.take()).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
      "setoption name MultiPV value 1",
      `position fen ${FEN_B}`,
      "go depth 12",
    ]);

    fake.emit("info depth 12 score cp 40 pv e7e5");
    fake.emit("bestmove e7e5");
    expect((await interactive.result).bestMove).toBe("e7e5");

    // The pre-empted background job restarts from scratch and still completes.
    expect(fake.take()).toContain(`position fen ${FEN_A}`);
    fake.emit("info depth 18 score cp 22 pv e2e4");
    fake.emit("bestmove e2e4");
    expect((await background.result).depth).toBe(18);
  });

  test("an interactive job does not pre-empt another interactive job", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 12 }, priority: "interactive" });
    fake.take();
    queue.submit({ fen: FEN_B, limit: { depth: 12 }, priority: "interactive" });
    expect(fake.sent).toEqual([]);
  });

  test("queued interactive jobs go before queued background jobs", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 8 }, priority: "interactive" });
    queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "background" });
    const interactive = queue.submit({ fen: FEN_C, limit: { depth: 8 }, priority: "interactive" });
    fake.take();

    fake.emit("info depth 8 score cp 0 pv e2e4");
    fake.emit("bestmove e2e4");
    expect(fake.take()).toContain(`position fen ${FEN_C}`);
    fake.emit("info depth 8 score cp 0 pv a1a2");
    fake.emit("bestmove a1a2");
    expect((await interactive.result).bestMove).toBe("a1a2");
  });

  test("cancelling a queued job rejects it and never sends it", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({ fen: FEN_A, limit: { depth: 8 }, priority: "background" });
    const queued = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "background" });
    const after = queue.submit({ fen: FEN_C, limit: { depth: 8 }, priority: "background" });
    fake.take();

    queued.cancel();
    expect((await settle(queued.result)).status).toBe("error");

    fake.emit("info depth 8 score cp 0 pv e2e4");
    fake.emit("bestmove e2e4");
    const sent = fake.take();
    expect(sent).toContain(`position fen ${FEN_C}`);
    expect(sent).not.toContain(`position fen ${FEN_B}`);
    fake.emit("info depth 8 score cp 0 pv a1a2");
    fake.emit("bestmove a1a2");
    await after.result;
  });

  test("cancelling the running job stops the engine, then the next job starts", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const running = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    const next = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "background" });
    fake.take();

    running.cancel();
    expect(fake.take()).toEqual(["stop"]);

    fake.emit("bestmove e2e4");
    const outcome = await settle(running.result);
    expect(outcome.status).toBe("error");
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineJobCancelledError);
    expect(fake.take()).toContain(`position fen ${FEN_B}`);

    fake.emit("info depth 8 score cp 0 pv e7e5");
    fake.emit("bestmove e7e5");
    expect((await next.result).bestMove).toBe("e7e5");
  });

  test("a strength job sets the strength options instead of the analysis reset", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({
      fen: FEN_A,
      limit: { movetimeMs: 500 },
      priority: "interactive",
      strength: { elo: 1500 },
    });
    expect(fake.take()).toEqual([
      "setoption name UCI_LimitStrength value true",
      "setoption name UCI_Elo value 1500",
      "setoption name MultiPV value 1",
      `position fen ${FEN_A}`,
      "go movetime 500",
    ]);
  });

  test("an analysis job after a strength job resets strength again", () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    queue.submit({
      fen: FEN_A,
      limit: { movetimeMs: 500 },
      priority: "interactive",
      strength: { skill: 2 },
    });
    queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "background" });
    fake.take();
    fake.emit("bestmove e2e4");
    const sent = fake.take();
    expect(sent.slice(0, 3)).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
      "setoption name MultiPV value 1",
    ]);
  });

  test("fail rejects the running and queued jobs and refuses new ones", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const running = queue.submit({ fen: FEN_A, limit: { depth: 8 }, priority: "background" });
    const queued = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "background" });

    queue.fail(new EngineUnavailableError("worker crashed"));

    for (const job of [running, queued]) {
      const outcome = await settle(job.result);
      expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    }
    const late = queue.submit({ fen: FEN_C, limit: { depth: 8 }, priority: "background" });
    const lateOutcome = await settle(late.result);
    expect(lateOutcome.status === "error" && lateOutcome.error).toBeInstanceOf(
      EngineUnavailableError,
    );
  });
});

describe("engine queue: cancel while pre-empted", () => {
  test("cancelling a job that is being pre-empted rejects it instead of requeueing", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const background = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    const interactive = queue.submit({ fen: FEN_B, limit: { depth: 8 }, priority: "interactive" });
    fake.take();

    background.cancel();
    expect(fake.take()).toEqual([]);

    fake.emit("bestmove e2e4");
    const outcome = await settle(background.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineJobCancelledError);
    fake.emit("info depth 8 score cp 0 pv e7e5");
    fake.emit("bestmove e7e5");
    expect((await interactive.result).bestMove).toBe("e7e5");
    expect(fake.take().filter((c) => c === `position fen ${FEN_A}`)).toEqual([]);
  });
});

/** Manual clock: timers fire only when the test advances it. */
const createManualTimers = () => {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const options: Pick<EngineQueueOptions, "setTimer" | "clearTimer"> = {
    setTimer: (run, ms) => {
      nextId += 1;
      timers.set(nextId, { at: now + ms, run });
      return nextId;
    },
    clearTimer: (handle) => void timers.delete(handle as number),
  };
  return {
    options,
    pendingCount: () => timers.size,
    advance: (ms: number) => {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now && timers.delete(id)) timer.run();
      }
    },
  };
};

describe("engine queue silence watchdog", () => {
  const SEARCH_MS = 1_000;
  const STOP_MS = 200;
  const setup = () => {
    const fake = createFakeTransport();
    const clock = createManualTimers();
    const stalls: Error[] = [];
    const queue = createEngineQueue(fake.transport, {
      ...clock.options,
      silenceMs: SEARCH_MS,
      stopTimeoutMs: STOP_MS,
      onStall: (error) => stalls.push(error),
    });
    return { fake, clock, queue, stalls };
  };

  test("a running job that never answers is rejected as unavailable and the engine reported stalled", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    const queued = queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "background" });
    fake.take();

    clock.advance(SEARCH_MS);

    const outcome = await settle(job.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    const queuedOutcome = await settle(queued.result);
    expect(queuedOutcome.status === "error" && queuedOutcome.error).toBeInstanceOf(
      EngineUnavailableError,
    );
    expect(stalls).toHaveLength(1);
    expect(stalls[0]).toBeInstanceOf(EngineUnavailableError);
    expect(fake.take()).toEqual([]);
  });

  test("a job that answers in time never trips the watchdog", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    clock.advance(SEARCH_MS - 1);
    fake.emit("bestmove e2e4");
    await job.result;
    expect(clock.pendingCount()).toBe(0);
    clock.advance(SEARCH_MS * 5);
    expect(stalls).toHaveLength(0);
  });

  test("a job that keeps reporting is never failed, however long it runs", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    // 50 seconds of search against a one second silence window: a total-budget watchdog would fire.
    for (let step = 0; step < 100; step += 1) {
      clock.advance(SEARCH_MS - 500);
      fake.emit(`info depth ${step + 1} multipv 1 score cp 20 pv e2e4`);
    }
    expect(stalls).toHaveLength(0);
    fake.emit("bestmove e2e4");
    const result = await job.result;
    expect(result.depth).toBe(100);
    expect(clock.pendingCount()).toBe(0);
  });

  test("output other than info (and secondary lines) also proves the engine is alive", () => {
    const { fake, clock, queue, stalls } = setup();
    queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    clock.advance(SEARCH_MS - 1);
    fake.emit("info depth 3 multipv 2 score cp 5 pv d2d4");
    clock.advance(SEARCH_MS - 1);
    fake.emit("info string NNUE evaluation using nn.nnue");
    clock.advance(SEARCH_MS - 1);
    expect(stalls).toHaveLength(0);
  });

  test("a job that reports and then goes silent still fails, one window after the last line", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    clock.advance(SEARCH_MS - 1);
    fake.emit("info depth 5 multipv 1 score cp 20 pv e2e4");
    clock.advance(SEARCH_MS - 1);
    expect(stalls).toHaveLength(0);
    clock.advance(1);
    const outcome = await settle(job.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    expect(stalls).toHaveLength(1);
  });

  test("output while stopping does not extend the bounded stop wait", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 18 }, priority: "background" });
    job.cancel();
    clock.advance(STOP_MS - 1);
    fake.emit("info depth 9 multipv 1 score cp 20 pv e2e4");
    clock.advance(1);
    const outcome = await settle(job.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    expect(stalls).toHaveLength(1);
  });

  test("each job gets a fresh watchdog", async () => {
    const { fake, clock, queue, stalls } = setup();
    const first = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    const second = queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "background" });
    clock.advance(SEARCH_MS - 1);
    fake.emit("bestmove e2e4");
    await first.result;
    clock.advance(SEARCH_MS - 1);
    expect(stalls).toHaveLength(0);
    fake.emit("bestmove e7e5");
    await second.result;
  });

  test("a cancel during a silent search sends stop, then gives up after the bounded wait", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    fake.take();

    job.cancel();
    expect(fake.take()).toEqual(["stop"]);
    clock.advance(STOP_MS);

    const outcome = await settle(job.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    expect(stalls).toHaveLength(1);
  });

  test("a cancel answered by bestmove in time disarms the stop wait", async () => {
    const { fake, clock, queue, stalls } = setup();
    const job = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    job.cancel();
    clock.advance(STOP_MS - 1);
    fake.emit("bestmove e2e4");
    const outcome = await settle(job.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineJobCancelledError);
    expect(clock.pendingCount()).toBe(0);
    expect(stalls).toHaveLength(0);
  });

  test("a pre-emption whose bestmove never arrives is bounded too", async () => {
    const { clock, queue, stalls } = setup();
    const background = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    const interactive = queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "interactive" });
    clock.advance(STOP_MS);
    for (const job of [background, interactive]) {
      const outcome = await settle(job.result);
      expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
    }
    expect(stalls).toHaveLength(1);
  });

  test("a stalled queue rejects later submissions", async () => {
    const { clock, queue } = setup();
    const stuck = queue.submit({ fen: FEN_A, limit: { depth: 10 }, priority: "background" });
    clock.advance(SEARCH_MS);
    await settle(stuck.result);
    const late = queue.submit({ fen: FEN_B, limit: { depth: 10 }, priority: "background" });
    const outcome = await settle(late.result);
    expect(outcome.status === "error" && outcome.error).toBeInstanceOf(EngineUnavailableError);
  });
});
