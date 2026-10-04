import { describe, expect, test } from "bun:test";
import { createSerialGate } from "./serial-gate";

function fakeClock(start = 1_000_000) {
  const state = { now: start, sleeps: [] as number[] };
  return {
    state,
    now: () => state.now,
    sleep: async (ms: number) => {
      state.sleeps.push(ms);
      state.now += ms;
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createSerialGate", () => {
  test("never overlaps two tasks for the same key", async () => {
    const clock = fakeClock();
    const gate = createSerialGate(clock);
    const log: string[] = [];
    const first = deferred();

    const a = gate.run("u1", async () => {
      log.push("a:start");
      await first.promise;
      log.push("a:end");
    });
    const b = gate.run("u1", async () => {
      log.push("b:start");
    });

    await tick();
    expect(log).toEqual(["a:start"]);
    first.resolve();
    await Promise.all([a, b]);
    expect(log).toEqual(["a:start", "a:end", "b:start"]);
  });

  test("runs different keys in parallel", async () => {
    const gate = createSerialGate(fakeClock());
    const hold = deferred();
    const log: string[] = [];

    const a = gate.run("u1", async () => {
      log.push("u1");
      await hold.promise;
    });
    const b = gate.run("u2", async () => {
      log.push("u2");
    });

    await b;
    expect(log).toEqual(["u1", "u2"]);
    hold.resolve();
    await a;
  });

  test("a failing task releases the gate for the next one", async () => {
    const gate = createSerialGate(fakeClock());
    const failing = gate.run("u1", async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    expect(await gate.run("u1", async () => "ok")).toBe("ok");
  });

  test("waits out a pause before running the next task", async () => {
    const clock = fakeClock();
    const gate = createSerialGate({ ...clock, basePauseMs: 60_000 });
    const retryAt = gate.backoff("u1");
    expect(retryAt).toBe(clock.state.now + 60_000);

    await gate.run("u1", async () => {
      expect(clock.state.now).toBeGreaterThanOrEqual(retryAt);
    });
    expect(clock.state.sleeps).toEqual([60_000]);
  });

  test("a pause on one key does not delay another", async () => {
    const clock = fakeClock();
    const gate = createSerialGate(clock);
    gate.backoff("u1");
    await gate.run("u2", async () => {});
    expect(clock.state.sleeps).toEqual([]);
  });

  test("doubles consecutive pauses up to the cap", async () => {
    const clock = fakeClock();
    const gate = createSerialGate({ ...clock, basePauseMs: 60_000, maxPauseMs: 300_000 });
    const delays: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      delays.push(gate.backoff("u1") - clock.state.now);
    }
    expect(delays).toEqual([60_000, 120_000, 240_000, 300_000, 300_000]);
  });

  test("reset restarts the doubling", async () => {
    const clock = fakeClock();
    const gate = createSerialGate({ ...clock, basePauseMs: 60_000 });
    gate.backoff("u1");
    gate.backoff("u1");
    gate.reset("u1");
    expect(gate.backoff("u1") - clock.state.now).toBe(60_000);
  });

  test("waitClear sleeps only for the remaining pause", async () => {
    const clock = fakeClock();
    const gate = createSerialGate({ ...clock, basePauseMs: 60_000 });
    gate.backoff("u1");
    clock.state.now += 45_000;
    await gate.waitClear("u1");
    expect(clock.state.sleeps).toEqual([15_000]);
  });
});
