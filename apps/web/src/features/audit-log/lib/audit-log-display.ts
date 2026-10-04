import { describeUserAgent } from "@/shared/lib/user-agent";

/**
 * A human-readable label for an `audit_log` row's `actorUserId`. The log only stores the id, so a
 * user is shown as a shortened id (append-only: the row must stay readable even after the actor
 * is gone); no actor reads as System.
 */
export function resolveActorLabel(actorUserId: string | null): string {
  return actorUserId ? `${actorUserId.slice(0, 8)}…` : "System";
}

/** Turns an R7.1 action string (`"user.platform_role_changed"`) into a readable label (`"user platform role changed"`). */
export function formatAuditAction(action: string): string {
  return action.replace(/[._]/g, " ");
}

/** The "Target" cell of an audit row: `type (id)`, `type`, or an em dash when there is no target. */
export function formatAuditTarget(entry: {
  targetType: string | null;
  targetId: string | null;
}): string {
  if (!entry.targetType) {
    return "—";
  }
  return entry.targetId ? `${entry.targetType} (${entry.targetId})` : entry.targetType;
}

const USER_ACTION_LABELS: Record<string, string> = {
  "user.email_changed": "Email changed",
  "user.password_changed": "Password changed",
  "user.password_reset": "Password reset",
  "user.session_revoked": "Session signed out",
  "user.deleted": "Account deleted",
};

/** Label of a user-scoped (security log) action; unknown actions fall back to `formatAuditAction`. */
export function formatUserAuditAction(action: string): string {
  return USER_ACTION_LABELS[action] ?? formatAuditAction(action);
}

function readText(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readFlag(metadata: unknown, key: string): boolean {
  return (
    Boolean(metadata) &&
    typeof metadata === "object" &&
    (metadata as Record<string, unknown>)[key] === true
  );
}

/**
 * A short, human-readable detail for a security log row (R7.1), read from the row's `metadata`
 * snapshot (never from live user data, so it stays accurate after the user changes). `null` when
 * the action has nothing worth showing.
 */
export function formatUserAuditDetail(entry: { action: string; metadata: unknown }): string | null {
  const { action, metadata } = entry;
  switch (action) {
    case "user.email_changed": {
      const oldEmail = readText(metadata, "oldEmail");
      const newEmail = readText(metadata, "newEmail");
      return oldEmail && newEmail ? `${oldEmail} → ${newEmail}` : (newEmail ?? oldEmail);
    }
    case "user.session_revoked": {
      const agent = readText(metadata, "sessionUserAgent");
      const device = agent ? describeUserAgent(agent) : null;
      const ip = readText(metadata, "sessionIp");
      return [device, ip].filter(Boolean).join(" · ") || null;
    }
    case "user.password_changed":
      return readFlag(metadata, "otherSessionsRevoked") ? "Other sessions were signed out" : null;
    case "user.password_reset":
      return readFlag(metadata, "allSessionsRevoked") ? "All sessions were signed out" : null;
    default:
      return null;
  }
}
