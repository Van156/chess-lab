import { listPlatformUsers, UnsupportedFilterError } from "@b2c-template/auth/platform";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { platformProcedure } from "../index";
import { createListInput } from "../lib/list-input";
import { platformUsersListConfig } from "../lib/platform-list-config";

/** Shared list inputs : page, perPage, sort, filters over the allowlisted columns. */
const usersListInput = createListInput(platformUsersListConfig);

/**
 * Platform (superadmin-only) procedures . Impersonation goes through the better-auth
 * client, not oRPC. See docs/architecture/authorization.md#platform-admin-port
 */
export const platformRouter = {
  users: {
    /** Sort/search/paginate all users; a database failure rejects so the table shows its error state. */
    list: platformProcedure({ user: ["list"] })
      .input(usersListInput)
      .handler(async ({ context, input }) => {
        try {
          return await listPlatformUsers(context.db, input);
        } catch (error) {
          // A filter shape the listing cannot express is the caller's mistake, not a server fault.
          if (error instanceof UnsupportedFilterError) {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
          }
          throw error;
        }
      }),

    /** One user by id. */
    get: platformProcedure({ user: ["get"] })
      .input(z.object({ userId: z.string() }))
      .handler(({ context, input }) =>
        context.platformAdmin.getUser(context.headers, input.userId),
      ),

    /** Ban with a reason and optional expiry; better-auth revokes sessions and blocks sign-in. */
    ban: platformProcedure({ user: ["ban"] })
      .input(
        z.object({
          userId: z.string(),
          reason: z.string().min(1),
          expiresInSeconds: z.number().int().positive().optional(),
        }),
      )
      .handler(({ context, input }) => context.platformAdmin.banUser(context.headers, input)),

    /** Unban. */
    unban: platformProcedure({ user: ["ban"] })
      .input(z.object({ userId: z.string() }))
      .handler(({ context, input }) =>
        context.platformAdmin.unbanUser(context.headers, input.userId),
      ),
  },
};
