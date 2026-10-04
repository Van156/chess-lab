import { listPlatformAuditLog, listUserAuditLog } from "@b2c-template/auth/audit";
import { z } from "zod";

import { platformAuditListConfig, userAuditListConfig } from "../lib/audit-list-config";
import { createListInput } from "../lib/list-input";
import { platformProcedure, protectedProcedure } from "../index";

/**
 * Server-driven list inputs (`createListInput`): sort and filter ids come only from
 * the allowlists in `audit-list-config.ts`, which the web table shares. Pagination is
 * `page`/`perPage` (page size and offset capped by `@b2c-template/db/lib/pagination`).
 */
const platformListInput = createListInput(platformAuditListConfig);
const userListInput = createListInput(userAuditListConfig);

/**
 * Audit log reads. `listSelf` is scoped to the session user; the platform procedures need a
 * platform permission. All return `{ rows, total }`.
 */
export const auditRouter = {
  /** Platform activity log: platform-admin actions, superadmin-only. */
  listPlatform: platformProcedure({ audit: ["read"] })
    .input(platformListInput)
    .handler(({ context, input }) => {
      return listPlatformAuditLog(context.db, input);
    }),

  /**
   * Security log of the signed-in user : their own `user`-scoped rows,
   * newest first. The user comes from the session, never from input.
   */
  listSelf: protectedProcedure.input(userListInput).handler(({ context, input }) => {
    return listUserAuditLog(context.db, { userId: context.session.user.id, input });
  }),

  /**
   * Security log of any user : superadmin-only (`audit:read` is a platform
   * permission), by user id.
   */
  listUser: platformProcedure({ audit: ["read"] })
    .input(userListInput.extend({ userId: z.string().min(1) }))
    .handler(({ context, input: { userId, ...input } }) => {
      return listUserAuditLog(context.db, { userId, input });
    }),
};
