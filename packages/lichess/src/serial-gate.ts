import { RATE_LIMIT_MAX_PAUSE_MS, RATE_LIMIT_PAUSE_MS } from "./config";

export type SerialGateOptions = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  basePauseMs?: number;
  maxPauseMs?: number;
};

type KeyState = {
  tail: Promise<void>;
  pausedUntil: number;
  consecutivePauses: number;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Allows one in-flight task per key (one Lichess request at a time per user)
 * and holds a key back while it is paused after a 429. Keys are independent.
 */
export function createSerialGate(options: SerialGateOptions = {}) {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? realSleep;
  const basePauseMs = options.basePauseMs ?? RATE_LIMIT_PAUSE_MS;
  const maxPauseMs = options.maxPauseMs ?? RATE_LIMIT_MAX_PAUSE_MS;
  const states = new Map<string, KeyState>();

  function stateFor(key: string): KeyState {
    let state = states.get(key);
    if (!state) {
      state = { tail: Promise.resolve(), pausedUntil: 0, consecutivePauses: 0 };
      states.set(key, state);
    }
    return state;
  }

  /** Sleeps until the key's pause (if any) has elapsed. */
  async function waitClear(key: string): Promise<void> {
    const remaining = stateFor(key).pausedUntil - now();
    if (remaining > 0) await sleep(remaining);
  }

  /** Pauses the key, doubling per consecutive call up to the cap. Returns the epoch ms at which it clears. */
  function backoff(key: string): number {
    const state = stateFor(key);
    const delay = Math.min(basePauseMs * 2 ** state.consecutivePauses, maxPauseMs);
    state.consecutivePauses += 1;
    state.pausedUntil = now() + delay;
    return state.pausedUntil;
  }

  /** Clears the doubling after a successful request. */
  function reset(key: string): void {
    stateFor(key).consecutivePauses = 0;
  }

  /**
   * Waits for the previous holder of the key and any pause, then returns a
   * release function that must be called exactly once.
   */
  async function acquire(key: string): Promise<() => void> {
    const state = stateFor(key);
    const previous = state.tail;
    let release!: () => void;
    state.tail = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      await waitClear(key);
    } catch (error) {
      release();
      throw error;
    }
    return release;
  }

  async function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const release = await acquire(key);
    try {
      return await task();
    } finally {
      release();
    }
  }

  return { acquire, run, backoff, reset, waitClear };
}

export type SerialGate = ReturnType<typeof createSerialGate>;
