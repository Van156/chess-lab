# Spec: Account Settings

- **Status:** Approved (all decisions in §9 resolved)
- **Date:** 2026-10-01
- **Stack:** better-auth 1.7.5 (admin plugin), oRPC, Drizzle/Postgres, React 19, TanStack Router + Query, `@tanstack/react-form` + zod, `packages/ui`, Storybook, `bun:test`
- **Depends on:** `auth-and-platform-admin.md` (platform layer, audit log), `dashboard-shell-and-auth-ui.md` (shell, user menu, auth pages), `data-table.md` (list pages), `frontend-foundation.md` (feature structure, import boundaries).

## 1. Objective

Give the B2C starter the self-service settings every product built on it needs: a personal area where a signed-in user manages their profile, email, password, sessions, theme, and can delete their account, plus the forgot-password flow and a user-scoped security log.

## 2. Scope

### In scope

- `/account/*` area: Profile, Security (email, password, sessions, security log), Preferences, Danger zone.
- Forgot-password and reset-password public pages.
- `EmailSender` methods and templates for reset password, change-email approval, delete-account confirmation, and password-changed notice.
- `user` audit scope and account audit actions.
- Admin user detail "Activity" tab for user-scoped events.

### Out of scope

- File storage and avatar uploads (initials fallback only; a separate feature).
- Linking or unlinking Google from account settings.
- Server-persisted preferences (theme stays client-side).
- Soft delete or grace periods for accounts.
- Billing, notifications, API keys.

## 3. Glossary

| Term                    | Meaning                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Account area**        | Routes under `/account/*`, available to any signed-in user.                    |
| **Security event**      | Email change, password change, password reset, session revoke, account delete. |
| **User-scoped audit**   | `audit_log` row with `scope = "user"`; the target is the user.                 |
| **Danger zone**         | A visually separated section for destructive, confirmed actions.               |
| **Credential password** | A better-auth `credential` account; Google-only users do not have one.         |

## 4. Decisions summary

The full list with rationale is in §9. Key ones:

- Account settings live at `/account/*`.
- Change email requires approval from the **old** address, then verification of the **new** one.
- Google-only users obtain a password through the forgot-password email link, not an in-app form.
- Account deletion is confirmed by email link, then hard-deleted.

## 5. Design

### 5.1 Routes

```
routes/
├── _public-auth/
│   ├── forgot-password.tsx           # request reset link
│   └── reset-password.tsx            # ?token= — set new password
├── _auth/
│   ├── account/
│   │   ├── route.tsx                 # account layout + SectionNav
│   │   ├── profile.tsx               # name; initials avatar
│   │   ├── security.tsx              # email, password, sessions, security log
│   │   ├── preferences.tsx           # theme
│   │   └── danger.tsx                # delete account
│   └── admin/users.$id.tsx           # Activity tab (scope = user)
```

`/account` is reachable from the user menu ("Account settings") in both header and sidebar variants.

### 5.2 Feature placement

- `apps/web/src/features/account/`: components, hooks, schemas for the account area.
- `packages/auth/src/email/`: port methods, templates, both adapters.
- `packages/auth/src/audit/`: `user` scope actions and hooks.
- `packages/api/src/routers/audit.ts`: user-audit list procedures (self and admin).

### 5.3 Email port

```ts
interface EmailSender {
  sendVerification(...): Promise<void>;
  sendResetPassword(input: { to: string; url: string }): Promise<void>;
  sendChangeEmailApproval(input: { to: string; newEmail: string; url: string }): Promise<void>;
  sendDeleteAccountConfirmation(input: { to: string; url: string }): Promise<void>;
  sendPasswordChangedNotice(input: { to: string; changedAt: Date }): Promise<void>;
}
```

Templates share one style. Emails never contain secrets beyond the single-use link.

### 5.4 Audit

- Scope: `audit_log_scope` is `["platform", "user"]`.
- Actions in `audit/actions.ts`: `user.email_changed`, `user.password_changed`, `user.password_reset`, `user.session_revoked`, `user.deleted`.
- Profile and theme changes are **not** audited.
- `user.deleted` is written **before** deletion, so a failed audit write blocks the delete.
- Read access: the user reads their own user-scoped rows; superadmins read any user's rows.

## 6. Requirements

### R1 — Account area

**R1.1 Access** — any signed-in user can open `/account/*`.

**R1.2 Entry point** — both user menu variants link to "Account settings".

**R1.3 Profile** — the user can change their display name. The avatar shows initials; there is no upload control.

### R2 — Email change

**R2.1 Approval from old address**

- GIVEN a signed-in user with a verified email
- WHEN they request a change to a new address
- THEN an approval link is sent to the **current** address and the email is unchanged.

**R2.2 Verification of new address** — after approval, a verification link is sent to the new address; the email changes only after it is opened.

