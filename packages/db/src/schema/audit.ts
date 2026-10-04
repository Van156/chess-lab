import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * `audit_log` scope: `platform` entries record platform-admin actions, `user` ones are one person's
 * security trail (account settings). See docs/architecture/audit-log.md.
 */
export const auditLogScope = pgEnum("audit_log_scope", ["platform", "user"]);

/**
 * Append-only audit log, written through the `AuditLogger` port. The user references use
 * `ON DELETE SET NULL` so the log outlives the rows it describes; `metadata` snapshots readable
 * context for that reason. See docs/architecture/audit-log.md#table-rules.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    scope: auditLogScope("scope").notNull(),
    // NULL if the actor is deleted; `metadata` (`actorEmail`) still names them.
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    // Set only while a superadmin impersonates `actorUserId` (R7.2, R6.7).
    impersonatorUserId: text("impersonator_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // R7.1 action, e.g. "user.password_changed".
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    // Before/after values plus a readable snapshot. Never secrets, tokens or passwords (R7.2).
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("auditLog_actorUserId_createdAt_idx").on(table.actorUserId, table.createdAt),
    index("auditLog_scope_createdAt_idx").on(table.scope, table.createdAt),
  ],
);
