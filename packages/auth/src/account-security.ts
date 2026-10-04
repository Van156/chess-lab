import { createAuthMiddleware } from "@better-auth/core/api";
import { APIError } from "better-auth";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";

import type { EmailSender } from "./email";

/**
 * Account-security wiring for `createAuth` (docs/specs/account-settings.md R2, R3, R4,
 * R6). Option names and hook shapes were checked against better-auth 1.7.5; the verified facts
 * are in the decision record of odd/tasks/account-settings.md.
 */

/** Stable error code for revoking the session that makes the request (R4.2). */
export const CANNOT_REVOKE_CURRENT_SESSION_CODE = "CANNOT_REVOKE_CURRENT_SESSION";

export type AccountSecurityUser = { userId: string; email: string };

/** Safe, token-free description of a session that was revoked (R4.2, R4.3). */
export type RevokedSessionInfo = {
  /** The session row id, NOT the bearer token. */
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
};

/**
 * Seams for the user-scoped audit log (docs/architecture/audit-log.md). Every callback is
 * optional; `createUserAuditEvents` is the production implementation.
 *
 * `passwordChanged`, `passwordReset`, `emailChanged` and `sessionRevoked` run after the change was
 * applied: a failure is logged and never undoes it or fails the request. `userDeleting` runs
 * immediately before the hard delete and a rejection ABORTS the deletion (R6.4).
 *
 * Automatic session revocation on a password change or reset is NOT reported through
 * `sessionRevoked`: R4.2/R4.3 only cover revocations the user asks for, and the password rows
 * already say the other sessions were revoked.
 */
export type AccountSecurityEvents = {
  passwordChanged?: (event: AccountSecurityUser) => Promise<void>;
  passwordReset?: (event: AccountSecurityUser) => Promise<void>;
  /** `email` is the NEW address; fired when the new address was verified and the change applied. */
  emailChanged?: (event: AccountSecurityUser & { previousEmail: string }) => Promise<void>;
  /** One call per request; `sessions` holds every session the request actually revoked. */
  sessionRevoked?: (
    event: AccountSecurityUser & { sessions: readonly RevokedSessionInfo[] },
  ) => Promise<void>;
  userDeleting?: (event: AccountSecurityUser & { name: string }) => Promise<void>;
};

/** Runs a best-effort side effect after a change was applied; failures are logged, never thrown. */
export async function bestEffort(label: string, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error(`[account-security] ${label} failed`, error);
  }
}

/** Request paths whose successful calls revoke sessions on the user's behalf (R4.2, R4.3). */
const REVOKE_PATHS = new Set(["/revoke-session", "/revoke-other-sessions", "/revoke-sessions"]);

type PendingRevocation = AccountSecurityUser & { sessions: RevokedSessionInfo[] };

/** What the before-hook saw for one dispatched request; the after-hook reads it by context identity. */
const pendingRevocations = new WeakMap<object, PendingRevocation>();

type ChangeEmailTokenPayload = { email?: string; updateTo?: string; requestType?: string };

/**
 * Payload of a better-auth email-verification JWT. NOT a verification: callers must only use it
 * after better-auth itself verified the token in the same request (the `/verify-email` handler
 * does before it updates the user).
 */
function decodeVerificationPayload(token: unknown): ChangeEmailTokenPayload | null {
  if (typeof token !== "string") {
    return null;
  }
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ChangeEmailTokenPayload;
  } catch {
    return null;
  }
}

type AccountSecurityDeps = {
  emailSender: EmailSender;
  events?: AccountSecurityEvents;
};

/**
 * Builds the better-auth pieces for account security: option fragments for `emailAndPassword` and
 * `user`, plus a plugin carrying the request hooks (the plugin slot leaves the single
 * `hooks.before`/`hooks.after` of `createAuth` to the audit hook).
 */
