import { platformRoles } from "@b2c-template/auth/permissions/platform";
import { describe, expect, test } from "bun:test";

import { createListInput } from "./list-input";
import {
  PLATFORM_ROLE_NAMES,
  platformUsersListConfig,
  USER_STATUSES,
} from "./platform-list-config";

describe("platform list configs", () => {
  test("the role names are the platform roles", () => {
    expect([...PLATFORM_ROLE_NAMES].sort() as string[]).toEqual(Object.keys(platformRoles).sort());
  });

  test("the users list defaults to newest first", () => {
    expect(createListInput(platformUsersListConfig).parse({}).sort).toEqual([
      { id: "createdAt", desc: true },
    ]);
  });

  test("users accept every role and status and reject others", () => {
    const users = createListInput(platformUsersListConfig);
    const select = (id: string, value: string) => ({
      id,
      variant: "select",
      operator: "eq",
      value,
    });
    for (const role of PLATFORM_ROLE_NAMES) {
      expect(users.safeParse({ filters: [select("role", role)] }).success).toBe(true);
    }
    for (const status of USER_STATUSES) {
      expect(users.safeParse({ filters: [select("status", status)] }).success).toBe(true);
    }
    expect(users.safeParse({ filters: [select("role", "root")] }).success).toBe(false);
  });

  test("unlisted columns (banned, banReason, status) are neither sortable nor filterable", () => {
    const users = createListInput(platformUsersListConfig);
    expect(users.safeParse({ sort: [{ id: "banReason", desc: false }] }).success).toBe(false);
    expect(users.safeParse({ sort: [{ id: "status", desc: false }] }).success).toBe(false);
  });
});
