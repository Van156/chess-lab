import { createAuthMiddleware } from "@better-auth/core/api";
import type { Database } from "@b2c-template/db";
import { lichessProfile } from "@b2c-template/db/schema/lichess";
import type { BetterAuthPlugin } from "better-auth";

import { buildLichessOAuthConfig, LICHESS_PROVIDER_ID } from "./lichess-provider";
import type { LichessAccount, LichessOAuthOptions } from "./lichess-provider";

// better-auth 1.7.5 serves generic-oauth providers through the social routes (no `/oauth2/*`);
// the matcher sees the route template, so the provider id is checked from the params.
const CALLBACK_PATH = "/callback/:id";

export type LichessAccountOptions = LichessOAuthOptions & { db: Database };

/**
 * Wires Lichess sign-in (ADR-07): the `generic-oauth` provider config plus a plugin that upserts
 * `lichess_profile` (id, username, ratings) after a successful Lichess callback. The hook lives in
 * the plugin because the single top-level `hooks.after` slot belongs to the audit hook.
 *
 * The provider's `getUserInfo` already fetched `/api/account` during the callback, so the account
 * is parked by Lichess id and consumed by the hook instead of calling Lichess a second time.
 */
export function createLichessAccount({ db, ...oauth }: LichessAccountOptions) {
  const pending = new Map<string, LichessAccount>();
  const fetchImpl = oauth.fetch;

  const oauthConfig = buildLichessOAuthConfig({
    ...oauth,
    onAccount: (account) => pending.set(account.id, account),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });

  const plugin = {
    id: "lichess-account",
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
