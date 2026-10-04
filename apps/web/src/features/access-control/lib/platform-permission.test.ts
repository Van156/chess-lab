import { describe, expect, test } from "bun:test";

import { parsePlatformPermission } from "./platform-permission";

describe("parsePlatformPermission", () => {
  test("splits a `feature:action` string", () => {
    expect(parsePlatformPermission("user:ban")).toEqual({ feature: "user", action: "ban" });
    expect(parsePlatformPermission("audit:read")).toEqual({ feature: "audit", action: "read" });
  });

  test("rejects strings that are not `feature:action`", () => {
    for (const bad of ["", "user", ":ban", "user:", "a:b:c"]) {
      expect(() => parsePlatformPermission(bad)).toThrow(`Invalid permission "${bad}"`);
    }
  });
});
