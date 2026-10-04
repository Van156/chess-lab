import { describe, expect, test } from "bun:test";

import { getPlatformAuditCsvColumns } from "./audit-log-export";
import { toCsv } from "@/shared/lib/data-table/csv";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "row-1",
  actorUserId: "user-1",
  impersonatorUserId: null,
  action: "user.banned",
  targetType: "user",
  targetId: "user-9",
  metadata: null,
  ip: null,
  userAgent: null,
  createdAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
  ...overrides,
});

describe("audit log CSV columns", () => {
  test("platform export writes time, actor, action and target", () => {
    const csv = toCsv([row()], getPlatformAuditCsvColumns());
    expect(csv).toBe(
      "When,Actor,Actor ID,Action,Target type,Target ID\r\n" +
        "2026-01-02T03:04:05.000Z,user-1…,user-1,user.banned,user,user-9\r\n",
    );
  });

  test("a missing actor is System and a long id is shortened", () => {
    const csv = toCsv(
      [row({ actorUserId: "abcdefghijkl" }), row({ actorUserId: null })],
      getPlatformAuditCsvColumns(),
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain(",abcdefgh…,abcdefghijkl,");
    expect(lines[2]).toContain(",System,,");
  });

  test("text from the log cannot become a formula", () => {
    const csv = toCsv([row({ targetType: "=HYPERLINK(1)" })], getPlatformAuditCsvColumns());
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
