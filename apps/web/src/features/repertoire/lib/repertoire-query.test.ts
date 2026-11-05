import { describe, expect, test } from "bun:test";

import { isNotFound, REPERTOIRE_MAX_RETRIES, shouldRetryRepertoire } from "./repertoire-query";

describe("isNotFound", () => {
  test("recognises an oRPC NOT_FOUND and nothing else", () => {
    expect(isNotFound({ code: "NOT_FOUND" })).toBe(true);
    expect(isNotFound({ code: "BAD_REQUEST" })).toBe(false);
    expect(isNotFound(new Error("x"))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});

describe("shouldRetryRepertoire", () => {
  test("never retries NOT_FOUND (unknown, foreign or flag off)", () => {
    expect(shouldRetryRepertoire(0, { code: "NOT_FOUND" })).toBe(false);
  });

  test("retries other failures up to the budget", () => {
    expect(shouldRetryRepertoire(0, new Error("network"))).toBe(true);
    expect(shouldRetryRepertoire(REPERTOIRE_MAX_RETRIES, new Error("network"))).toBe(false);
  });
});
