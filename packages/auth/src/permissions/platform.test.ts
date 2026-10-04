import { describe, expect, test } from "bun:test";

import { platformAc, platformStatements, superadmin, user } from "./platform";

describe("platformStatements", () => {
  test("matches better-auth's admin plugin defaults", () => {
    expect(platformStatements.user).toEqual([
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "impersonate-admins",
      "delete",
      "set-password",
      "set-email",
      "get",
      "update",
    ]);
    expect(platformStatements.session).toEqual(["list", "revoke", "delete"]);
  });

  test("adds audit (platform activity log, R7.5)", () => {
    expect(platformStatements.audit).toEqual(["read"]);
  });
});

describe("platformAc", () => {
  test("is built from platformStatements", () => {
    expect(platformAc.statements).toBe(platformStatements);
  });
});

describe("superadmin role", () => {
  test("manages users and sessions and can impersonate regular users", () => {
    expect(superadmin.authorize({ user: ["impersonate"] }).success).toBe(true);
    expect(superadmin.authorize({ user: ["ban", "delete", "set-role"] }).success).toBe(true);
    expect(superadmin.authorize({ session: ["revoke", "list", "delete"] }).success).toBe(true);
  });

  test("cannot impersonate other superadmins (spec R6.4)", () => {
    expect(superadmin.authorize({ user: ["impersonate-admins"] }).success).toBe(false);
  });

  test("can read the platform activity log (R7.5, R6.7)", () => {
    expect(superadmin.authorize({ audit: ["read"] }).success).toBe(true);
  });
});

describe("user role", () => {
  test("has no platform permissions", () => {
    expect(user.authorize({ user: ["get"] }).success).toBe(false);
    expect(user.authorize({ session: ["list"] }).success).toBe(false);
  });

  test("cannot read the platform activity log", () => {
    expect(user.authorize({ audit: ["read"] }).success).toBe(false);
  });
});
