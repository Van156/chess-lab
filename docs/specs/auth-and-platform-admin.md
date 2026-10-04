# Spec: Authentication, Platform Admin & Audit Log

- **Status:** Approved
- **Stack:** Hono + oRPC (server), TanStack Router (web), Drizzle + Postgres, better-auth `1.7.5`
- **Numbering:** requirement ids are stable and cited from code as short tags (`R6.4`). The sections that applied to organizations, invitations, members and dynamic roles do not exist in this template, so the series starts at R0 and skips R1 to R4. Gaps inside a section (R6.6, R7.4) are ids of requirements that no longer exist; ids were kept from the inherited spec and are never renumbered, so tags in code comments stay valid.

## 1. Objective

Provide a reusable B2C template where:

1. Individual users authenticate (email and password, optional Google) and land on their dashboard.
2. A **platform superadmin** operates across all users: list and search, ban, impersonate.
3. Privileged and security-relevant actions are recorded in an append-only **audit log**.

Self-service account management (profile, email, password, sessions, deletion) is specified in [account-settings.md](./account-settings.md).

## 2. Scope

### In scope

- better-auth email and password, with email verification.
- better-auth `admin` plugin for the platform layer.
- Code-defined platform permission catalog, single source of truth.
- Email sending behind a port, with console (dev, test) and Resend (production) adapters.
- Server-side authorization middleware for oRPC procedures.
- Web UI: platform admin area (users, activity).
- Audit log with `platform` and `user` scopes.

### Out of scope

- Organizations, teams, roles per organization, invitations (this template has individual accounts only).
- 2FA, passkeys.
- Billing.
- Resource-level (row/ABAC) permissions.

## 3. Glossary

| Term               | Meaning                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| **Platform layer** | Operator-level scope across all users. Managed by the `admin` plugin; stored in `user.role`.  |
| **Permission**     | A `feature:action` pair, e.g. `user:ban`. Stored by better-auth as `{ user: ["ban"] }`.       |
| **Catalog**        | The full set of platform permissions the app supports. Defined in code only.                  |
| **Superadmin**     | The one built-in platform role with permissions. Every other user has role `user`, with none. |

## 4. Architecture

### 4.1 One permission layer

```
Platform: admin plugin, user.role = superadmin | user, catalog platformAc (user, session, audit)
```

- Ordinary users hold no platform permission. There is no per-user or per-organization permission layer: an individual only ever acts on their own account, and that is enforced by taking the user id from the session.
- Platform access to user data happens only through platform-scoped procedures or impersonation (audited).

### 4.2 Permission catalog (code)

Location: `packages/auth/src/permissions/platform.ts` (shared by server and web). `platformStatements` is better-auth's admin defaults plus `audit: ["read"]`. `superadmin` gets better-auth's built-in admin permissions (which withhold `user:impersonate-admins`) plus `audit:read`; `user` gets none.

Adding a platform permission = adding a key to `platformStatements` and granting it to `superadmin`. No database migration.

### 4.3 Server configuration

- `emailAndPassword` with `requireEmailVerification`; `emailVerification` sends on sign-up and signs the user in after verification.
- `admin({ ac: platformAc, roles: { superadmin, user }, defaultRole: "user", adminRoles: ["superadmin"], impersonationSessionDuration: 3600 })`.
- Account-security options (reset password, change email, delete account) are specified in [account-settings.md](./account-settings.md).

### 4.4 Email port (hexagonal)

`EmailSender` (`packages/auth/src/email/types.ts`) is the only email dependency of auth code.

- `ConsoleEmailSender` (dev, test): logs the link.
- `ResendEmailSender` (production): requires `RESEND_API_KEY` and `EMAIL_FROM` (verified sender domain).
- The adapter is selected by env: `RESEND_API_KEY` present means Resend, otherwise console. `NODE_ENV=production` without `RESEND_API_KEY` throws at startup, so tokens never reach a production log.

### 4.5 oRPC authorization

Procedure builders in `packages/api`:

| Builder                          | Guarantees                                                     |
| -------------------------------- | -------------------------------------------------------------- |
| `publicProcedure`                | none                                                           |
| `protectedProcedure`             | valid session                                                  |
| `platformProcedure(permissions)` | session + platform permission via `auth.api.userHasPermission` |

- Self-service procedures use `protectedProcedure` and take the user from the session, never from input.
- Client-side checks are UX only. The server is the authority.

## 5. Data model

Generated by the better-auth CLI into `packages/db/src/schema/auth.ts`, then migrated with Drizzle.

