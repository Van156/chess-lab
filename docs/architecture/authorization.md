# API authorization

How `packages/api` authorizes requests. Requirements live in [`docs/specs/auth-and-platform-admin.md`](../specs/auth-and-platform-admin.md) (§4.1, §4.5, R5, R6); this page explains the code.

Code: `packages/api/src/{index,authorization,platform-admin,context}.ts` and `routers/{platform,audit}.ts`.

## Model

This template has individual accounts and one operator layer. There is no tenant, so there is no per-resource or per-organization permission check: a self-service procedure takes the user from the session and never from input, and everything cross-user is a platform permission held only by `superadmin`.

## Procedures

| Procedure                  | Guarantees                                                          |
| -------------------------- | ------------------------------------------------------------------- |
| `publicProcedure`          | Nothing.                                                            |
| `protectedProcedure`       | A session user exists, else `UNAUTHORIZED`.                         |
| `platformProcedure({...})` | Protected, plus every listed platform permission, else `FORBIDDEN`. |

## Permission checks

`platformProcedure` takes a typed permission object. `PlatformPermissions` is derived from `platformStatements`, so a misspelled feature or action is a compile error, not a silent no-op.

The platform catalog is better-auth's admin defaults (`user`, `session`) plus `audit` (`packages/auth/src/permissions/platform.ts`). `superadmin` holds the built-in admin permissions except `user:impersonate-admins`, plus `audit:read`; the default role `user` holds none. Ordinary users therefore never pass a `platformProcedure` check (R6.5).

## Authorization port

`AuthorizationPort` (`authorization.ts`) is the only thing the procedure builders depend on. It has one method:

- `hasPlatformPermission(userId, permissions)`

Procedures never import better-auth, so they are unit tested with a fake port. `createBetterAuthAuthorization` is the production adapter. It takes a narrow structural type (`AuthorizationAuthApi`), which any real `Auth` instance satisfies, so `packages/api` needs no better-auth dependency.

The port reaches the procedures through `Context` (`context.ts`): `authorization`, `platformAdmin`, `auditLogger`, `headers`. `session` is resolved once per request by the server, and the actor id passed to the port always comes from it.

## Platform procedures

`platformProcedure(permissions)` checks `hasPlatformPermission(session.user.id, permissions)`. Actor identity comes from the session, never from input. A missing permission throws `FORBIDDEN`.

## User-scoped audit reads

Security-log rows (`scope = "user"`) belong to one person. `audit.listSelf` is a `protectedProcedure` that takes the user from the session, never from input. `audit.listUser` is `platformProcedure({ audit: ["read"] })`, so superadmin only, and takes `{ userId, ...listInput }`. `audit.listPlatform` is also `platformProcedure({ audit: ["read"] })` and excludes the user scope. See [audit-log.md](./audit-log.md#user-reads).

## Platform admin port

`PlatformAdminPort` (`platform-admin.ts`) wraps better-auth's admin actions behind the same pattern: `getUser`, `banUser`, `unbanUser`. `routers/platform.ts` depends on the port only.

Impersonation (R6.4) is intentionally not in the port. better-auth's `/admin/impersonate-user` and `/admin/stop-impersonating` change the caller's own session cookie. oRPC here does not forward that `Set-Cookie` (no `ResponseHeadersPlugin` wiring), so the session row would change while the browser cookie did not. The convention:

- Session and identity actions use better-auth's client (`authClient.admin.impersonateUser`, `authClient.admin.stopImpersonating`, in `apps/web/src/app/auth-client.ts`).
- App-domain platform actions (ban, unban, get) go through the port and oRPC.

better-auth enforces R6.4 itself whichever client calls it (see `packages/auth/src/admin-impersonation.integration.test.ts`).

`PlatformAdminAuthApi` types each endpoint as `(input: any) => Promise<any>`. better-auth exposes every endpoint as an overloaded `StrictEndpoint`, and TypeScript checks an overloaded value against a single-signature type using its first overload (the `asResponse: true` one). Typing the real input shape would make a real `Auth` instance fail to satisfy the type. The adapter builds each input from the port's own typed parameters and casts the result, so port callers keep full type safety. Only this boundary is loose.

Result shapes differ: `banUser` and `unbanUser` return `{ user }`; `getUser` returns the user directly.

## Error mapping

Only documented denials become a "no" answer; everything else is a server fault.

| Call                | Treated as denial                      | Result  |
| ------------------- | -------------------------------------- | ------- |
| `userHasPermission` | message `"user not found"` (no `code`) | `false` |

Lacking a permission is a normal `{ success: false }` return, never a throw.

Anything else (a DB failure, an `APIError` with an unrecognized code, an unexpected shape) is logged once and rethrown, so oRPC returns a 500 instead of a silent `FORBIDDEN`. The log carries the operation name and the error's name and message only, never request headers (session cookie) or the permissions payload.

Errors are recognized structurally (`name === "APIError"`, then `body.code`, or `body.message` for the few code-less errors). That mirrors better-auth's own `isAPIError` fallback and avoids a runtime dependency on `better-auth`.

`PlatformAdminPort` applies the same policy through `rethrowMapped`. A known code becomes an `ORPCError`; anything else propagates unchanged.

| better-auth code          | oRPC error    |
| ------------------------- | ------------- |
| `USER_NOT_FOUND`          | `NOT_FOUND`   |
| `YOU_CANNOT_BAN_YOURSELF` | `BAD_REQUEST` |

## Web permission checks

The web app mirrors permissions for UX only (R5.3). Hiding or disabling an action never replaces the server check above, which re-validates every request.

Code: `apps/web/src/features/access-control/{hooks,lib}`.

### `usePlatformCan` and `parsePlatformPermission`

- `usePlatformCan("feature:action")` calls `admin.hasPermission` with no `userId` or `role`: better-auth 1.7.5 then resolves both from the caller's own session, never from client input (R6.5). Results are cached per permission with `staleTime` 60 s; it is not a live subscription, so a role change made elsewhere shows up within that window.
- `parsePlatformPermission` (`lib/platform-permission.ts`) is the pure parser that turns a `"feature:action"` string into the `{ feature, action }` pair better-auth expects.
- `isSuperadminRole` (`lib/platform-role.ts`) reads the session's `role` for layout guards and navigation visibility; it is a UX shortcut, not an authority.
- Today's platform catalog has two roles (`superadmin` with everything, `user` with nothing), so `usePlatformCan` mostly guards a future narrower platform role.
- `hasPermissionLoadError`: a query that has resolved once keeps its card rendered when a later background refetch fails. Replacing an authorized, possibly mid-edit card with a full-card error on a transient failure is worse than showing stale but correct data. Only a first load that failed reports an error.
