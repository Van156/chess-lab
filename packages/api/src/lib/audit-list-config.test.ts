import { describe, expect, test } from "bun:test";

import {
  userAuditListConfig,
  USER_LOG_ACTIONS,
  platformAuditListConfig,
  PLATFORM_LOG_ACTIONS,
} from "./audit-list-config";
import { createListInput } from "./list-input";

const action = (value: string) => ({ id: "action", variant: "select", operator: "eq", value });

describe("audit list configs", () => {
  const platform = createListInput(platformAuditListConfig);

  test("default to newest first", () => {
    expect(platform.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
  });

  test("the platform list accepts every platform action and no other", () => {
    for (const value of PLATFORM_LOG_ACTIONS) {
      expect(platform.safeParse({ filters: [action(value)] }).success).toBe(true);
    }
    expect(platform.safeParse({ filters: [action("user.password_changed")] }).success).toBe(false);
    expect(platform.safeParse({ filters: [action("nope")] }).success).toBe(false);
  });

  test("the platform list offers no scope or tenant column", () => {
    const scope = { id: "scope", variant: "select", operator: "eq", value: "platform" };
    const tenant = { id: "tenant", variant: "text", operator: "eq", value: "x" };
    expect(platform.safeParse({ filters: [scope] }).success).toBe(false);
    expect(platform.safeParse({ filters: [tenant] }).success).toBe(false);
    expect(platform.safeParse({ sort: [{ id: "scope", desc: false }] }).success).toBe(false);
  });

  test("the actor id column is filterable but not sortable", () => {
    expect(platform.safeParse({ sort: [{ id: "actor", desc: false }] }).success).toBe(false);
  });

  test("the user list accepts user actions only, sorts by date or action and defaults to newest first", () => {
    const user = createListInput(userAuditListConfig);
    expect(user.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
    for (const value of USER_LOG_ACTIONS) {
      expect(user.safeParse({ filters: [action(value)] }).success).toBe(true);
    }
    expect(user.safeParse({ filters: [action("user.banned")] }).success).toBe(false);
    expect(user.safeParse({ sort: [{ id: "action", desc: false }] }).success).toBe(true);
    expect(user.safeParse({ sort: [{ id: "scope", desc: false }] }).success).toBe(false);
  });
});
