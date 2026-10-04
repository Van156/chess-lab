import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc as platformBuiltInAdminAc,
  defaultStatements as adminDefaultStatements,
  userAc as platformBuiltInUserAc,
} from "better-auth/plugins/admin/access";

/** Platform permission catalog: better-auth's admin defaults plus `audit` (platform view of user activity). */
export const platformStatements = {
  ...adminDefaultStatements,
  audit: ["read"],
} as const;

export const platformAc = createAccessControl(platformStatements);

/**
 * Built-in platform role: better-auth's built-in admin permissions, which
 * withhold `user:impersonate-admins` so a superadmin can only impersonate
 * non-superadmin users, plus `audit:read`.
 */
export const superadmin = platformAc.newRole({
  ...platformBuiltInAdminAc.statements,
  audit: ["read"],
});

/** Built-in platform role: an ordinary user, no platform permissions. */
export const user = platformAc.newRole({ ...platformBuiltInUserAc.statements });

/** Convenience map for better-auth's `admin({ roles })` option */
export const platformRoles = { superadmin, user } as const;
