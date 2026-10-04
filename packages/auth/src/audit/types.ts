// Audit log port (spec §5, R7). Lives in `@b2c-template/auth` so hooks and `@b2c-template/api`
// can both use `AuditLogger` without a dependency cycle. See docs/architecture/audit-log.md.

import type { PlatformAuditAction, UserAuditAction } from "./actions";

/**
 * `audit_log.scope`: `platform` entries are operator-level, `user` ones are a person's own
 * security trail.
 */
export type AuditScope = "platform" | "user";

export type { PlatformAuditAction, UserAuditAction } from "./actions";

export type AuditAction = PlatformAuditAction | UserAuditAction;

/** Fields common to every audit event, regardless of scope. */
type AuditEventBase = {
  /** The acting user. The column is nullable only for `ON DELETE SET NULL`; a write always knows it. */
  actorUserId: string;
  /** Set only when the actor's session was impersonated by a superadmin. */
  impersonatorUserId?: string | null;
  /** e.g. "user". */
  targetType: string;
  targetId: string;
  /** Before/after values plus a readable snapshot (`actorEmail`, ...) that outlives deleted rows. MUST NEVER contain secrets, tokens or passwords. */
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** One event to record. Discriminated on `scope` at compile time, pairing each scope with its action catalogue. */
export type AuditEvent =
  | (AuditEventBase & {
      scope: "platform";
      action: PlatformAuditAction;
    })
  | (AuditEventBase & {
      scope: "user";
      action: UserAuditAction;
    });

/** Audit port. Implementations MUST NOT silently drop a failed write. */
export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}
