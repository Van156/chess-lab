import { describe, expect, test } from "bun:test";

import {
  formatAuditAction,
  formatAuditTarget,
  formatUserAuditAction,
  formatUserAuditDetail,
  resolveActorLabel,
} from "./audit-log-display";

describe("resolveActorLabel (readable actor for an audit_log row)", () => {
  test("shortens a user id, since the log only stores ids", () => {
    expect(resolveActorLabel("u3-not-a-current-user")).toBe("u3-not-a…");
  });

  test("null actor (system) reads as System", () => {
    expect(resolveActorLabel(null)).toBe("System");
  });
});

describe("formatAuditAction", () => {
  test("replaces dots and underscores with spaces for a readable label", () => {
    expect(formatAuditAction("user.platform_role_changed")).toBe("user platform role changed");
    expect(formatAuditAction("user.impersonation_started")).toBe("user impersonation started");
  });
});

describe("formatAuditTarget", () => {
  test("shows type and id, type alone, or an em dash", () => {
    expect(formatAuditTarget({ targetType: "user", targetId: "u1" })).toBe("user (u1)");
    expect(formatAuditTarget({ targetType: "user", targetId: null })).toBe("user");
    expect(formatAuditTarget({ targetType: null, targetId: "u1" })).toBe("—");
  });
});

describe("formatUserAuditAction", () => {
  test("labels each user-scoped action", () => {
    expect(formatUserAuditAction("user.email_changed")).toBe("Email changed");
    expect(formatUserAuditAction("user.session_revoked")).toBe("Session signed out");
    expect(formatUserAuditAction("user.deleted")).toBe("Account deleted");
  });

  test("falls back to the generic label for an unknown action", () => {
    expect(formatUserAuditAction("user.something_new")).toBe("user something new");
  });
});

describe("formatUserAuditDetail (R7.1)", () => {
  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  test("shows old and new email for an email change", () => {
    expect(
      formatUserAuditDetail({
        action: "user.email_changed",
        metadata: { oldEmail: "a@old.test", newEmail: "a@new.test" },
      }),
    ).toBe("a@old.test → a@new.test");
  });

  test("shows the device and IP of a revoked session", () => {
    expect(
      formatUserAuditDetail({
        action: "user.session_revoked",
        metadata: { sessionUserAgent: CHROME_MAC, sessionIp: "203.0.113.7" },
      }),
    ).toBe("Chrome on macOS · 203.0.113.7");
    expect(
      formatUserAuditDetail({
        action: "user.session_revoked",
        metadata: { sessionUserAgent: null, sessionIp: "203.0.113.7" },
      }),
    ).toBe("203.0.113.7");
    expect(formatUserAuditDetail({ action: "user.session_revoked", metadata: {} })).toBeNull();
  });

  test("notes the session revocation of password rows", () => {
    expect(
      formatUserAuditDetail({
        action: "user.password_changed",
        metadata: { otherSessionsRevoked: true },
      }),
    ).toBe("Other sessions were signed out");
    expect(
      formatUserAuditDetail({
        action: "user.password_reset",
        metadata: { allSessionsRevoked: true },
      }),
    ).toBe("All sessions were signed out");
  });

  test("is null for missing, malformed or unrelated metadata", () => {
    expect(formatUserAuditDetail({ action: "user.password_changed", metadata: null })).toBeNull();
    expect(formatUserAuditDetail({ action: "user.email_changed", metadata: "oops" })).toBeNull();
    expect(
      formatUserAuditDetail({ action: "user.deleted", metadata: { userName: "Ada" } }),
    ).toBeNull();
  });
});
