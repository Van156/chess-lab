# Auth

How `packages/auth` configures better-auth. Requirements live in [`docs/specs/auth-and-platform-admin.md`](../specs/auth-and-platform-admin.md) and [`docs/specs/dashboard-shell-and-auth-ui.md`](../specs/dashboard-shell-and-auth-ui.md); this page explains the code. For the API side see [authorization.md](./authorization.md).

Code: `packages/auth/src/{index,account-security,platform,admin-seed,testing}.ts` and `audit/`.

## better-auth setup

`createAuth(env, database, emailSender, auditLogger, options)` in `index.ts` builds the instance. Everything it needs is injected: the Drizzle database, an `EmailSender` port and an `AuditLogger` port.

| Concern            | Setting                                                                                                                                                   | Spec       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Email and password | Sign-in refused until the email is verified; verification email on sign-up; auto sign-in after verifying.                                                 | R0.1, R0.2 |
| Google             | Registered only when both credentials exist; half-configured throws at startup. An unverified Google email fails sign-in.                                 | R5.1, R5.4 |
| Account linking    | Link only when provider and local emails are both verified; `trustedProviders` stays empty, since a trusted provider would link even an unverified email. | R5.4       |
| Cookies            | `sameSite: "none"`, `secure`, `httpOnly`.                                                                                                                 |            |

`CreateAuthOptions.extraPlugins` exists for tests only (for example `testUtils()` to forge sessions). The server never passes it.

## Plugin ordering and hooks

Plugins, in order:

1. `admin`: platform roles, `defaultRole: "user"`, `adminRoles: ["superadmin"]`, 1h impersonation sessions (R6.4). The duration equals better-auth's default but is set explicitly so it cannot drift upstream.
2. `account-security` (from `createAccountSecurity`): request hooks for change password, session revocation and delete account.
3. `extraPlugins` (tests).

Other hooks:

