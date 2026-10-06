import { describe, expect, test } from "bun:test";

import { SYNC_REQUEST_FAILED, withSyncRequestError } from "./sync-error";

const idle = { tone: "neutral", message: "Last synced 12 min ago", canSync: true } as const;

describe("withSyncRequestError", () => {
  test("leaves the description alone when the request did not fail", () => {
    expect(withSyncRequestError(idle, false)).toBe(idle);
  });

  test("a failed request reads as an error the user can retry", () => {
    expect(withSyncRequestError(idle, true)).toEqual({
      tone: "error",
      message: SYNC_REQUEST_FAILED,
      canSync: true,
    });
  });

  test("a sync the server reports as running or backing off wins over the failed request", () => {
    const running = {
      tone: "progress",
      message: "Syncing your Lichess games",
      canSync: false,
    } as const;
    const backoff = { tone: "warning", message: "Retrying in 4 min.", canSync: false } as const;
    expect(withSyncRequestError(running, true)).toBe(running);
    expect(withSyncRequestError(backoff, true)).toBe(backoff);
  });
});
