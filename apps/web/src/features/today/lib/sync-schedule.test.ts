import { describe, expect, test } from "bun:test";

import { syncPollInterval, shouldRefreshSummary } from "./sync-schedule";
import type { SyncStatus } from "./today-types";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms);

const idle: SyncStatus = {
  state: "idle",
  lastSyncedAt: at(-300_000),
  retryAt: null,
  gamesImported: 20,
};
const running: SyncStatus = { ...idle, state: "running" };
const backoff: SyncStatus = { ...idle, state: "backoff", retryAt: at(120_000) };

describe("shouldRefreshSummary", () => {
  test("does not refresh on the first observation", () => {
    expect(shouldRefreshSummary(undefined, idle)).toBe(false);
  });

  test("does not refresh when nothing changed", () => {
    expect(shouldRefreshSummary(idle, { ...idle })).toBe(false);
    expect(shouldRefreshSummary(running, { ...running })).toBe(false);
  });

  test("does not refresh when the status read is missing", () => {
    expect(shouldRefreshSummary(idle, undefined)).toBe(false);
  });

  test("refreshes when a running sync settles", () => {
    expect(shouldRefreshSummary(running, idle)).toBe(true);
    expect(shouldRefreshSummary(running, { ...idle, state: "failed" })).toBe(true);
  });

  test("refreshes when a backoff ends in idle", () => {
    expect(shouldRefreshSummary(backoff, idle)).toBe(true);
  });

  test("refreshes on running to backoff to idle, step by step", () => {
    expect(shouldRefreshSummary(running, backoff)).toBe(false);
    expect(shouldRefreshSummary(backoff, idle)).toBe(true);
  });

  test("refreshes when a sync finished between polls (idle to idle with new data)", () => {
    expect(shouldRefreshSummary(idle, { ...idle, lastSyncedAt: at(0) })).toBe(true);
    expect(shouldRefreshSummary(idle, { ...idle, gamesImported: 25 })).toBe(true);
  });

  test("refreshes when Sync now returns idle with a first completed sync", () => {
    const never: SyncStatus = { ...idle, lastSyncedAt: null, gamesImported: 0 };
    expect(shouldRefreshSummary(never, idle)).toBe(true);
  });

  test("ignores a changed retryAt while still backing off", () => {
    expect(shouldRefreshSummary(backoff, { ...backoff, retryAt: at(240_000) })).toBe(false);
  });
});

describe("syncPollInterval", () => {
  test("does not poll when idle, failed or unknown", () => {
    expect(syncPollInterval(idle, NOW)).toBe(false);
    expect(syncPollInterval({ ...idle, state: "failed" }, NOW)).toBe(false);
    expect(syncPollInterval(undefined, NOW)).toBe(false);
  });

  test("polls every 5 s while running", () => {
    expect(syncPollInterval(running, NOW)).toBe(5000);
  });

  test("waits until shortly after retryAt during backoff", () => {
    expect(syncPollInterval({ ...backoff, retryAt: at(30_000) }, NOW)).toBe(32_000);
  });

  test("caps a far retryAt so the screen stays fresh", () => {
    expect(syncPollInterval({ ...backoff, retryAt: at(3_600_000) }, NOW)).toBe(60_000);
  });

  test("polls at the minimum when retryAt is past or missing", () => {
    expect(syncPollInterval({ ...backoff, retryAt: at(-10_000) }, NOW)).toBe(5000);
    expect(syncPollInterval({ ...backoff, retryAt: null }, NOW)).toBe(5000);
    expect(syncPollInterval({ ...backoff, retryAt: at(500) }, NOW)).toBe(5000);
  });
});
