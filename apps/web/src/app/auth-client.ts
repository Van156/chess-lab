import { platformAc, platformRoles } from "@b2c-template/auth/permissions";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import type { AccessControl } from "better-auth/plugins/access";

import { ENV } from "../env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [
    adminClient({
      // better-auth 1.7.5's client-plugin types can't structurally match a
      // concrete createAccessControl() result to the generic `AccessControl`
      // constraint (a known generic-variance friction, not a runtime issue);
      // the cast keeps this the documented ac/roles usage.
      ac: platformAc as AccessControl,
      roles: platformRoles,
    }),
  ],
});
