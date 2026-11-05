import { describe, expect, test } from "bun:test";

import {
  backoffDelay,
  bindFlushTriggers,
  createGradeOutbox,
  flushWithin,
  isNonRetryableGradeError,
  outboxKey,
  type GradeEntry,
  type OutboxStorage,
} from "./grade-outbox";
import { OUTBOX_MAX_ATTEMPTS } from "../config";

function fakeStorage(initial: Record<string, string> = {}): OutboxStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

type Submit = (entry: GradeEntry) => Promise<unknown>;

function setup(
  options: {
    userId?: string;
    storage?: OutboxStorage;
    submit?: Submit;
    isActive?: () => boolean;
  } = {},
) {
  const storage = options.storage ?? fakeStorage();
  const submitted: GradeEntry[] = [];
  const logs: string[] = [];
  const scheduled: { delayMs: number; run: () => void }[] = [];
  let counter = 0;
  const outbox = createGradeOutbox({
    userId: options.userId ?? "u1",
    storage,
    submit:
      options.submit ??
      (async (entry) => {
        submitted.push(entry);
      }),
    isActive: options.isActive,
    newId: () => `log-${++counter}`,
    schedule: (run, delayMs) => void scheduled.push({ run, delayMs }),
    log: (message) => logs.push(message),
  });
  return { outbox, storage, submitted, logs, scheduled };
}

const input = (cardId: string) => ({
  cardId,
  grade: 3 as const,
  elapsedMs: 1200,
  reviewedAt: "2026-10-04T12:00:00.000Z",
});

function orpcError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("grade outbox storage", () => {
  test("keys the queue per user", () => {
    expect(outboxKey("u1")).toBe("chesslab.grade-outbox.v1.u1");
    const storage = fakeStorage();
    const a = setup({ userId: "a", storage });
    const b = setup({ userId: "b", storage });
    a.outbox.append(input("card-a"));
    expect(a.outbox.pending().map((e) => e.cardId)).toEqual(["card-a"]);
    expect(b.outbox.pending()).toEqual([]);
  });

  test("append is synchronous and survives a reload", () => {
    const storage = fakeStorage();
    const first = setup({ storage });
    const entry = first.outbox.append(input("c1"));
    expect(entry).toMatchObject({ reviewLogId: "log-1", cardId: "c1", grade: 3 });

    const reloaded = setup({ storage });
    expect(reloaded.outbox.pending()).toEqual([entry]);
  });

  test("a corrupt stored value reads as empty and is logged", () => {
    const storage = fakeStorage({ [outboxKey("u1")]: "{not json" });
    const { outbox, logs } = setup({ storage });
    expect(outbox.pending()).toEqual([]);
    expect(logs).toHaveLength(1);
  });

  test("a storage write failure is logged and reported, never thrown", () => {
    const storage: OutboxStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const { outbox, logs } = setup({ storage });
    expect(() => outbox.append(input("c1"))).not.toThrow();
    expect(logs.some((line) => line.includes("persist"))).toBe(true);
  });
});

