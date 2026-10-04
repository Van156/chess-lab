import { describe, expect, test } from "bun:test";

import {
  EngineJobCancelledError,
  EngineUnavailableError,
  createEngineQueue,
  searchTimeoutMs,
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
    });
    expect(progress).toEqual([5, 10]);
  });

  test("ignores secondary multipv lines", async () => {
    const fake = createFakeTransport();
    const queue = createEngineQueue(fake.transport);
    const job = queue.submit({ fen: FEN_A, limit: { depth: 4 }, priority: "background" });

    fake.emit("info depth 4 multipv 1 score cp 20 pv e2e4");
    fake.emit("info depth 4 multipv 2 score cp -50 pv a2a3");
    fake.emit("bestmove e2e4");

    expect((await job.result).score).toEqual({ kind: "cp", value: 20 });
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
    expect(sent.slice(0, 2)).toEqual([
      "setoption name UCI_LimitStrength value false",
      "setoption name Skill Level value 20",
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

describe("engine queue watchdog", () => {
  const SEARCH_MS = 1_000;
  const STOP_MS = 200;
  const setup = () => {
    const fake = createFakeTransport();
    const clock = createManualTimers();
    const stalls: Error[] = [];
    const queue = createEngineQueue(fake.transport, {
      ...clock.options,
      searchTimeoutMs: () => SEARCH_MS,
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

describe("searchTimeoutMs", () => {
  test("movetime adds slack, depth scales per ply, both capped by the ceiling", () => {
    const budget = { slackMs: 1_000, perDepthMs: 100, ceilingMs: 5_000 };
    expect(searchTimeoutMs({ movetimeMs: 500 }, budget)).toBe(1_500);
    expect(searchTimeoutMs({ depth: 10 }, budget)).toBe(2_000);
    expect(searchTimeoutMs({ depth: 100 }, budget)).toBe(5_000);
    expect(searchTimeoutMs({ movetimeMs: 60_000 }, budget)).toBe(5_000);
  });
});
