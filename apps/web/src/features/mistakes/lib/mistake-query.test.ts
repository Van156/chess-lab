import { describe, expect, test } from "bun:test";

import { MISTAKE_MAX_RETRIES, shouldRetryMistake } from "./mistake-query";

describe("shouldRetryMistake", () => {
  test("never retries NOT_FOUND", () => {
    expect(shouldRetryMistake(0, { code: "NOT_FOUND" })).toBe(false);
  });

  test("retries other failures up to the budget", () => {
    expect(shouldRetryMistake(0, new Error("network"))).toBe(true);
    expect(shouldRetryMistake(0, { code: "INTERNAL_SERVER_ERROR" })).toBe(true);
    expect(shouldRetryMistake(MISTAKE_MAX_RETRIES - 1, new Error("network"))).toBe(true);
    expect(shouldRetryMistake(MISTAKE_MAX_RETRIES, new Error("network"))).toBe(false);
  });
});
