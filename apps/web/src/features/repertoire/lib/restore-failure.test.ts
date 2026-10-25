import { describe, expect, test } from "bun:test";

import { describeRestoreFailure, isMoveExistsConflict } from "./restore-failure";

const orpc = (code: string, status: number, data?: unknown) =>
  Object.assign(new Error(code), { code, status, data });

describe("describeRestoreFailure", () => {
  test.each([
    ["parent_missing", "Can't undo: the move it came from was deleted."],
    ["edge_exists", "Can't undo: that move was added again."],
    ["move_exists", "Can't undo: that move already exists."],
    ["position_conflict", "Can't undo: the position changed since."],
  ])("a CONFLICT for %s is final and says why", (reason, message) => {
    expect(describeRestoreFailure(orpc("CONFLICT", 409, { reason }))).toEqual({
      message,
      retryable: false,
    });
  });

  test("a CONFLICT without a known reason is final", () => {
    expect(describeRestoreFailure(orpc("CONFLICT", 409))).toEqual({
      message: "Can't undo: the repertoire changed since.",
      retryable: false,
    });
    expect(describeRestoreFailure(orpc("CONFLICT", 409, { reason: "other" })).retryable).toBe(
      false,
    );
  });

  test("BAD_REQUEST and NOT_FOUND are final", () => {
    expect(describeRestoreFailure(orpc("BAD_REQUEST", 400))).toEqual({
      message: "Can't undo: this deletion can no longer be restored.",
      retryable: false,
    });
    expect(describeRestoreFailure(orpc("NOT_FOUND", 404))).toEqual({
      message: "Can't undo: this repertoire is no longer available.",
      retryable: false,
    });
  });

  test("a server error is transient", () => {
    expect(describeRestoreFailure(orpc("INTERNAL_SERVER_ERROR", 500))).toEqual({
      message: "Couldn't undo. Try again.",
      retryable: true,
    });
    expect(describeRestoreFailure(orpc("BAD_GATEWAY", 502)).retryable).toBe(true);
  });

  test("an error without a code, such as a network failure, is transient", () => {
    expect(describeRestoreFailure(new TypeError("Failed to fetch")).retryable).toBe(true);
    expect(describeRestoreFailure("boom").retryable).toBe(true);
    expect(describeRestoreFailure(null).retryable).toBe(true);
  });

  test("rate limits and timeouts are transient", () => {
    for (const [code, status] of [
      ["TOO_MANY_REQUESTS", 429],
      ["TIMEOUT", 408],
    ] as const) {
      expect(describeRestoreFailure(orpc(code, status))).toEqual({
        message: "Couldn't undo. Try again.",
        retryable: true,
      });
    }
  });

  test("a clear authorization error is final and says so", () => {
    for (const [code, status] of [
      ["UNAUTHORIZED", 401],
      ["FORBIDDEN", 403],
    ] as const) {
      expect(describeRestoreFailure(orpc(code, status))).toEqual({
        message: "Can't undo: you are not allowed to change this repertoire.",
        retryable: false,
      });
    }
  });

  test("any other client error is final with a neutral message", () => {
    expect(describeRestoreFailure(orpc("PAYLOAD_TOO_LARGE", 413))).toEqual({
      message: "Can't undo right now.",
      retryable: false,
    });
    expect(describeRestoreFailure(orpc("SOMETHING_NEW", 418)).retryable).toBe(false);
  });
});

describe("isMoveExistsConflict", () => {
  test("is true only for a CONFLICT whose reason is move_exists", () => {
    expect(isMoveExistsConflict(orpc("CONFLICT", 409, { reason: "move_exists" }))).toBe(true);
    expect(isMoveExistsConflict(orpc("CONFLICT", 409, { reason: "edge_exists" }))).toBe(false);
    expect(isMoveExistsConflict(orpc("CONFLICT", 409))).toBe(false);
    expect(isMoveExistsConflict(orpc("BAD_REQUEST", 400, { reason: "move_exists" }))).toBe(false);
    expect(isMoveExistsConflict(null)).toBe(false);
  });
});
