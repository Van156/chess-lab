import { createAuthEndpoint, createAuthMiddleware } from "@better-auth/core/api";
import type { Database } from "@b2c-template/db";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import { APIError } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { sessionMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AccountSecurityEvents } from "./account-security";
import { buildLichessOAuthConfig, LICHESS_PROVIDER_ID } from "./lichess-provider";
import type { LichessAccount, LichessOAuthOptions } from "./lichess-provider";
import { isSyntheticEmail } from "./synthetic-email";

// better-auth 1.7.5 serves generic-oauth providers through the social routes (no `/oauth2/*`);
// the matcher sees the route template, so the provider id is checked from the params.
const CALLBACK_PATH = "/callback/:id";

/** ADR-08: how recent the session must be to delete a Lichess-only account. */
export const DELETE_FRESH_WINDOW_MS = 10 * 60 * 1000;

/** Error codes of `POST /lichess/delete-account`; the web client mirrors them. */
export const LICHESS_DELETE_ERROR_CODES = {
  IMPERSONATION_NOT_ALLOWED: "IMPERSONATION_NOT_ALLOWED",
  LICHESS_ONLY_ACCOUNT_REQUIRED: "LICHESS_ONLY_ACCOUNT_REQUIRED",
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
  USERNAME_MISMATCH: "USERNAME_MISMATCH",
} as const;

export const IMPERSONATION_NOT_ALLOWED_CODE = LICHESS_DELETE_ERROR_CODES.IMPERSONATION_NOT_ALLOWED;
export const LICHESS_ONLY_ACCOUNT_REQUIRED_CODE =
  LICHESS_DELETE_ERROR_CODES.LICHESS_ONLY_ACCOUNT_REQUIRED;
export const REAUTH_REQUIRED_CODE = LICHESS_DELETE_ERROR_CODES.REAUTH_REQUIRED;
export const USERNAME_MISMATCH_CODE = LICHESS_DELETE_ERROR_CODES.USERNAME_MISMATCH;

export type LichessAccountOptions = LichessOAuthOptions & {
  db: Database;
  /** Audit seam shared with `deleteUser.beforeDelete`; a rejection aborts the deletion. */
  events?: Pick<AccountSecurityEvents, "userDeleting" | "userDeleteFailed">;
};

/**
 * Wires Lichess sign-in (ADR-07): the `generic-oauth` provider config plus a plugin that upserts
 * `lichess_profile` (id, username, ratings) after a successful Lichess callback. The hook lives in
 * the plugin because the single top-level `hooks.after` slot belongs to the audit hook.
 *
 * The provider's `getUserInfo` already fetched `/api/account` during the callback, so the account
 * is parked by Lichess id and consumed by the hook instead of calling Lichess a second time.
 */
export function createLichessAccount({ db, events = {}, ...oauth }: LichessAccountOptions) {
  const pending = new Map<string, LichessAccount>();
  const fetchImpl = oauth.fetch;

  const oauthConfig = buildLichessOAuthConfig({
    ...oauth,
    onAccount: (account) => pending.set(account.id, account),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });

  const plugin = {
    id: "lichess-account",
    endpoints: {
      // ADR-08: account deletion for users with a synthetic (non-deliverable) email, who cannot
      // use the emailed-link flow. Needs a fresh, non-impersonated session and the typed username.
      lichessDeleteAccount: createAuthEndpoint(
        "/lichess/delete-account",
        {
          method: "POST",
          body: z.object({ confirmUsername: z.string() }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          // Admin impersonation must never delete the impersonated person's account.
          if ((session as { impersonatedBy?: string | null }).impersonatedBy) {
            throw new APIError("FORBIDDEN", {
              code: IMPERSONATION_NOT_ALLOWED_CODE,
              message: "Impersonated sessions cannot delete an account.",
            });
          }
          // Real-email users keep the emailed-link flow (`/delete-user`).
          if (!isSyntheticEmail(user.email)) {
            throw new APIError("FORBIDDEN", {
              code: LICHESS_ONLY_ACCOUNT_REQUIRED_CODE,
              message: "Use the emailed confirmation link to delete this account.",
            });
          }
          if (Date.now() - new Date(session.createdAt).getTime() >= DELETE_FRESH_WINDOW_MS) {
            throw new APIError("FORBIDDEN", {
              code: REAUTH_REQUIRED_CODE,
              message: "Sign in with Lichess again to confirm the deletion.",
            });
          }
          const [profile] = await db
            .select({ username: lichessProfile.username })
            .from(lichessProfile)
            .where(eq(lichessProfile.userId, user.id))
            .limit(1);
          if (
            !profile ||
            profile.username.toLowerCase() !== ctx.body.confirmUsername.trim().toLowerCase()
          ) {
            throw new APIError("BAD_REQUEST", {
              code: USERNAME_MISMATCH_CODE,
              message: "The typed username does not match this account.",
            });
          }
          // Fail closed: a rejected audit write aborts before anything is deleted.
          const deleting = { userId: user.id, email: user.email, name: user.name };
          await events.userDeleting?.(deleting);
          try {
            // `deleteUser` removes the sessions and accounts first, then the user row (chess rows
            // cascade from it). The cookie is only cleared once it succeeded.
            await ctx.context.internalAdapter.deleteUser(user.id);
          } catch (error) {
            // The audit seam and better-auth's adapter cannot share a transaction, so a delete that
            // fails after `user.deleted` was written is compensated with `user.delete_failed`
            // (best-effort) and the request fails: the account is never reported as deleted.
            await events.userDeleteFailed?.(deleting).catch((auditError: unknown) => {
              console.error("[lichess-account] delete_failed audit write failed", auditError);
            });
            throw error;
          }
          deleteSessionCookie(ctx);
          return ctx.json({ success: true });
        },
      ),
    },
    hooks: {
      after: [
        {
          matcher: (context) => context.path === CALLBACK_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if ((ctx.params as { id?: string } | undefined)?.id !== LICHESS_PROVIDER_ID) {
              return;
            }
            // No new session means the callback failed or was denied: nothing to record.
            const userId = ctx.context.newSession?.user.id;
            if (!userId) {
              return;
            }
            const accounts = await ctx.context.internalAdapter.findAccounts(userId);
            const lichessId = accounts.find(
              (row) => row.providerId === LICHESS_PROVIDER_ID,
            )?.accountId;
            const account = lichessId ? pending.get(lichessId) : undefined;
            if (!lichessId || !account) {
              return;
            }
            pending.delete(lichessId);
            await db
              .insert(lichessProfile)
              .values({
                userId,
                lichessId,
                username: account.username,
                ratingSnapshot: account.perfs,
              })
              .onConflictDoUpdate({
                target: lichessProfile.userId,
                set: { username: account.username, ratingSnapshot: account.perfs },
              });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  return { oauthConfig, plugin };
}
