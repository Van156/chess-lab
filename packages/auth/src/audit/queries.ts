import type { Database } from "@b2c-template/db";
import { buildListQuery, countListRows } from "@b2c-template/db/lib/list-query";
import type { ListColumns, ListQueryInput } from "@b2c-template/db/lib/list-query";
import { auditLog } from "@b2c-template/db/schema/audit";
import { and, eq, type SQL } from "drizzle-orm";

/** One row as read back from `audit_log` (drizzle-inferred). */
export type AuditLogRow = typeof auditLog.$inferSelect;

/** A page of `audit_log` rows plus the number of rows matching the filters (ignoring paging). */
export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
};

/**
 * List-input ids to `audit_log` columns: the only way a client id reaches SQL. The ids follow
 * `audit-list-config.ts` in `@b2c-template/api` (`actor` is `actor_user_id`), which also decides
 * which of them each procedure accepts.
 */
export const AUDIT_LOG_LIST_COLUMNS = {
  createdAt: auditLog.createdAt,
  action: auditLog.action,
  actor: auditLog.actorUserId,
  targetType: auditLog.targetType,
} as const satisfies ListColumns;

/**
 * Runs `input` under the mandatory `visibility` condition,
 * ANDed with the filters so none can widen it. Ties break by `id` (same-millisecond events would
 * otherwise repeat or skip across pages); `total` is an exact `count(*)` over the same `where`.
 * See docs/architecture/audit-log.md#reads.
 */
async function queryAuditLog(
  db: Database,
  visibility: SQL | undefined,
  input: ListQueryInput,
): Promise<AuditLogPage> {
  const query = buildListQuery({
    columns: AUDIT_LOG_LIST_COLUMNS,
    input,
    tieBreakers: [auditLog.id],
  });
  const where = and(visibility, query.where);
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(...query.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    countListRows(db, auditLog, where),
  ]);
  return { rows, total };
}

/**
 * Platform activity log: platform-admin entries only. User-scoped rows (a person's
 * security trail with IP and user agent) are deliberately excluded; a superadmin reads them
 * per user through `listUserAuditLog`. Callers MUST gate it behind a platform permission.
 */
export function listPlatformAuditLog(db: Database, input: ListQueryInput): Promise<AuditLogPage> {
  return queryAuditLog(db, eq(auditLog.scope, "platform"), input);
}

/**
 * One user's security trail: `scope = "user"` rows targeting `userId`. Matched
 * on `target_id`, not the nullable `actor_user_id`, so the trail stays readable after the user is
 * deleted. `userId` MUST come from the session (self view) or from a platform-gated procedure
 * (admin view), never from unguarded client input.
 */
export function listUserAuditLog(
  db: Database,
  { userId, input }: { userId: string; input: ListQueryInput },
): Promise<AuditLogPage> {
  return queryAuditLog(db, and(eq(auditLog.scope, "user"), eq(auditLog.targetId, userId)), input);
}
