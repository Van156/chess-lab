import { describe, expect, test } from "bun:test";

import { createHiddenTabPolicy } from "./hidden-tab-policy";

const setup = () => {
  const log: string[] = [];
  const timers = new Map<number, { at: number; run: () => void }>();
  let now = 0;
  let nextId = 0;
  const policy = createHiddenTabPolicy({
    flush: () => log.push("flush"),
    stop: () => log.push("stop"),
    hiddenMs: 1_000,
    setTimer: (run, ms) => {
      nextId += 1;
      timers.set(nextId, { at: now + ms, run });
      return nextId;
    },
    clearTimer: (handle) => void timers.delete(handle as number),
  });
  return {
    policy,
    log,
    armed: () => timers.size,
    advance: (ms: number) => {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now && timers.delete(id)) timer.run();
      }
    },
  };
};

describe("hidden tab policy", () => {
  test("hiding the tab flushes at once and stops the run after the hidden window", () => {
    const { policy, log, advance } = setup();
    policy.visibilityChanged("hidden");
    expect(log).toEqual(["flush"]);
    advance(999);
    expect(log).toEqual(["flush"]);
    advance(1);
    expect(log).toEqual(["flush", "stop"]);
  });

  test("coming back before the window clears the stop timer", () => {
    const { policy, log, advance, armed } = setup();
    policy.visibilityChanged("hidden");
    policy.visibilityChanged("visible");
    expect(armed()).toBe(0);
    advance(10_000);
    expect(log).toEqual(["flush"]);
  });

  test("hiding twice keeps a single stop timer measured from the latest hide", () => {
    const { policy, log, advance, armed } = setup();
    policy.visibilityChanged("hidden");
    advance(600);
    policy.visibilityChanged("hidden");
    expect(armed()).toBe(1);
    advance(600);
    expect(log).toEqual(["flush", "flush"]);
    advance(400);
    expect(log).toEqual(["flush", "flush", "stop"]);
  });

  test("pagehide flushes without arming a stop timer", () => {
    const { policy, log, armed } = setup();
    policy.pageHidden();
    expect(log).toEqual(["flush"]);
    expect(armed()).toBe(0);
  });

  test("dispose clears a pending stop timer", () => {
    const { policy, log, advance, armed } = setup();
    policy.visibilityChanged("hidden");
    policy.dispose();
    expect(armed()).toBe(0);
    advance(10_000);
    expect(log).toEqual(["flush"]);
  });
});