| Table       | Source                         | Key fields                                                                                                                                                                                                                              |
| ----------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`      | core + admin                   | `role`, `banned`, `banReason`, `banExpires`                                                                                                                                                                                             |
| `session`   | core + admin                   | `impersonatedBy`                                                                                                                                                                                                                        |
| `audit_log` | app (Drizzle, not better-auth) | `id`, `scope` (`platform` \| `user`), `actorUserId`, `impersonatorUserId` (nullable), `action`, `targetType`, `targetId`, `metadata` (JSONB), `ip`, `userAgent`, `createdAt`. Indexes: `(actorUserId, createdAt)`, `(scope, createdAt)` |

## 6. Requirements

### R0 — Sign-up & email verification

**R0.1 Verification required**

- GIVEN a user signs up with email + password
- THEN a verification email is sent and sign-in is refused until the email is verified.

**R0.2 Auto sign-in after verification**

- WHEN the user clicks a valid verification link
- THEN `emailVerified = true` and they are signed in and redirected to `/dashboard`.

**R0.3 Resend link**

- GIVEN an unverified user on the "check your inbox" screen
- THEN they can request a new verification email (client-side 60s cooldown; UX only, see Known limitations).

**R0.4 Expired link**

- WHEN a verification link is expired or invalid
- THEN an error is shown with a "resend" action; nothing changes.

### R5 — Authorization enforcement

**R5.1** Every platform procedure uses `platformProcedure` and takes the actor from the session, never from input.

**R5.2** A request without the permission returns `FORBIDDEN`; without a session `UNAUTHORIZED`.

**R5.3** The web UI hides or disables actions using `usePlatformCan("feature:action")`, backed by the server's `admin.hasPermission` (resolved from the caller's own session); routes guard on the same check. UX only.

### R6 — Platform super admin

**R6.1 Bootstrap** — the first `superadmin` is assigned via a seed command using an env var (`PLATFORM_ADMIN_EMAILS`); never through a public endpoint.

**R6.2 List users** — `superadmin` can search, sort, filter and paginate all users.

**R6.3 Ban / unban** — `superadmin` can ban a user (with reason and optional expiry); banned users' sessions are revoked and sign-in is refused.

**R6.4 Impersonation** — `superadmin` can impersonate a non-superadmin user; the session carries `impersonatedBy`, a persistent banner is shown, and it ends on "stop impersonating" or after 1h.

**R6.5 Isolation** — platform routes (`/admin/*`) and procedures reject non-superadmins.

**R6.7 Audit** — impersonation start/stop, bans and platform role changes are recorded in `audit_log` with `scope = platform` (see R7).

### R7 — Audit log

**R7.1 Recorded events** — at minimum:

| Scope      | Actions                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform` | `user.banned/unbanned`, `user.impersonation_started/stopped`, `user.platform_role_changed`                                                                      |
| `user`     | `user.email_changed`, `user.password_changed`, `user.password_reset`, `user.session_revoked`, `user.deleted` (see [account-settings.md](./account-settings.md)) |

**R7.2 Write path**

- Events are written from a single `AuditLogger` port (hexagonal), called from better-auth hooks (admin plugin and account-security hooks) and from oRPC procedures.
- The audit write runs inside the same request as the action. Order depends on the event: platform events and most user events are written after the action succeeds (better-auth after-hooks; a failed action returns early with no event). `user.deleted` is the exception: it is written before the delete (`deleteUser.beforeDelete`), and a failed audit write aborts the delete. No transaction spans action and audit write, so a delete that fails after a successful write still leaves its `user.deleted` row (see [account-settings.md](./account-settings.md) R6.4 and Known limitations).
- Actions performed while impersonating record both the impersonated user (`actorUserId`) and the superadmin (`impersonatorUserId`).
- `metadata` stores before/after values for changes (e.g. old/new role). Secrets, tokens and passwords are never stored.

**R7.3 Append-only** — there is no update or delete API for audit entries; the app DB role has no `UPDATE`/`DELETE` on `audit_log` in production (recommended).

**R7.5 Platform activity view** — a `superadmin` can list platform-scope entries, filter by actor, action and date. User-scope entries are read per user (self view and admin Activity tab).

**R7.6 Retention** — configurable via `AUDIT_LOG_RETENTION_DAYS` (default: unlimited); a scheduled job purges older entries.

## 7. Web routes (TanStack Router)

| Route                                   | Guard                 | Purpose                                                         |
| --------------------------------------- | --------------------- | --------------------------------------------------------------- |
| `/sign-in`, `/sign-up`, `/verify-email` | public                | existing                                                        |
| `/dashboard`                            | session               | landing page after sign-in                                      |
| `/account/*`                            | session               | account settings ([account-settings.md](./account-settings.md)) |
| `/admin/users`, `/admin/users/$id`      | platform `superadmin` | R6                                                              |
| `/admin/activity`                       | platform `superadmin` | platform audit log (R7.5)                                       |

## 8. Non-functional requirements

- **Security:** the acting user always comes from the session; platform actions are re-checked on the server; rate-limit sign-in endpoints.
- **Testing:** unit tests for the catalog helpers and middleware; integration tests against Postgres (docker) for every scenario in §6, especially R6.3, R6.4 and R6.5.
- **DX:** adding a platform permission is a single-file change in the catalog.

### Known limitations

- **R0.3 resend cooldown is client-side only** — the 60s cooldown is UX only in the web app. This template configures no server-side rate limit on `/send-verification-email`; add one before relying on it as abuse protection.
- **Audit write is not transactional with the action** — see `docs/architecture/audit-log.md#failure-policy`.

## 9. Acceptance criteria

- [ ] All §6 scenarios covered by passing tests.
- [ ] A new platform permission can be added and enforced by editing only the catalog and one procedure.
- [ ] A non-superadmin receives `FORBIDDEN` from every `platformProcedure`.
- [ ] Dev flow works end to end with `ConsoleEmailSender` (verification link visible in server logs).
- [ ] Every R7.1 action produces exactly one `audit_log` entry.
- [ ] Migrations apply cleanly on an empty database.
