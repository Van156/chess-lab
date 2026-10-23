import { describe, expect, test } from "bun:test";

import { MAX_NAME_LENGTH, validateRepertoireName } from "./repertoire-name";

describe("validateRepertoireName", () => {
  test("accepts a name of 1 to 80 characters after trimming", () => {
    expect(validateRepertoireName("Sicilian")).toBeNull();
    expect(validateRepertoireName(`  ${"x".repeat(MAX_NAME_LENGTH)}  `)).toBeNull();
  });

  test("asks for a name when it is empty or only spaces", () => {
    expect(validateRepertoireName("")).toBe("Enter a name.");
    expect(validateRepertoireName("   ")).toBe("Enter a name.");
  });

  test("rejects a name over 80 characters", () => {
    expect(validateRepertoireName("x".repeat(MAX_NAME_LENGTH + 1))).toBe(
      "The name must be 80 characters or fewer.",
    );
  });
});
