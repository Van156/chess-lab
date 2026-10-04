import { call, ORPCError } from "@orpc/server";
import { describe, expect, test } from "bun:test";

import type { Context, ImportStatus, LichessPort } from "../context";
import { lichessRouter } from "./lichess";

const HOUR = 60 * 60 * 1000;

const idle = (lastSyncedAt: Date | null): ImportStatus => ({
  state: "idle",
  lastSyncedAt,
  retryAt: null,
  gamesImported: 7,
});

/** Port stub that records the user ids it was asked about. */
function fakePort(current: ImportStatus) {
  const calls = { status: [] as string[], requestSync: [] as string[] };
  let latest = current;
  const port: LichessPort = {
    status: (userId) => {
      calls.status.push(userId);
      return Promise.resolve(latest);
    },
    requestSync: (userId) => {
      calls.requestSync.push(userId);
      latest = { ...latest, state: "running" };
      return Promise.resolve(latest);
    },
  };
  return { port, calls };
}

function context(port: LichessPort, userId: string | null = "u1"): Context {
  return {
    session: userId ? { user: { id: userId } } : null,
    lichess: port,
  } as unknown as Context;
}

describe("lichess router", () => {
  test("status enqueues a sync when the last one is older than 6 hours", async () => {
    const { port, calls } = fakePort(idle(new Date(Date.now() - 7 * HOUR)));
    const result = await call(lichessRouter.status, undefined, { context: context(port) });
    expect(calls.requestSync).toEqual(["u1"]);
    expect(result.state).toBe("running");
  });

  test("status enqueues a first sync when the user never synced", async () => {
    const { port, calls } = fakePort(idle(null));
    await call(lichessRouter.status, undefined, { context: context(port) });
    expect(calls.requestSync).toEqual(["u1"]);
  });

  test("status does not enqueue when the last sync is fresh", async () => {
    const fresh = idle(new Date(Date.now() - HOUR));
    const { port, calls } = fakePort(fresh);
    const result = await call(lichessRouter.status, undefined, { context: context(port) });
    expect(calls.requestSync).toEqual([]);
    expect(result).toEqual(fresh);
  });

  test("status does not enqueue while an import is running", async () => {
    const { port, calls } = fakePort({ ...idle(null), state: "running" });
    const result = await call(lichessRouter.status, undefined, { context: context(port) });
    expect(calls.requestSync).toEqual([]);
    expect(result.state).toBe("running");
  });

  test("status never throws when the port reports an import already running", async () => {
    const port: LichessPort = {
      status: () => Promise.resolve(idle(null)),
      requestSync: () => Promise.resolve({ ...idle(null), state: "running" }),
    };
    await expect(
      call(lichessRouter.status, undefined, { context: context(port) }),
    ).resolves.toMatchObject({
      state: "running",
    });
  });

  test("sync requests a sync for the session user and returns the status", async () => {
    const { port, calls } = fakePort(idle(new Date(Date.now() - HOUR)));
    const result = await call(lichessRouter.sync, undefined, { context: context(port, "u9") });
    expect(calls.requestSync).toEqual(["u9"]);
    expect(result.state).toBe("running");
  });

  test("both procedures act only on the session user, never on input", async () => {
    const { port, calls } = fakePort(idle(null));
    await call(lichessRouter.status, undefined, { context: context(port, "owner") });
    await call(lichessRouter.sync, undefined, { context: context(port, "owner") });
    expect([...calls.status, ...calls.requestSync].every((id) => id === "owner")).toBe(true);
  });

  test("unauthenticated callers are rejected", async () => {
    const { port, calls } = fakePort(idle(null));
    for (const procedure of [lichessRouter.status, lichessRouter.sync]) {
      let error: unknown;
      try {
        await call(procedure, undefined, { context: context(port, null) });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(ORPCError);
      expect((error as ORPCError<string, unknown>).code).toBe("UNAUTHORIZED");
    }
    expect(calls.status).toEqual([]);
    expect(calls.requestSync).toEqual([]);
  });
});
