# Web app pages and routes

Rationale behind the page, route and guard comments in `apps/web`. Requirement ids refer to [`specs/auth-and-platform-admin.md`](../specs/auth-and-platform-admin.md) and [`specs/account-settings.md`](../specs/account-settings.md).

## Branding

The product name, tagline, logo and PWA theme color live in `apps/web/src/app/brand.ts`; the auth
brand panel, document title, meta description and PWA manifest (`vite.config.ts`) all read from it.
The color palette is driven by one knob, `--brand-hue`, in `packages/ui/src/styles/globals.css`.
If you change the hue, update `themeColor` in `brand.ts` to match the light-mode `--sidebar` token.

`/` has no page: it redirects to `/dashboard` for a signed-in user and to `/sign-in` otherwise (`loadHomeRedirect` / `resolveHomeRedirect`). A rejected session lookup is logged and forwarded to `/dashboard`, so the `_auth` guard owns the decision.

Auth screens render in `AuthLayout`: the form column (`AuthCard`) beside an ink brand panel fed by `brand.ts`. Inputs and buttons on these screens opt into the large size with `size="lg"`; terminal states use `AuthStatusNotice`, whose link actions pass `className="w-full"` on the wrapping `Link`.

## Signed-in layout

`routes/_auth/route.tsx` guards every authenticated route on a session (no session redirects to `/sign-in`). Routes that set `staticData: { appShell: true }` (`dashboard`, `account`, `admin`) are wrapped once in `AuthenticatedShell`, so the sidebar stays mounted between them. There is no further guard: a signed-in user goes straight to `/dashboard`, with no onboarding step. Verifying an email also goes to `/dashboard`.

Permission checks exist only for the platform layer (see [Admin area](#admin-area)). They are UX only: every underlying read and write is re-checked server-side regardless of what renders.

## Account area and password recovery

`routes/_auth/account/route.tsx` is the personal area (account-settings R1). It sits under `_auth` and opts into the app shell with `staticData: { appShell: true }`. `/account` redirects to `/account/profile`.

| Route                  | Page                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `/account/profile`     | Name (email read-only).                                                                        |
| `/account/security`    | Email change, change or set password, sessions, security log. Table state lives in the search. |
| `/account/preferences` | Theme.                                                                                         |
| `/account/danger`      | Delete account: confirm dialog, then an emailed link.                                          |

Public routes `/forgot-password` and `/reset-password` live in `_public-auth`. The reset link lands on `/reset-password?token=...`; only an `INVALID_TOKEN` error switches to the invalid-link state, other failures stay inline and retryable. After the delete link is opened the server redirects to `/sign-in`.

Navigation: `navGroups` in `app/navigation.ts` is the single source for the sidebar and the section tabs (`getSectionItems`). The Dashboard and `account` ("Personal") groups are always visible; the `admin` ("Platform") group is visible only to superadmins (`NavContext.isSuperadmin`). Visibility is UX only; the admin layout keeps its own check.

## Admin area

`routes/_auth/admin/route.tsx` shows the area only to platform superadmins (`isSuperadminRole`, R6.5). This is UX only: every procedure under `platformRouter` re-checks the caller's platform permission. It renders `NoPermission` rather than redirecting.

The user detail page has Details and Activity tabs (`tab` in the route search; Activity is the user's security log, see [audit-log.md](./audit-log.md#views)). It keys each card by user id. TanStack Router keeps the page mounted when only the `$id` param changes, so without the key each card's local state (the in-progress ban reason and expiry) would survive navigating between two users and could be saved against the wrong one.

### Impersonation

Impersonate and stop-impersonating go through better-auth's own client (`authClient.admin.stopImpersonating`), not oRPC: session and identity actions belong to better-auth. Both invalidate every cached query, because everything derived from "who am I" (roles, permissions) changes at once; the banner then returns to `/admin/users`.

### Permission load errors

`permission-load-error.tsx` is the shared early return of the ban and impersonate cards. It renders only when the `usePlatformCan` query has no cached `data` (the first permission load failed). A failed background refetch of an already resolved query must not replace a working, authorized card mid-edit.

## Audit log pages

The platform page (`/admin/activity`) uses `audit.listPlatform`. It shares the table, display helpers and server allowlists with the per-user security log so they cannot drift. Its actor filter is a free-text id: a platform-wide user directory would mean loading every user, which does not bound the way a filtered list does.

The per-user log (self at `/account/security`, admin at `/admin/users/$id`) is described in [audit-log.md](./audit-log.md#views).

## Load errors

`LoadError` is the one retryable load-failure presentation. A failed platform permission check must surface a retryable error, never the permanent `NoPermission` screen.
