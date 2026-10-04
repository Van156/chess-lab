// Allowlists of the audit log list inputs. Pure data shared by the oRPC procedures
// (`createListInput`) and the web table (columns, route search), so the columns the UI offers
// are exactly the ones the server accepts.
import { PLATFORM_AUDIT_ACTIONS, USER_AUDIT_ACTIONS } from "@b2c-template/auth/audit/actions";

import type { ListInputConfig } from "./list-input";

/** Actions the platform log can contain. */
export const PLATFORM_LOG_ACTIONS = PLATFORM_AUDIT_ACTIONS;

/** Actions a user's security log can contain. */
export const USER_LOG_ACTIONS = USER_AUDIT_ACTIONS;

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/** Platform log (`audit.listPlatform`): platform-admin actions. */
export const platformAuditListConfig = {
  sortableColumns: ["createdAt", "action", "targetType"],
  filterableColumns: {
    createdAt: "date",
    actor: "text",
    action: { variant: "select", options: PLATFORM_LOG_ACTIONS },
    targetType: "text",
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;

/**
 * User security log (`audit.listSelf`, `audit.listUser`): one user's own events. The user is never
 * a filter (the procedure fixes it), so the table only narrows by date and action.
 */
export const userAuditListConfig = {
  sortableColumns: ["createdAt", "action"],
  filterableColumns: {
    createdAt: "date",
    action: { variant: "select", options: USER_LOG_ACTIONS },
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;