describe("grade outbox flush", () => {
  test("submits in FIFO order and empties the queue", async () => {
    const { outbox, submitted } = setup();
    outbox.append(input("c1"));
    outbox.append(input("c2"));
    outbox.append(input("c3"));
    await outbox.flush();
    expect(submitted.map((e) => e.cardId)).toEqual(["c1", "c2", "c3"]);
    expect(outbox.pending()).toEqual([]);
  });

  test("concurrent flushes share one pass (no duplicate submits)", async () => {
    const { outbox, submitted } = setup();
    outbox.append(input("c1"));
    await Promise.all([outbox.flush(), outbox.flush()]);
    expect(submitted).toHaveLength(1);
  });

  test("a network error keeps the entry and schedules a backoff retry", async () => {
    let fail = true;
    const seen: string[] = [];
    const { outbox, scheduled } = setup({
      submit: async (entry) => {
        seen.push(entry.reviewLogId);
        if (fail) throw new TypeError("Failed to fetch");
      },
    });
    outbox.append(input("c1"));
    outbox.append(input("c2"));
    await outbox.flush();
    expect(outbox.pending().map((e) => e.cardId)).toEqual(["c1", "c2"]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.delayMs).toBe(backoffDelay(1));

    fail = false;
    scheduled[0]?.run();
    await outbox.flush();
    expect(outbox.pending()).toEqual([]);
    // The retry replays the same review id (idempotent on the server).
    expect(seen.slice(0, 2)).toEqual(["log-1", "log-1"]);
  });

  test("backoff grows with consecutive failures and resets after a success", async () => {
    let fail = true;
    const { outbox, scheduled } = setup({
      submit: async () => {
        if (fail) throw new TypeError("offline");
      },
    });
    outbox.append(input("c1"));
    await outbox.flush();
    for (const retry of [0, 1]) {
      scheduled[retry]?.run();
      await outbox.flush();
    }
    expect(scheduled.map((s) => s.delayMs)).toEqual([
      backoffDelay(1),
      backoffDelay(2),
      backoffDelay(3),
    ]);
    expect(backoffDelay(2)).toBeGreaterThan(backoffDelay(1));

    fail = false;
    scheduled[2]?.run();
    await outbox.flush();
    expect(outbox.pending()).toEqual([]);
    fail = true;
    outbox.append(input("c2"));
    await outbox.flush();
    expect(scheduled.at(-1)?.delayMs).toBe(backoffDelay(1));
  });

  test("a non-retryable error is dropped and logged, and the queue moves on", async () => {
    const codes = ["NOT_FOUND", "BAD_REQUEST"];
    const submitted: GradeEntry[] = [];
    const { outbox, logs } = setup({
      submit: async (entry) => {
        const code = codes.shift();
        if (code) throw orpcError(code);
        submitted.push(entry);
      },
    });
    outbox.append(input("c1"));
    outbox.append(input("c2"));
    outbox.append(input("c3"));
    await outbox.flush();
    expect(submitted.map((e) => e.cardId)).toEqual(["c3"]);
    expect(outbox.pending()).toEqual([]);
    expect(logs).toHaveLength(2);
  });

  test("classifies errors: only definitive server rejections are dropped", () => {
    expect(isNonRetryableGradeError(orpcError("NOT_FOUND"))).toBe(true);
    expect(isNonRetryableGradeError(orpcError("BAD_REQUEST"))).toBe(true);
    expect(isNonRetryableGradeError(orpcError("CONFLICT"))).toBe(true);
    expect(isNonRetryableGradeError(orpcError("UNAUTHORIZED"))).toBe(false);
    expect(isNonRetryableGradeError(orpcError("INTERNAL_SERVER_ERROR"))).toBe(false);
    expect(isNonRetryableGradeError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isNonRetryableGradeError("boom")).toBe(false);
  });
});

describe("bindFlushTriggers", () => {
  function fakes() {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "visible" as DocumentVisibilityState,
    });
    let flushes = 0;
    const outbox = {
      flush: async () => {
        flushes += 1;
      },
    };
    return { win, doc, outbox, count: () => flushes };
  }

  test("flushes on bind (app start), on online and when the tab becomes visible", () => {
    const { win, doc, outbox, count } = fakes();
    bindFlushTriggers(outbox, win, doc);
    expect(count()).toBe(1);
    win.dispatchEvent(new Event("online"));
    expect(count()).toBe(2);
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(count()).toBe(3);
  });

  test("ignores visibilitychange while hidden", () => {
    const { win, doc, outbox, count } = fakes();
    bindFlushTriggers(outbox, win, doc);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(count()).toBe(1);
  });

  test("detach removes both listeners", () => {
    const { win, doc, outbox, count } = fakes();
    const detach = bindFlushTriggers(outbox, win, doc);
    detach();
    win.dispatchEvent(new Event("online"));
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(count()).toBe(1);
  });
});

describe("flushWithin", () => {
  test("resolves once the flush completes", async () => {
    let flushed = false;
    await flushWithin({ flush: async () => void (flushed = true) }, 1_000);
    expect(flushed).toBe(true);
  });

  test("gives up after the timeout when the flush hangs", async () => {
    const started = Date.now();
    await flushWithin({ flush: () => new Promise<void>(() => {}) }, 20);
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("never rejects", async () => {
    await flushWithin({ flush: () => Promise.reject(new Error("offline")) }, 1_000);
  });
});

describe("grade outbox ownership", () => {
  test("an inactive outbox neither submits nor removes entries", async () => {
    const { outbox, submitted } = setup({ isActive: () => false });
    outbox.append(input("c1"));
    await outbox.flush();
    expect(submitted).toEqual([]);
    expect(outbox.pending().map((e) => e.cardId)).toEqual(["c1"]);
  });

  test("after dispose a pending retry does not submit and flush is a no-op", async () => {
    let fail = true;
    const sent: GradeEntry[] = [];
    const { outbox, scheduled } = setup({
      submit: async (entry) => {
        if (fail) throw new Error("offline");
        sent.push(entry);
      },
    });
    outbox.append(input("c1"));
    await outbox.flush();
    expect(scheduled).toHaveLength(1);

    fail = false;
    outbox.dispose();
    scheduled[0]?.run();
    await outbox.flush();
    expect(sent).toEqual([]);
    expect(outbox.pending().map((e) => e.cardId)).toEqual(["c1"]);
  });
});

function failingStorage(failWrites: () => boolean): OutboxStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrites()) throw new Error("quota");
      data.set(key, value);
    },
  };
}

