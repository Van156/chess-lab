/**
 * The audit action catalogue as runtime values (pure: no drizzle or better-auth import, so the
 * browser can import it through `@b2c-template/auth/audit/actions`). `types.ts` derives the
 * action types from these lists, so the catalogue and the compile-time types cannot drift.
 */

/** Platform-scoped actions. */
export const PLATFORM_AUDIT_ACTIONS = [
  "user.banned",
  "user.unbanned",
  "user.impersonation_started",
  "user.impersonation_stopped",
  "user.platform_role_changed",
] as const;

/** User-scoped actions (account security events). */
export const USER_AUDIT_ACTIONS = [
  "user.email_changed",
  "user.password_changed",
  "user.password_reset",
  "user.session_revoked",
  "user.deleted",
] as const;

export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];
export type UserAuditAction = (typeof USER_AUDIT_ACTIONS)[number];
