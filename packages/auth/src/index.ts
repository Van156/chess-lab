import type { Database } from "@b2c-template/db";
import * as schema from "@b2c-template/db/schema/auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { admin } from "better-auth/plugins/admin";

import { createAccountSecurity } from "./account-security";
import type { AccountSecurityEvents } from "./account-security";
import { createAuditAfterHook } from "./audit/after-hooks";
import { createUserAuditEvents } from "./audit/user-events";
import type { AuditLogger } from "./audit/types";
import type { EmailSender } from "./email";
import { platformAc, platformRoles } from "./permissions";
import { resolveGoogleCredentials } from "./social-providers";
import type { SocialProviderEnv } from "./social-providers";

export type AuthConfig = SocialProviderEnv & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};

export type CreateAuthOptions = {
  /** Additional trusted origins for desktop app builds (e.g. `tauri://localhost`). */
  desktopOrigins?: readonly string[];
  /** Test-only plugins (e.g. `testUtils()`); never passed in production. */
  extraPlugins?: readonly BetterAuthPlugin[];
  /**
   * Seams for account-security events (see `AccountSecurityEvents`). Defaults to the user-scoped
   * audit trail written through `auditLogger`; pass a custom set only to observe or replace it.
   */
  accountSecurityEvents?: AccountSecurityEvents;
};

export function createAuth(
  env: AuthConfig,
  database: Database,
  emailSender: EmailSender,
  auditLogger: AuditLogger,
  options: CreateAuthOptions = {},
) {
  const {
    desktopOrigins = [],
    extraPlugins = [],
    accountSecurityEvents = createUserAuditEvents(auditLogger),
  } = options;

  // R5.1: registered only when both values exist; half-configured throws at startup.
  const google = resolveGoogleCredentials(env);

  // R2, R3, R4, R6: change email, reset/change password, sessions, delete account.
  const accountSecurity = createAccountSecurity({
    emailSender,
    events: accountSecurityEvents,
  });

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    // R5.4: an unverified Google email fails sign-in instead of getting a session.
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            requireEmailVerification: true,
          },
        }
      : {},
    // R5.4: link only when both provider and local emails are verified; no trusted providers.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [],
        requireLocalEmailVerified: true,
      },
    },
    databaseHooks: {
      user: accountSecurity.databaseHooks.user,
    },
    emailAndPassword: {
      enabled: true,
      // R0.1: sign-in is refused until the email is verified.
      requireEmailVerification: true,
      ...accountSecurity.emailAndPassword,
    },
    emailVerification: {
      // R0.1: send a verification email on sign-up.
      sendOnSignUp: true,
      // R0.2: sign the user in automatically once they verify.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailSender.sendVerification({ to: user.email, url });
      },
    },
    user: accountSecurity.user,
    plugins: [
      admin({
        ac: platformAc,
        roles: platformRoles,
        defaultRole: "user",
        adminRoles: ["superadmin"],
        // R6.4: 1h, matching better-auth's default but pinned against upstream drift.
        impersonationSessionDuration: 60 * 60,
      }),
      accountSecurity.plugin,
      ...extraPlugins,
    ],
    // R7.1 actions with no native hook; better-auth has one `hooks.after` slot, matched by path.
    // See docs/architecture/auth.md#audit-hooks
    hooks: {
      after: createAuditAfterHook(auditLogger),
    },
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
