import { describe, expect, test } from "bun:test";

import { createEngineClient, type EngineClientTransport } from "./engine-client";
import { EngineJobCancelledError, EngineUnavailableError } from "./engine-queue";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const createFakeEngine = (answer: (command: string, emit: (line: string) => void) => void) => {
  const sent: string[] = [];
  const lineListeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(error: Error) => void>();
  let terminated = false;
  const emit = (line: string) => {
    for (const listener of lineListeners) listener(line);
  };
  const transport: EngineClientTransport = {
    send: (command) => {
      sent.push(command);
      queueMicrotask(() => answer(command, emit));
    },
    onLine: (listener) => {
      lineListeners.add(listener);
      return () => lineListeners.delete(listener);
    },
    onError: (listener) => {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    terminate: () => {
      terminated = true;
    },
  };
  return {
    transport,
    sent,
    emit,
    crash: (message: string) => {
      for (const listener of errorListeners) listener(new Error(message));
    },
    isTerminated: () => terminated,
  };
};

const healthyAnswer = (command: string, emit: (line: string) => void) => {
  if (command === "uci") {
    emit("id name Stockfish 19 Lite WASM");
    emit("option name UCI_Elo type spin default 1320 min 1320 max 3190");
    emit("uciok");
  } else if (command === "isready") {
    emit("readyok");
  } else if (command.startsWith("go")) {
    emit("info depth 10 score cp 25 pv e2e4");
    emit("bestmove e2e4");
  }
};

describe("engine client", () => {
  test("does not create the worker until the first analyse call", () => {
    let created = 0;
    createEngineClient({
      createTransport: () => {
        created += 1;
        return createFakeEngine(healthyAnswer).transport;
      },
    });
    expect(created).toBe(0);
  });

  test("handshakes, configures Hash and Threads, then analyses", async () => {
    const fake = createFakeEngine(healthyAnswer);
    const client = createEngineClient({ createTransport: () => fake.transport });

    const result = await client.analyse({
      fen: FEN,
      limit: { depth: 10 },
      priority: "background",
    }).result;

    expect(result.bestMove).toBe("e2e4");
    expect(fake.sent.slice(0, 4)).toEqual([
      "uci",
      "setoption name Hash value 16",
      "setoption name Threads value 1",
      "isready",
    ]);
    expect(fake.sent).toContain("go depth 10");
  });

  test("reuses one worker across calls and reads the UCI_Elo range", async () => {
    let created = 0;
    const fake = createFakeEngine(healthyAnswer);
    const client = createEngineClient({
      createTransport: () => {
        created += 1;
        return fake.transport;
      },
    });
    await client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" }).result;
    await client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" }).result;

    expect(created).toBe(1);
    expect(await client.eloRange()).toEqual({ min: 1320, max: 3190 });
  });

  test("a worker that fails to load makes the job fail with an unavailable error", async () => {
    const client = createEngineClient({
      createTransport: () => {
        throw new Error("no worker support");
      },
    });
    const outcome = await client
      .analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" })
      .result.catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(EngineUnavailableError);
  });

  test("a worker that never answers the handshake times out and is terminated", async () => {
    const fake = createFakeEngine(() => undefined);
    const client = createEngineClient({
      createTransport: () => fake.transport,
      handshakeTimeoutMs: 10,
    });
    const outcome = await client
      .analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" })
      .result.catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(EngineUnavailableError);
    expect(fake.isTerminated()).toBe(true);
  });

  test("a load error during the handshake is reported as unavailable, then a retry can succeed", async () => {
    let attempt = 0;
    const broken = createFakeEngine(() => undefined);
    const healthy = createFakeEngine(healthyAnswer);
    const client = createEngineClient({
      createTransport: () => {
        attempt += 1;
        return attempt === 1 ? broken.transport : healthy.transport;
      },
    });

    const first = client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" });
    const firstOutcome = first.result.catch((error: unknown) => error);
    await Promise.resolve();
    broken.crash("failed to fetch engine");
    expect(await firstOutcome).toBeInstanceOf(EngineUnavailableError);

    const second = await client.analyse({
      fen: FEN,
      limit: { depth: 10 },
      priority: "background",
    }).result;
    expect(second.bestMove).toBe("e2e4");
  });

  test("a crash while a job runs fails that job and the next call restarts the worker", async () => {
    let attempt = 0;
    const crashing = createFakeEngine((command, emit) => {
      if (command.startsWith("go")) return;
      healthyAnswer(command, emit);
    });
    const healthy = createFakeEngine(healthyAnswer);
    const client = createEngineClient({
      createTransport: () => {
        attempt += 1;
        return attempt === 1 ? crashing.transport : healthy.transport;
      },
    });

    const job = client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" });
    const outcome = job.result.catch((error: unknown) => error);
    await new Promise((resolve) => setTimeout(resolve, 5));
    crashing.crash("worker crashed");
    expect(await outcome).toBeInstanceOf(EngineUnavailableError);
    expect(crashing.isTerminated()).toBe(true);

    const next = await client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" })
      .result;
    expect(next.bestMove).toBe("e2e4");
  });

  test("cancelling before the worker is ready never submits the job", async () => {
    const fake = createFakeEngine(healthyAnswer);
    const client = createEngineClient({ createTransport: () => fake.transport });
    const job = client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "background" });
    job.cancel();
    const outcome = await job.result.catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(EngineJobCancelledError);
    expect(fake.sent.some((command) => command.startsWith("go"))).toBe(false);
  });

  test("a silent search stalls the worker: it is terminated and the next call starts a fresh one", async () => {
    const timers: Array<{ run: () => void; cleared: boolean }> = [];
    const silentGo = (command: string, emit: (line: string) => void) => {
      if (!command.startsWith("go")) healthyAnswer(command, emit);
    };
    const fakes = [createFakeEngine(silentGo), createFakeEngine(healthyAnswer)];
    let created = 0;
    const client = createEngineClient({
      createTransport: () => fakes[created++]!.transport,
      searchTimeoutMs: () => 1_000,
      stopTimeoutMs: 100,
      setTimer: (run) => {
        const timer = { run, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimer: (handle) => {
        (handle as { cleared: boolean }).cleared = true;
      },
    });

    const stuck = client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "interactive" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const watchdog = timers.filter((timer) => !timer.cleared).at(-1);
    watchdog?.run();
    await expect(stuck.result).rejects.toBeInstanceOf(EngineUnavailableError);
    expect(fakes[0]!.isTerminated()).toBe(true);

    const result = await client.analyse({ fen: FEN, limit: { depth: 10 }, priority: "interactive" })
      .result;
    expect(result.bestMove).toBe("e2e4");
    expect(created).toBe(2);
  });
});