export function createAccountSecurity({ emailSender, events = {} }: AccountSecurityDeps) {
  /**
   * Fire-and-forget: the response must not wait for the mail provider (R4 latency) and a send
   * failure is logged, never surfaced. The send is started synchronously.
   */
  function notifyPasswordChanged(user: AccountSecurityUser): void {
    void bestEffort("password changed notice", () =>
      emailSender.sendPasswordChangedNotice({ to: user.email, changedAt: new Date() }),
    );
  }

  const emailAndPassword = {
    // R3.2: the endpoint answers identically for known and unknown addresses; we only send mail
    // for the known one (better-auth does not call this for an unknown address).
    // A provider failure is logged and swallowed so a known address cannot be told apart from an
    // unknown one by an error response. The user can simply request another link.
    sendResetPassword: async ({ user, url }) => {
      await bestEffort("reset password email", () =>
        emailSender.sendResetPassword({ to: user.email, url }),
      );
    },
    // R3.5, R3.4: sessions die with the reset; a reset also creates the credential account for a
    // Google-only user (better-auth `/reset-password`).
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      const subject = { userId: user.id, email: user.email };
      notifyPasswordChanged(subject);
      await bestEffort("passwordReset event", async () => events.passwordReset?.(subject));
    },
  } satisfies Pick<
    NonNullable<BetterAuthOptions["emailAndPassword"]>,
    "sendResetPassword" | "revokeSessionsOnPasswordReset" | "onPasswordReset"
  >;

  const user = {
    changeEmail: {
      enabled: true,
      // R2.1: approval link to the CURRENT address; opening it makes better-auth call
      // `emailVerification.sendVerificationEmail` for the NEW address (R2.2).
      sendChangeEmailConfirmation: async ({ user: current, newEmail, url }) => {
        await emailSender.sendChangeEmailApproval({ to: current.email, newEmail, url });
      },
    },
    deleteUser: {
      enabled: true,
      // R6.2: with this set, `/delete-user` only emails a link and deletes on `/delete-user/callback`.
      sendDeleteAccountVerification: async ({ user: current, url }) => {
        await emailSender.sendDeleteAccountConfirmation({ to: current.email, url });
      },
      // Runs when the link is opened and
      // before the delete, so a failing audit seam aborts it (R6.4). Hard delete cascades (R6.3).
      //
      // Known limit, accepted for a template (better-auth runs this hook outside the delete
      // transaction): the pre-delete audit write is its own statement. A failed write aborts the
      // delete (fail closed); a failed delete after a successful write leaves a `user.deleted`
      // row for a user that still exists. We prefer that extra row over ever deleting an account
      // with no trace.
      beforeDelete: async (current) => {
        await events.userDeleting?.({
          userId: current.id,
          email: current.email,
          name: current.name,
        });
      },
    },
  } satisfies NonNullable<BetterAuthOptions["user"]>;

  const plugin = {
    id: "account-security",
    hooks: {
      before: [
        {
          // R3.5: a password change always revokes the other sessions, whatever the client sent.
          matcher: (context) => context.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => ({
            context: { body: { ...(ctx.body as object), revokeOtherSessions: true } },
          })),
        },
        {
          // R4.2: revoke any session except the current one (that is what sign-out is for).
          matcher: (context) => context.path === "/revoke-session",
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx).catch(() => null);
            const token = (ctx.body as { token?: string } | undefined)?.token;
            if (current && token === current.session.token) {
              throw new APIError("BAD_REQUEST", {
                code: CANNOT_REVOKE_CURRENT_SESSION_CODE,
                message: "The current session cannot be revoked here. Sign out instead.",
              });
            }
          }),
        },
        {
          // R4.2, R4.3: remember which sessions this request is about to revoke; the after-hook
          // writes the audit rows once the revoke succeeded. Placed after the current-session
          // guard above so a refused request captures nothing.
          matcher: (context) => REVOKE_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx).catch(() => null);
            if (!current) {
              return;
            }
            const owned = await ctx.context.internalAdapter.listSessions(current.user.id);
            const token = (ctx.body as { token?: string } | undefined)?.token;
            const revoking =
              ctx.path === "/revoke-session"
                ? owned.filter((row) => row.token === token)
                : ctx.path === "/revoke-other-sessions"
                  ? owned.filter((row) => row.token !== current.session.token)
                  : owned;
            pendingRevocations.set(ctx.context, {
              userId: current.user.id,
              email: current.user.email,
              sessions: revoking.map((row) => ({
                id: row.id,
                userAgent: row.userAgent ?? null,
                ipAddress: row.ipAddress ?? null,
                createdAt: row.createdAt,
              })),
            });
          }),
        },
      ],
      after: [
        {
          matcher: (context) => REVOKE_PATHS.has(context.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const pending = pendingRevocations.get(ctx.context);
            pendingRevocations.delete(ctx.context);
            if (
              !pending ||
              pending.sessions.length === 0 ||
              ctx.context.returned instanceof Error
            ) {
              return;
            }
            await bestEffort("sessionRevoked event", async () => events.sessionRevoked?.(pending));
          }),
        },
        {
          // `/change-password` has no dedicated hook; its response carries the user.
          matcher: (context) => context.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (returned instanceof Error) {
              return;
            }
            const changed = (returned as { user?: { id: string; email: string } } | undefined)
              ?.user;
            if (!changed) {
              return;
            }
            const subject = { userId: changed.id, email: changed.email };
            notifyPasswordChanged(subject);
            await bestEffort("passwordChanged event", async () =>
              events.passwordChanged?.(subject),
            );
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  const databaseHooks = {
    user: {
      update: {
        // R2.4: the ONLY place that sees the completed change (old address from the verified
        // token, new address from the updated row). Plain sign-up verification and the
        // old-address approval step never match: they carry no `change-email-verification` token.
        after: async (updated, context) => {
          if (context?.path !== "/verify-email") {
            return;
          }
          const payload = decodeVerificationPayload(context.query?.token);
          if (
            payload?.requestType !== "change-email-verification" ||
            !payload.email ||
            payload.updateTo?.toLowerCase() !== updated.email.toLowerCase()
          ) {
            return;
          }
          const previousEmail = payload.email;
          await bestEffort("emailChanged event", async () =>
            events.emailChanged?.({
              userId: updated.id,
              email: updated.email,
              previousEmail,
            }),
          );
        },
      },
    },
  } satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

  return { emailAndPassword, user, databaseHooks, plugin };
}