- `databaseHooks.user` comes from `account-security` and records `user.email_changed` once a change-email verification completes.
- `hooks.after` is the single better-auth after-hook slot, matched by path. See [Audit hooks](#audit-hooks).

## Account security flows

Spec: [`docs/specs/account-settings.md`](../specs/account-settings.md) R2 to R6. `createAccountSecurity` (`account-security.ts`) returns option fragments for `emailAndPassword` and `user` and a plugin carrying the request hooks; `createAuth` spreads them in. The plugin keeps its own `hooks.before`/`hooks.after`, so the single audit after-hook slot stays free. Mail goes through the `EmailSender` port (`sendResetPassword`, `sendChangeEmailApproval`, `sendDeleteAccountConfirmation`, `sendPasswordChangedNotice`). Option names were checked against better-auth 1.7.5.

| Flow            | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset password  | `emailAndPassword.sendResetPassword`. `/request-password-reset` answers `{ status: true }` for unknown addresses too (R3.2) and a failed send is caught and logged, so the response stays uniform. The email link validates the token and redirects to `<redirectTo>?token=...` or `?error=INVALID_TOKEN`. `revokeSessionsOnPasswordReset: true`; `onPasswordReset` sends the changed notice and records `user.password_reset`. `/reset-password` creates a credential account when there is none, which is how a Google-only user sets a password (R3.4). |
| Change password | A plugin before-hook on `/change-password` forces `revokeOtherSessions: true` whatever the client sent. An after-hook sends the notice (fire-and-forget) and records `user.password_changed`.                                                                                                                                                                                                                                                                                                                                                              |
| Change email    | `user.changeEmail` with `sendChangeEmailConfirmation`: the approval link goes to the current address, opening it makes better-auth send the usual verification email to the new one, and opening that sets `email` and `emailVerified`. A taken address returns the same `{ status: true }` and sends nothing (R2.3).                                                                                                                                                                                                                                      |
| Delete account  | `user.deleteUser` with `sendDeleteAccountVerification`: `POST /delete-user` only emails a link; `GET /delete-user/callback` deletes the user, signs them out and redirects to `callbackURL` (the web app sends `<origin>/sign-in`). `beforeDelete` runs when the link is opened, before the delete, and writes `user.deleted`; a failed audit write aborts the delete.                                                                                                                                                                                     |
| Sessions        | `listSessions`, `revokeSession`, `revokeOtherSessions` and `revokeSessions` are better-auth's own. A before-hook rejects revoking the current session (`400 CANNOT_REVOKE_CURRENT_SESSION`, R4.2); a foreign token is ignored.                                                                                                                                                                                                                                                                                                                             |

Audit seams: `createAuth(..., { accountSecurityEvents })` takes optional callbacks that default to `createUserAuditEvents(auditLogger)`; see [audit-log.md](./audit-log.md#user-scope).

## Audit hooks

Audit writes (R7.1, R7.2) come from two places, both calling `AuditLogger.record`:

- `createAuditAfterHook` (`audit/`) for platform actions: every admin-plugin action that needs an event. better-auth has one `hooks.after` slot, so a single hook dispatches by path.
- `createAccountSecurity` (`account-security.ts`) for the user-scoped security events, through its own plugin hooks and `databaseHooks`; see [audit-log.md](./audit-log.md#user-scope).

Rules:

- Actor, impersonator and network context come from the request's own session through `resolveAuditActor`, never from a hook payload field. The payload's own subject is only a fallback when the request has no session.
- Hooks run on failure too, so each branch returns early on an `APIError`: a failed action writes no event (R7.2).

## Platform lists

`platform.ts` backs the admin users table with a Drizzle query over the shared list input (`@b2c-template/db/lib/list-query`). Column ids are defined by the list contract in `@b2c-template/api` (`platformUsersListConfig`).

Common rules:

- `PLATFORM_USER_LIST_COLUMNS` maps list-input ids to table columns. It is the only way a client-supplied id reaches SQL.
- Ties break by `id`, so a page boundary is stable. `total` is an exact `count(*)`.
- A database failure rejects, so the UI can show an error instead of an empty page. This is why `listPlatformUsers` replaces better-auth's `list-users`, which swallows query errors.
- Callers must gate `listPlatformUsers` behind `user:list`. The function applies no permission check itself.

Specifics:

- `role` and `status` are derived filters handled in `userFilterCondition`. `role` is a comma-separated list, so `eq` means "has this role" and `inArray` means "has any of these". `status` comes from `banned`, with NULL counted as active, so the two statuses partition every row. For both, an empty `inArray` list matches no row and an empty `notInArray` list restricts nothing; status values other than `active`/`banned` are rejected. Status truth table: `banned` only → `banned IS TRUE`; `active` only → `NOT (banned IS TRUE)`; both → every row; neither → no row. An unsupported operator or value shape throws `UnsupportedFilterError` (the router maps it to `BAD_REQUEST`). Text search is case-insensitive.

## Test harness

`testing.ts` is exported as `@b2c-template/auth/testing` and used only by `*.integration.test.ts` files in auth and api. Production code never imports it.

- `RecordingEmailSender` and `RecordingAuditLogger` record calls in memory.
- `signUpAndVerify` signs up, follows the captured verification link and returns authenticated headers.
- `cookieHeaderFromSetCookie` rebuilds a `Cookie` header from `set-cookie`. `Headers.get("set-cookie")` comma-joins entries, and `/admin/impersonate-user` sets five cookies, clearing some first. Taking the first pair would pick a cleared cookie and fail authentication. The helper uses better-auth's `splitSetCookieHeader`, keeps the last value per name and drops cleared cookies.
- `truncateAllTables` derives the table list from the db schema at call time, so new tables are never missed. It refuses to run unless the database name ends with the test suffix.
- `resolveTestDatabaseUrl` is re-exported from `@b2c-template/db/testing`.
- `@b2c-template/db/testing` owns the database side: the default test URL (port 5437, database name ending in `_test`, never the dev database), `requireTestDatabaseOrSkip` (throws in CI when the database is unreachable, warns and skips locally) and `isDatabaseReachable` (never throws, bounded connect timeout). `DATABASE_URL` is ignored on purpose so an app `.env` cannot redirect tests to a real database.
