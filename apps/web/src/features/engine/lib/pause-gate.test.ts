import { describe, expect, test } from "bun:test";

import { createPauseGate } from "./pause-gate";

describe("createPauseGate", () => {
  test("an open gate resolves at once", async () => {
    await createPauseGate().whenOpen();
  });

  test("a closed gate holds waiters until it opens", async () => {
    const gate = createPauseGate();
    gate.setPaused(true);
    let woke = false;
    const waiting = gate.whenOpen().then(() => {
      woke = true;
    });
    await Promise.resolve();
    expect(woke).toBe(false);
    gate.setPaused(false);
    await waiting;
    expect(woke).toBe(true);
  });

  test("notifies listeners on close only, until unsubscribed", () => {
    const gate = createPauseGate();
    let closed = 0;
    const off = gate.onPause(() => closed++);
    gate.setPaused(true);
    gate.setPaused(true);
    gate.setPaused(false);
    expect(closed).toBe(1);
    off();
    gate.setPaused(true);
    expect(closed).toBe(1);
  });
});
