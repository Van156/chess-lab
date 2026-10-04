import { describe, expect, test } from "bun:test";

import * as permissions from "./index";

describe("permissions barrel", () => {
  test("re-exports the platform catalog", () => {
    expect(permissions.platformAc).toBeDefined();
    expect(permissions.platformRoles).toBeDefined();
    expect(permissions.platformStatements.audit).toEqual(["read"]);
  });
});
