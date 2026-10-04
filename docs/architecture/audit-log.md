# Audit log

How the audit log is written, read and purged. Requirements live in [`docs/specs/auth-and-platform-admin.md`](../specs/auth-and-platform-admin.md) (R7 and §5) and, for the user scope, [`docs/specs/account-settings.md`](../specs/account-settings.md) (§5.4, R2.4, R3.5, R4, R6.4, R7); this page explains the code. Where the hooks are wired into better-auth see [auth.md](./auth.md#audit-hooks); for the API procedures that read the log see [authorization.md](./authorization.md).

Code: `packages/auth/src/audit/*`, `packages/db/src/schema/audit.ts`, `packages/db/src/lib/list-*.ts`.

## Pipeline

```
better-auth hooks / oRPC procedures
        |  AuditLogger.record(event)
        v
createDrizzleAuditLogger  ->  audit_log (Postgres)
```

- `AuditLogger` (`audit/types.ts`) is a port with one method, `record`. It lives in `@b2c-template/auth` so hooks and oRPC procedures can both depend on it without a cycle between `auth` and `api`.
- `AuditEvent` is a union on `scope`: a `platform` event takes a `PlatformAuditAction`, a `user` event takes a `UserAuditAction` (see [User scope](#user-scope)). The type pairs each scope with its own action catalogue, so a mismatch does not compile.
- The action catalogue is plain runtime lists in `audit/actions.ts`, so the browser can import it (`@b2c-template/auth/audit/actions`) and the types derive from the lists.
- `metadata` holds before/after values plus a readable snapshot (`actorEmail`, `targetEmail`, ...). It must never hold secrets, tokens or passwords (R7.2).

### Table rules

- In `schema/audit.ts`, `actor_user_id` and `impersonator_user_id` use `ON DELETE SET NULL`. The log must outlive the rows it describes: deleting a user neither blocks on nor erases their history. The `metadata` snapshot keeps the entry readable once a reference is nulled.
- `actorUserId` is nullable only for that reason. A fresh write always knows its actor.
- Indexes lead with the filter column and end in `created_at`, matching the list sorts: `(actor_user_id, created_at)` and `(scope, created_at)`.

### Failure policy

A failed write is logged and rethrown, failing the request. The log exists to hold privileged actions (bans, impersonation, platform role changes, account deletion) accountable. Continuing silently would let such an action succeed with no trace.

Known limitation: no transaction wraps the mutation and the audit write (better-auth does not hand hooks a shared transaction, see [auth.md](./auth.md#plugin-ordering-and-hooks)). Most call sites are `after*` hooks, so the mutation has usually committed already. The caller sees an error although the action succeeded, which surfaces the gap. Log-and-continue would never surface it.

## Request context

`request-context.ts` supplies who and from where.

- `extractRequestMeta(headers)` reads the IP (first `x-forwarded-for` entry, else `x-real-ip`) and the user agent. It returns nulls and never throws, because capturing metadata must not fail the action being recorded.
- `currentAuditContext()` reads the actor, impersonator and network context from better-auth's `AsyncLocalStorage` endpoint context (`tryGetCurrentAuthEndpointContext`).
- Why not use the hook payload: its `user` field can mean the caller or the target depending on the hook. The request's own session is always the caller. Verified against better-auth 1.7.5.
- Every `auth.api.*` call runs inside `dispatchAuthEndpoint`, which wraps the endpoint and its synchronous hooks in `runWithEndpointContext`, so the context resolves from any hook or custom endpoint. Outside a dispatched endpoint, or with no session, it returns nulls.

## After hook

`createAuditAfterHook` is the single `hooks.after` handler. better-auth has one such slot, so every path is matched by `ctx.path`.

Paths handled (better-auth 1.7.5): `/admin/{ban-user,unban-user,set-role,update-user,impersonate-user,stop-impersonating}` (the admin plugin has no hooks option).

Rules:

- It runs on every request. Unmatched paths return immediately.
- `ctx.context.returned` is either the successful response or the thrown `APIError` itself, because `hooks.after` still runs on failure. Each branch returns early on an `APIError`, so a failed action writes no event (R7.2).
- The session comes from `getSessionFromCtx`, not `ctx.context.session`. `dispatchAuthEndpoint` rebuilds its context through a `defu` merge after `hooks.before`, and a session set mid-request does not reliably survive on the context this handler receives. `getSessionFromCtx` returns the cached session when present and otherwise re-derives it from the request cookies, so it adds no database round trip where the direct read already works.
- `/admin/update-user` writes one event per changed key present in `data` (`role`, `banned`).
- `/admin/stop-impersonating` reverses the usual roles. By then the cookie is back on the superadmin's session, but `ctx.context.session` was cached earlier in the same request while the session was still the impersonated one. So `session.userId` is the impersonated target and `session.impersonatedBy` is the real actor. The event records `impersonatorUserId: null`: ending impersonation is the superadmin's own act.

## Reads

`audit/queries.ts` has two entry points over one internal query (`queryAuditLog`):

- `listPlatformAuditLog(db, input)` returns `scope = "platform"` rows only. The caller must gate it behind a platform permission (R7.5).
- `listUserAuditLog(db, { userId, input })` returns `scope = "user"` rows with `target_id = userId`; see [User reads](#user-reads).
- The mandatory scope condition is ANDed with the filters' own `where` (already parenthesized for `or`), so no filter combination widens it.
- `AUDIT_LOG_LIST_COLUMNS` maps list-contract ids (`actor` is `actor_user_id`) to columns. The API allowlists (`platformAuditListConfig`, `userAuditListConfig`) decide which ids each procedure accepts.
- Ties break by `id`. Several events can share a millisecond, and without a tiebreaker a client paging through results could see a row twice or skip one at a page boundary.
- `total` is an exact `count(*)` over the same `where`. The UI needs it for the page count and out-of-range recovery, so an estimate would turn the last page into a guess. The cost is one extra index-assisted scan, kept small because retention bounds the table and the scope condition narrows most requests. If the platform log outgrows that, cap the count (`select count(*) from (select 1 ... limit N)`, shown as "N+") or use the planner estimate for unfiltered platform requests.

For the list-query adapter itself (escaping, empty checks, day windows) see [data-table.md](./data-table.md#server-list-queries).

## User scope

`scope = "user"` rows are one person's security trail (account-settings R2.4, R3.5, R4.2, R4.3, R6.4, R7). The actor and the target are the user, and `metadata.actorEmail` snapshots the address. Profile and theme changes are not audited. `ip` / `user_agent` describe the request that caused the event.

| Action                  | Written by                                                                            | Metadata (besides `actorEmail`)                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `user.email_changed`    | `databaseHooks.user.update.after` on `/verify-email`                                  | `oldEmail`, `newEmail`                                                                                          |
| `user.password_changed` | after-hook on `/change-password`                                                      | `otherSessionsRevoked`                                                                                          |
| `user.password_reset`   | `emailAndPassword.onPasswordReset`                                                    | `allSessionsRevoked`                                                                                            |
| `user.session_revoked`  | before/after hooks on `/revoke-session`, `/revoke-other-sessions`, `/revoke-sessions` | one row per revoked session: `sessionId`, `sessionUserAgent`, `sessionIp`, `sessionCreatedAt`. Never the token. |
| `user.deleted`          | `user.deleteUser.beforeDelete` (before the delete)                                    | `userName`                                                                                                      |

Wiring: `createAccountSecurity` (`account-security.ts`) owns the hooks and calls the optional `AccountSecurityEvents` seams; `createUserAuditEvents(auditLogger)` (`audit/user-events.ts`) is the implementation `createAuth` uses by default, so `apps/server` needs no extra wiring. A test may pass its own `accountSecurityEvents` to replace it.

Design notes (better-auth 1.7.5, verified against the source):

- **Email change.** `emailVerification.afterEmailVerification` fires for plain sign-up verification too and carries no old address, so it is not used. The change-email completion goes through `updateUserByEmail`, whose `databaseHooks.user.update.after` receives the endpoint context. The hook acts only on `/verify-email` with a `change-email-verification` token (the JWT, already verified by the handler, holds the old address in `email` and the new one in `updateTo`). The old-address approval step and sign-up verification never match.
- **Session revocation.** There is no hook for the three revoke endpoints. A plugin before-hook lists the sessions the request is about to revoke (only the caller's own; a foreign token matches nothing) and parks them in a `WeakMap` keyed by the request context; the after-hook writes the rows once the endpoint succeeded. A refused or failed revoke writes nothing.
- **Automatic revocations are not rows.** Revoking the other sessions on a password change, or all sessions on a reset, is reported on the `user.password_changed` / `user.password_reset` row (`otherSessionsRevoked` / `allSessionsRevoked`) instead of one `user.session_revoked` per session. R4.2/R4.3 only require the user-initiated revokes.
- **Failure policy differs from the platform scope.** After-the-fact events (email, password, session) are best-effort: a failed write is logged by the audit adapter and by `bestEffort`, and the change stands, because the account was already changed and failing the request would not undo it. Only `user.deleted` fails closed: it is written before the delete and a failed write aborts it (R6.4). If the delete itself then fails, a `user.deleted` row remains for a user that still exists; this is the accepted trade-off (see `beforeDelete` in `account-security.ts`).
- **Survives the user.** `actor_user_id` becomes NULL when the user is deleted (`ON DELETE SET NULL`), so reads match on `target_id`.

### User reads

- `listUserAuditLog(db, { userId, input })` returns `scope = "user"` rows with `target_id = userId`, newest first, through the shared list machinery (`userAuditListConfig`: sort by `createdAt` / `action`, filter by `createdAt` / `action`).
- `audit.listSelf` (oRPC, any signed-in user) takes the user from the session. `audit.listUser` (oRPC, `audit:read` platform permission, so superadmin only) takes `{ userId, ...listInput }`.
- Isolation (R7.3): `listPlatformAuditLog` excludes `scope = "user"` (these rows carry IP and user agent); a superadmin reads them per user via `audit.listUser`, and a user reads only their own via `audit.listSelf`.

### Views

- **Self** (`/account/security`): `SelfSecurityLog` in `features/audit-log` reads `audit.listSelf` with sort, date and action filters and paging in the route search.
- **Admin** (`/admin/users/$id`, "Activity" tab): `UserActivityLog` reads `audit.listUser` for that user. The route search holds `tab` (`details` | `activity`) next to the table keys; switching tab drops the table state.
- Both render `UserAuditLogSection`: the shared `AuditLogTable` with `getUserAuditColumns` (when, labelled action, detail from `metadata`), so the two views cannot drift. The detail column reads only a few known metadata fields.

## Retention

`AUDIT_LOG_RETENTION_DAYS` unset means keep forever (R7.6): `startAuditRetentionJob` returns `null` and nothing runs. It also returns `null` for a non-positive value.

- `purgeExpiredAuditLog(db, retentionDays, now)` deletes rows older than the cutoff in batches of 1000. Each batch deletes `IN (SELECT id ... WHERE created_at < cutoff LIMIT N)`, which bounds the lock and scan of one statement however large the backlog is. The loop ends when a batch removes fewer than a full batch.
- It counts deleted rows through `rowCount`, never `.returning()`, so row data (including `metadata`) is never pulled into the process.
- The job purges once immediately, so a long-lived process does not wait a full interval, then every `intervalMs` (default one day) until `stop()`. The interval is `unref`'d so a short-lived script that merely imports the job can still exit.
- A tick that fires while the previous purge is still running is skipped (`onSkippedTick`). If a purge stays in flight longer than `maxInFlightMs` (default 30 minutes, far beyond an ordinary purge), the in-flight latch is force-released and `onError` is called, so one hung connection cannot stop retention forever. The stuck promise cannot be cancelled and keeps running. A `generation` counter makes sure its eventual completion cannot clear the latch of a newer purge.
- `clock` and `scheduler` are injectable so tests drive the in-flight math and ticks without real time.

Multiple replicas: each process owns its own timer with no leader election. This is safe because batched deletes are idempotent: a row another replica already removed stops matching `created_at < cutoff` and contributes 0, so overlap costs redundant round trips, never wrong data. A Postgres advisory lock would avoid that, but the Drizzle adapter hands the job a pooled connection, not a dedicated session a lock could span across the purge loop's queries. Holding a connection for the job's lifetime to add the lock is a bigger change than this cheap redundancy justifies for a template.
