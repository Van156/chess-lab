import type { ImportStatus } from "@b2c-template/api/context";
import { describe, expect, test } from "bun:test";

import { createImportRunner } from "./import-runner";

const idle: ImportStatus = { state: "idle", lastSyncedAt: null, retryAt: null, gamesImported: 0 };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("import runner", () => {
  test("starts in the background and returns the status without waiting", async () => {
    const gate = deferred();
    const runner = createImportRunner({
      status: () => Promise.resolve(idle),
      startSync: () =>
        Promise.resolve({ status: { ...idle, state: "running" }, done: gate.promise }),
    });
    const status = await runner.start("u1");
    expect(status.state).toBe("running");
    expect(runner.activeCount()).toBe(1);
    gate.resolve();
    await gate.promise;
    await Promise.resolve();
    expect(runner.activeCount()).toBe(0);
  });

  test("a second start for the same user does not start another import", async () => {
    const gate = deferred();
    let starts = 0;
    const runner = createImportRunner({
      status: () => Promise.resolve({ ...idle, state: "running" }),
      startSync: () => {
        starts += 1;
        return Promise.resolve({ status: { ...idle, state: "running" }, done: gate.promise });
      },
    });
    await runner.start("u1");
    await runner.start("u1");
    expect(starts).toBe(1);
    gate.resolve();
  });

  test("stop aborts every running import", async () => {
    const signals: AbortSignal[] = [];
    const never = new Promise<void>(() => {});
    const runner = createImportRunner({
      status: () => Promise.resolve(idle),
      startSync: (_userId, signal) => {
        signals.push(signal);
        return Promise.resolve({ status: idle, done: never });
      },
    });
    await runner.start("u1");
    await runner.start("u2");
    runner.stop();
    expect(signals.map((signal) => signal.aborted)).toEqual([true, true]);
    expect(runner.activeCount()).toBe(0);
  });

  test("a failed start releases the slot and rethrows", async () => {
    const runner = createImportRunner({
      status: () => Promise.resolve(idle),
      startSync: () => Promise.reject(new Error("db down")),
    });
    await expect(runner.start("u1")).rejects.toThrow("db down");
    expect(runner.activeCount()).toBe(0);
  });
});
