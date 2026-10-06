/**
 * Lazy engine client (ADR-11). The worker is created on the first `analyse` call, handshaken
 * (`uci`, `isready`, `Hash`, `Threads`) and then driven through the serial job queue. Any failure
 * (missing file, crash, handshake timeout) surfaces as `EngineUnavailableError`; the next call
 * starts a fresh worker, and the rest of the app keeps working.
 */
import {
  ENGINE_HANDSHAKE_TIMEOUT_MS,
  ENGINE_HASH_MB,
  ENGINE_THREADS,
  ENGINE_WORKER_PATH,
} from "../config";
import {
  EngineJobCancelledError,
  EngineUnavailableError,
  createEngineQueue,
  type EngineJobHandle,
  type EngineJobRequest,
  type EngineQueue,
  type EngineQueueOptions,
  type EngineTransport,
} from "./engine-queue";
import { ISREADY, UCI, buildSetOption, parseUciLine, type EloRange, type UciLine } from "./uci";

export interface EngineClientTransport extends EngineTransport {
  /** Subscribes to fatal transport errors (worker crash or load failure). */
  onError: (listener: (error: Error) => void) => () => void;
  terminate: () => void;
}

export interface EngineClientOptions {
  createTransport: () => EngineClientTransport;
  handshakeTimeoutMs?: number;
  /** Search watchdog tuning and timers, forwarded to the queue (tests inject a manual clock). */
  silenceMs?: EngineQueueOptions["silenceMs"];
  stopTimeoutMs?: EngineQueueOptions["stopTimeoutMs"];
  setTimer?: EngineQueueOptions["setTimer"];
  clearTimer?: EngineQueueOptions["clearTimer"];
}

export interface EngineClient {
  analyse: (request: EngineJobRequest) => EngineJobHandle;
  /** Supported `UCI_Elo` range read from the handshake; `null` when the build has none. */
  eloRange: () => Promise<EloRange | null>;
}

interface Session {
  transport: EngineClientTransport;
  queue: EngineQueue;
  eloRange: EloRange | null;
}

const unavailable = (cause: unknown): EngineUnavailableError =>
  cause instanceof EngineUnavailableError
    ? cause
    : new EngineUnavailableError(
        cause instanceof Error ? `Engine unavailable: ${cause.message}` : "Engine unavailable",
      );

/** Resolves when `isDone` accepts a line; rejects on a transport error or the timeout. */
const waitFor = (
  transport: EngineClientTransport,
  isDone: (line: UciLine) => boolean,
  timeoutMs: number,
  onLine?: (line: UciLine) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const cleanup: Array<() => void> = [];
    const finish = (settle: () => void) => {
      for (const dispose of cleanup) dispose();
      settle();
    };
    const timer = setTimeout(
      () => finish(() => reject(new EngineUnavailableError("Engine handshake timed out"))),
      timeoutMs,
    );
    cleanup.push(() => clearTimeout(timer));
    cleanup.push(
      transport.onLine((raw) => {
        const line = parseUciLine(raw);
        onLine?.(line);
        if (isDone(line)) finish(resolve);
      }),
    );
    cleanup.push(transport.onError((error) => finish(() => reject(error))));
  });

const handshake = async (transport: EngineClientTransport, timeoutMs: number) => {
  let eloRange: EloRange | null = null;
  const uciOk = waitFor(
    transport,
    (line) => line.type === "uciok",
    timeoutMs,
    (line) => {
      if (line.type === "spin-option" && line.name === "UCI_Elo") {
        eloRange = { min: line.min, max: line.max };
      }
    },
  );
  transport.send(UCI);
  await uciOk;

  transport.send(buildSetOption("Hash", ENGINE_HASH_MB));
  transport.send(buildSetOption("Threads", ENGINE_THREADS));
  const ready = waitFor(transport, (line) => line.type === "readyok", timeoutMs);
  transport.send(ISREADY);
  await ready;
  return eloRange as EloRange | null;
};

export const createEngineClient = ({
  createTransport,
  handshakeTimeoutMs = ENGINE_HANDSHAKE_TIMEOUT_MS,
  ...watchdog
}: EngineClientOptions): EngineClient => {
  let session: Promise<Session> | null = null;

  const start = async (): Promise<Session> => {
    let transport: EngineClientTransport;
    try {
      transport = createTransport();
    } catch (cause) {
      throw unavailable(cause);
    }
    try {
      const eloRange = await handshake(transport, handshakeTimeoutMs);
      let current: Promise<Session> | null = null;
      const retire = () => {
        transport.terminate();
        if (session === current) session = null;
      };
      // A stalled search already failed the queue; kill the worker so the next call starts afresh.
      const queue = createEngineQueue(transport, { ...watchdog, onStall: retire });
      transport.onError((error) => {
        queue.fail(unavailable(error));
        retire();
      });
      current = session;
      return { transport, queue, eloRange };
    } catch (cause) {
      transport.terminate();
      throw unavailable(cause);
    }
  };

  const ensureSession = (): Promise<Session> => {
    if (!session) {
      const starting = start();
      session = starting;
      // A failed start must not be cached: the next call tries a fresh worker.
      starting.catch(() => {
        if (session === starting) session = null;
      });
    }
    return session;
  };

  const analyse = (request: EngineJobRequest): EngineJobHandle => {
    let cancelled = false;
    let inner: EngineJobHandle | null = null;
    const result = ensureSession().then((ready) => {
      if (cancelled) throw new EngineJobCancelledError();
      inner = ready.queue.submit(request);
      return inner.result;
    });
    return {
      result,
      cancel: () => {
        cancelled = true;
        inner?.cancel();
      },
    };
  };

  return { analyse, eloRange: async () => (await ensureSession()).eloRange };
};

/** Wraps a real Web Worker: Stockfish posts and accepts plain UCI strings. */
export const createWorkerTransport = (url: string = ENGINE_WORKER_PATH): EngineClientTransport => {
  if (typeof Worker === "undefined") {
    throw new EngineUnavailableError("Web Workers are not supported in this browser");
  }
  const worker = new Worker(url);
  return {
    send: (command) => worker.postMessage(command),
    onLine: (listener) => {
      const handler = (event: MessageEvent<unknown>) => {
        if (typeof event.data === "string") listener(event.data);
      };
      worker.addEventListener("message", handler);
      return () => worker.removeEventListener("message", handler);
    },
    onError: (listener) => {
      const handler = (event: ErrorEvent) => {
        listener(new Error(event.message || "Engine worker failed"));
      };
      worker.addEventListener("error", handler);
      return () => worker.removeEventListener("error", handler);
    },
    terminate: () => worker.terminate(),
  };
};