describe("grade outbox storage write failures", () => {
  test("a failed remove does not resubmit the same grade", async () => {
    let writesFail = false;
    const storage = failingStorage(() => writesFail);
    const { outbox, submitted } = setup({ storage });
    outbox.append(input("c1"));
    outbox.append(input("c2"));
    writesFail = true;
    await outbox.flush();
    expect(submitted.map((e) => e.cardId)).toEqual(["c1", "c2"]);
    expect(outbox.pending()).toEqual([]);
  });

  test("a grade that could not be persisted is still submitted and logged", async () => {
    const storage = failingStorage(() => true);
    const { outbox, submitted, logs } = setup({ storage });
    const entry = outbox.append(input("c1"));
    expect(outbox.pending()).toEqual([entry]);
    await outbox.flush();
    expect(submitted).toEqual([entry]);
    expect(outbox.pending()).toEqual([]);
    expect(logs.some((line) => line.includes("persist"))).toBe(true);
  });

  test("an unpersisted grade is kept and retried when the submit fails", async () => {
    const storage = failingStorage(() => true);
    let fail = true;
    const { outbox, scheduled } = setup({
      storage,
      submit: async () => {
        if (fail) throw new Error("offline");
      },
    });
    outbox.append(input("c1"));
    await outbox.flush();
    expect(outbox.pending()).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
    fail = false;
    scheduled[0]?.run();
    await outbox.flush();
    expect(outbox.pending()).toEqual([]);
  });
});

describe("grade outbox head-of-line blocking", () => {
  const serverError = () => orpcError("INTERNAL_SERVER_ERROR");

  test("a grade the server keeps failing is set aside, kept in storage and logged", async () => {
    const seen: string[] = [];
    const { outbox, logs } = setup({
      submit: async (entry) => {
        seen.push(entry.cardId);
        if (entry.cardId === "bad") throw serverError();
      },
    });
    outbox.append(input("bad"));
    outbox.append(input("c2"));
    for (let pass = 0; pass < OUTBOX_MAX_ATTEMPTS; pass += 1) {
      await outbox.flush();
    }
    expect(seen).toContain("c2");
    expect(outbox.pending().map((e) => e.cardId)).toEqual(["bad"]);
    expect(logs.some((line) => line.includes("setting aside"))).toBe(true);
    const callsBefore = seen.length;
    await outbox.flush();
    expect(seen).toHaveLength(callsBefore);
  });

  test("network failures and a signed-out session never count towards the cap", async () => {
    const errors = [new Error("offline"), orpcError("UNAUTHORIZED")];
    for (const error of errors) {
      let calls = 0;
      const { outbox } = setup({
        submit: async () => {
          calls += 1;
          throw error;
        },
      });
      outbox.append(input("c1"));
      for (let pass = 0; pass < OUTBOX_MAX_ATTEMPTS + 2; pass += 1) {
        await outbox.flush();
      }
      expect(calls).toBe(OUTBOX_MAX_ATTEMPTS + 2);
    }
  });

  test("the attempt cap counts consecutive server failures: a network failure resets it", async () => {
    const errors: Error[] = [
      ...Array.from({ length: OUTBOX_MAX_ATTEMPTS - 1 }, serverError),
      new Error("offline"),
      ...Array.from({ length: OUTBOX_MAX_ATTEMPTS - 1 }, serverError),
    ];
    let calls = 0;
    const { outbox, logs } = setup({
      submit: async () => {
        const error = errors[calls];
        calls += 1;
        if (error) throw error;
      },
    });
    outbox.append(input("c1"));
    for (let pass = 0; pass < errors.length; pass += 1) {
      await outbox.flush();
    }
    expect(logs.some((line) => line.includes("setting aside"))).toBe(false);
    await outbox.flush();
    expect(calls).toBe(errors.length + 1);
    expect(outbox.pending()).toEqual([]);
  });
});
