import type { CsvColumn } from "@/shared/lib/data-table/csv";

import {
  formatUserAuditAction,
  formatUserAuditDetail,
  resolveActorLabel,
} from "./audit-log-display";

/** The audit row fields the CSV export reads. */
export type AuditCsvRow = {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
};

const when: CsvColumn<AuditCsvRow> = { header: "When", value: (row) => row.createdAt };
const actorId: CsvColumn<AuditCsvRow> = { header: "Actor ID", value: (row) => row.actorUserId };
const action: CsvColumn<AuditCsvRow> = { header: "Action", value: (row) => row.action };
const targetType: CsvColumn<AuditCsvRow> = {
  header: "Target type",
  value: (row) => row.targetType,
};
const targetId: CsvColumn<AuditCsvRow> = { header: "Target ID", value: (row) => row.targetId };

const actor: CsvColumn<AuditCsvRow> = {
  header: "Actor",
  value: (row) => resolveActorLabel(row.actorUserId),
};

/** CSV columns of the platform log export: machine values (ISO time, raw action) plus a shortened actor id. */
export function getPlatformAuditCsvColumns(): CsvColumn<AuditCsvRow>[] {
  return [when, actor, actorId, action, targetType, targetId];
}

/** A listed security log row: the CSV fields plus the `metadata` snapshot the detail is read from. */
export type UserAuditCsvRow = AuditCsvRow & { metadata: unknown };

/** CSV columns of the security log export: ISO time, the raw action and the readable detail. */
export function getUserAuditCsvColumns(): CsvColumn<UserAuditCsvRow>[] {
  return [
    when,
    action,
    { header: "Label", value: (row) => formatUserAuditAction(row.action) },
    { header: "Detail", value: (row) => formatUserAuditDetail(row) },
  ];
}
