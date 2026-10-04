import { describe, expect, test } from "bun:test";

import { isSyntheticEmail, syntheticEmail } from "./synthetic-email";

describe("syntheticEmail", () => {
  test("derives a non-deliverable address from the Lichess id", () => {
    expect(syntheticEmail("thibault")).toBe("thibault@lichess.invalid");
  });

  test("is unique per id", () => {
    expect(syntheticEmail("a")).not.toBe(syntheticEmail("b"));
  });
});

describe("isSyntheticEmail", () => {
  test("recognises synthetic addresses, case-insensitively and trimmed", () => {
    expect(isSyntheticEmail("thibault@lichess.invalid")).toBe(true);
    expect(isSyntheticEmail("  Thibault@LICHESS.INVALID ")).toBe(true);
  });

  test("rejects real addresses and look-alike domains", () => {
    expect(isSyntheticEmail("user@example.com")).toBe(false);
    expect(isSyntheticEmail("user@lichess.org")).toBe(false);
    expect(isSyntheticEmail("user@evil.lichess.invalid.example.com")).toBe(false);
    expect(isSyntheticEmail("lichess.invalid")).toBe(false);
  });
});
