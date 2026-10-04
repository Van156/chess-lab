// Allowlist of the platform admin users list input. Pure data shared by the oRPC procedure
// (`createListInput`) and the web table (columns, route search), so the columns the UI offers
// are exactly the ones the server accepts. The list comes from a Drizzle query over the shared
// list input (`listPlatformUsers` in `@b2c-template/auth/platform`).
import type { ListInputConfig } from "./list-input";

/** Platform role names (`platformRoles` in `@b2c-template/auth`; a test keeps them in sync). */
export const PLATFORM_ROLE_NAMES = ["superadmin", "user"] as const;

/** User account states a list can be narrowed to. `banned` means the `banned` flag is set; a NULL flag is active. */
export const USER_STATUSES = ["active", "banned"] as const;

const DEFAULT_SORT = [{ id: "createdAt", desc: true }] as const;

/**
 * Platform users (`platform.users.list`). `status` filters the `banned` flag and `role` matches
 * one platform role (the column may hold several, comma-separated). Sorting by `status` is not offered (the flag is nullable and low value).
 */
export const platformUsersListConfig = {
  sortableColumns: ["email", "name", "role", "createdAt"],
  filterableColumns: {
    email: "text",
    name: "text",
    role: { variant: "select", options: PLATFORM_ROLE_NAMES },
    status: { variant: "select", options: USER_STATUSES },
  },
  defaultSort: DEFAULT_SORT,
} as const satisfies ListInputConfig<string, string>;