**R2.3 Uniqueness** — a change to an address already used by another account fails without revealing which account.

**R2.4 Audit** — a completed change records `user.email_changed` with old and new addresses in metadata.

### R3 — Password

**R3.1 Change password** — a user with a credential password can change it by providing the current one.

**R3.2 Forgot password**

- GIVEN any email address
- WHEN submitted on `/forgot-password`
- THEN the response is identical whether or not an account exists, and a reset link is emailed only if it does.

**R3.3 Reset password** — a valid, unexpired token on `/reset-password` sets a new password; used or expired tokens fail.

**R3.4 Set password for Google-only users** — the Security page shows "Set a password" which triggers the reset email to the user's verified address; completing it creates a credential password.

**R3.5 Side effects** — after a change or reset: all other sessions are revoked, a password-changed notice is emailed, and `user.password_changed` / `user.password_reset` is recorded.

### R4 — Sessions

**R4.1 List** — the user sees their active sessions with device (user agent), IP, last active time, and the current one marked.

**R4.2 Revoke one** — the user can revoke any session except the current one; records `user.session_revoked`.

**R4.3 Revoke others** — "Sign out all other sessions" revokes every session except the current one; records one `user.session_revoked` per session.

### R5 — Preferences

**R5.1 Theme** — `/account/preferences` exposes light/dark/system using the existing theme provider; stored client-side only.

### R6 — Account deletion

**R6.1 Not applicable** — the id is kept so R6.2 to R6.4 stay stable; there is nothing to block account deletion on.

**R6.2 Email confirmation** — any signed-in user can request deletion (there is no eligibility check or blocking condition). `POST /delete-user` only emails a confirmation link to the account address; the account is not deleted until the link is opened (`GET /delete-user/callback`).

**R6.3 Hard delete** — on confirmation the user, sessions and accounts are deleted (cascades); audit rows remain with `actorUserId = NULL`.

**R6.4 Audit** — when the confirmation link is opened, `user.deleted` is recorded before the delete runs (`deleteUser.beforeDelete`); a failed audit write aborts the delete (fail closed). Known limit: the write is its own statement, so a delete that fails after a successful write leaves a `user.deleted` row for a user that still exists.

### R7 — Security log

**R7.1 Self view** — the Security page lists the user's own user-scoped events (newest first, paginated with the shared data table).

**R7.2 Admin view** — `/admin/users/$id` has an "Activity" tab listing that user's user-scoped events; superadmin only.

**R7.3 Isolation** — user-scoped events never appear in the platform activity list (they carry IP and user agent); a superadmin reads them per user through the Activity tab.

## 7. Acceptance criteria

- All R1–R7 scenarios have tests: integration tests against the Postgres test DB for every server rule and guard (R2, R3, R4, R6, R7), ordinary checks plus stories for UI.
- UI components have Storybook stories and pass the story-coverage test.
- Lint-boundary and feature self-import tests pass.
- `docs/architecture/auth.md`, `authorization.md`, `audit-log.md` and `web-app.md` describe the flows, scope and routes.

## 8. Tasks (historical)

1. Email port: methods, templates, Resend + console adapters (TDD).
2. better-auth config: `sendResetPassword`, `changeEmail` with old-address approval, `deleteUser` with email confirmation, revoke sessions on password change/reset (TDD).
3. Audit: `user` scope, actions, hooks, self/admin read procedures (TDD).
4. Public forgot/reset password pages.
5. Account area layout, user-menu entry, Profile and Preferences pages.
6. Security page: email change, password change / set password, sessions, security log.
7. Danger zone: delete account; admin user Activity tab.

## 9. Decisions

1. **Account v1** — name, change email, change/set password, sessions, delete account, theme. Google link/unlink deferred.
2. **Location** — `/account/*`.
3. **Avatar** — deferred until a storage feature exists; initials fallback.
4. **Forgot password** — included.
5. **Audit** — security events only, in a `user` scope, visible to the user and superadmins.
6. **Account deletion** — email confirmation link, then hard delete.
7. **Change email** — old address approves, new address verifies.
8. **Theme** — client-only.
9. **Notifications** — email notice on password change/reset only.
10. **Sessions** — auto-revoke others on password change/reset; "sign out all others" button.
11. **Set password (Google-only)** — via reset email link.
12. **Admin view** — Activity tab on admin user detail.
13. **Checks** — TDD on (`bun test`) for server/auth/API; ordinary checks and stories for UI.

## 10. Verified against better-auth 1.7.5

- Option names and hook shapes for `changeEmail` old-address approval, `deleteUser` verification and `beforeDelete`, `revokeSessionsOnPasswordReset`, and session listing are implemented in `packages/auth/src/account-security.ts`.
- `/reset-password` creates a credential account for a Google-only user, so no separate server-side `setPassword` call is needed.
