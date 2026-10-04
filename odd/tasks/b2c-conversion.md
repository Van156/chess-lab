# B2C conversion

## Objective

Turn this copy of `base-template` (B2B: multi-tenant organizations, org RBAC) into `b2c-template`: the same stack, structure, tooling, Storybook, tests and docs conventions, focused on individual consumer accounts.

## Problem / why

`base-template` assumes every user acts inside an organization (onboarding creates one, `/dashboard` lives under the `_org` guard, API work runs through `orgProcedure`). A consumer product has individual users only, so the tenancy layer is dead weight and wrong defaults.

## Scope (authorized, user decisions 2026-10-03)

- Remove: organizations, members, invitations, org roles / dynamic access control, active-organization session state, org switcher, onboarding (org creation), accept-invitation, org settings pages, org-scoped audit log, org limits (`DEFAULT_MAX_ORGS_PER_USER`, override column, admin org-limit card), admin organizations list, demo `project` router.
- Keep: individual accounts and auth (email/password, social, sessions, verification, reset), account settings, app shell (without org switcher), dashboard (moved out of `_org`), data-table, prototype-lab, Storybook, design system, user-scoped audit / security log.
- Keep platform admin (better-auth `admin` plugin: users list, user detail, ban, impersonate, `db:seed:admins`, `PLATFORM_ADMIN_EMAILS`, `platformProcedure`), trimmed of org-tied pieces.
- Rename `base-template` / `@base-template/*` to `b2c-template` / `@b2c-template/*` everywhere (packages, imports, scripts, docker-compose, docs, tests, `.atl`).

## Constraints

- Conventional commits, no AI attribution lines.
- TDD: on for pure logic, source: inherited project convention (`odd/tasks/data-table.md`), runner `bun test`. Deletions, config, UI markup and stories use ordinary checks.
- Drizzle migrations: replace the inherited migrations with one fresh baseline generated from the trimmed schema.
- `routeTree.gen.ts` is regenerated, never hand-edited.

## Tasks

- [x] **T1 — Rename** `base-template` to `b2c-template` across the repo; `pnpm install`; baseline checks green. Route: delegated (writer, 300+ files mechanical).
- [x] **T2 — Backend tenancy removal**: `packages/db` (org/member/invitation/organizationRole tables, `session.activeOrganizationId`, org-limit column, audit org scope, fresh migration baseline), `packages/auth` (organization plugin, invitation sign-up plugin, org members/limit/owner/invitation-token, org permissions, invitation emails, audit org actions, testing helpers), `packages/api` (`orgProcedure`, `requirePermission`, organization/members/project routers, org audit list, authorization port trimmed to platform), `apps/server` (env, services, context). Route: delegated (writer).
- [x] **T3 — Web tenancy removal**: routes (`_auth/_org` → dashboard + no org settings, `_onboarding`, `accept-invitation`, admin organizations), features (`organizations`, `invitations`, `access-control`, admin org pieces, org audit pages), org switcher, navigation, auth-client plugins, redirects/search params, delete-account owner blocking, story fixtures + `tests/lib/app-story-registry.ts`. Route: delegated (`react-staff`).
- [x] **T4 — Docs and ODD**: README, `docs/README.md`, architecture/specs (drop tenancy docs, rewrite auth/authorization/web-app/audit-log), retire inherited org ODD docs, B2C positioning in `brand.ts`. Route: delegated (writer).

- [x] **T5 — Review advisory fixes**: resolve the spec-consistency advisories from the T3+T4 review (dashboard-shell R52/R55/R56, auth-and-platform-admin audit write order + R6/R7 gaps, account-settings "eligible", authorization/audit-log wording, org-lifecycle banner, data-table stale org-audit rows) and evaluate `auth-search.ts:41` `socialSignInTargets`. Route: delegated (writer, 6+ files).

## Acceptance criteria

- No references to organization/member/invitation/org role in source, schema, or tests (grep-clean except third-party names).
- `pnpm check-types`, `pnpm lint`, `bun test` (with `db:test:prepare` Postgres) pass; `pnpm build` passes.
- Signed-in user lands on `/dashboard` with no onboarding step; platform admin area works for superadmins.

## Checks

`pnpm check-types` · `pnpm lint` · `bun test` · `pnpm build` · `pnpm build-storybook` (CI=true)

## Progress

- Baseline import commit `b7583a4` on `main`; feature branch `feat/b2c-conversion`.
- T1 done: scope `@base-template/` -> `@b2c-template/` and bare name renamed across 346 files; `pnpm install` ok; `pnpm check-types` exit 0, `pnpm lint` exit 0, `bun test` 1271 pass / 1 skip / 0 fail (after `db:test:prepare`). Commit: `chore: rename base-template to b2c-template` (hash in git log; amend-stable).

- T2 done (backend): schema trimmed (organization/member/invitation/organization_role tables, `session.activeOrganizationId`, `user.maxOrganizations`, `audit_log.organization_id` + FK/index/check; audit scope enum now `platform | user`); migrations replaced by one baseline `20261004004441_chief_stone_men`; auth/api/server stripped of organizations, invitations, org RBAC and the demo `project` router; platform admin and user-scoped audit kept. Test Postgres port moved 5436 -> 5437 (`docker-compose`, since the `docker compose` plugin is missing here). Checks: `check-types` db/auth/api/server exit 0; `pnpm lint` exit 0; `bun test packages apps/server` 384 pass / 0 fail / 0 skip (integration executed on :5437). Route: delegated writer (deletions plus test rewrites). Commit: see `git log` (`refactor!: remove organizations and org rbac from backend`).
- Review (T1+T2 group): the group range and T2 alone both stopped with `lens_context_budget_exceeded` (no authority created). With user approval, T2 (`4d21e95`) was split into 7 ordered slices (consumers before providers; final tree byte-identical to `4d21e95`, kept as `backup/t2-single`): `0325bad` api/server, `a5f53d6` api deletions, `6b26101` auth, `f1623e5` auth deletions, `b9c089b` db schema, `b98336f` migration baseline, `c5fb95e` docs. All 7 natively reviewed: approved and acknowledged, each over a detached worktree. T1 (mechanical rename) left unreviewed by design; evidence is the empty grep + green checks. Advisory follow-ups: the `targetType` audit filter test no longer discriminated (fixed in a follow-up commit by seeding a `session` target); the rest are slice-boundary artifacts (schema vs. migration), not applicable to a new template (no upgrade path), or web consumers handled by T3 (`platform.users.get` shape, dangling routers).

- T3 done (web): `apps/web` has no organization, member, invitation, org-role, onboarding or org-switcher code; `/dashboard` moved to `_auth/dashboard` (app shell, no org guard); nav has Dashboard, Account settings and superadmin-only Platform (Users, Activity); `access-control` is trimmed to the platform slice (`usePlatformCan` re-implemented via a pure `parsePlatformPermission`, `isSuperadminRole`, `hasPermissionLoadError`); admin keeps users list, user detail (ban, impersonate) and platform activity; audit log keeps platform and user logs; sign-in/up lost invitation threading; delete-account lost owner blocking. Slices: `8d0307a` shell/nav/dashboard, `ff2e202` admin + audit-log trims, `73030a7` feature and route deletions, `c9c6994` auth/account flows, `bb19c05` shared stories/fixtures/registry. TDD (bun test): RED then GREEN for navigation, auth-search, audit-log search/export/display and platform-permission. Checks: `pnpm check-types` exit 0, `pnpm lint` exit 0, `bun test` (Postgres :5437) 941 pass / 1 skip / 0 fail, `pnpm --filter web build` exit 0, `CI=true pnpm build-storybook` exit 0; grep for organization/invitation/CanGate/etc. in `apps/web` and `tests` leaves only the auth-search test asserting a legacy `invitationId` is dropped. Gaps: the data-table fixtures still use generic "member" rows/copy (identifier-level rename not done); stale spec-path comments (`docs/specs/auth-multitenant-rbac.md`) in `users-page.tsx`, `admin/route.tsx`, `no-permission.tsx` are left for T4 with the docs rewrite. Route: delegated (`react-staff`).

- T4 done (docs): `auth-multitenant-rbac.md` replaced by `docs/specs/auth-and-platform-admin.md` (R0, R5 to R7 ids kept so code tags stay valid); `account-and-org-settings.md` renamed and trimmed to `docs/specs/account-settings.md` (R1 to R7); shell, foundation and data-table specs trimmed (the shell spec keeps its org-switcher/invitation text as design history under a "Tenancy removed" banner); architecture docs (`authorization`, `auth`, `audit-log`, `web-app`, `data-table`) rewritten for the platform-only model; README repositioned as the B2C template with an "Authentication & platform admin" section; `docs/README.md` index updated; 9 inherited ODD docs got the header note (nothing deleted in `odd/`); 11 code comments repointed to the new docs/anchors; `brand.ts` tagline verified; `.agents/.claude/.cursor` have only generic mentions (unchanged). Commits: `eda69d3`, `e49a78c`, `2243dad`, `8c0fa83`, `e19a616`, `8d5fc73`, `7ab22e1`, `81f13c1`. Checks: `pnpm lint` exit 0, `pnpm check-types` exit 0, `bun test tests` 23 pass / 0 fail, relative-link and doc-anchor check over README.md, docs/ and code comments 0 broken (the only dangling `docs/agents/*` refs are in generic `.agents` skills, pre-existing), `git grep` for organization/tenancy terms in README.md and docs leaves only intentional "no organizations" statements and the design-history text in `dashboard-shell-and-auth-ui.md`. Route: delegated (writer).

## Handoff to T3

Root `pnpm check-types` fails only in `apps/web` (expected). `tsc --noEmit` in apps/web reports 37 errors across: `src/app/auth-client.ts` (imports `orgAc`/`orgRoles`; drop the `organizationClient` plugin and `dynamicAccessControl`), `features/access-control/*` (`role-form.tsx`, `use-can.ts`, `use-platform-can.ts`, `role-catalog.ts`: `parsePermissionString`, `permissionStringsToObject`, `permissionsObjectToStrings`, `listCatalogPermissions`, `BUILT_IN_ORG_ROLES`, `orgRoles`; `use-platform-can.ts` also used `parsePermissionString`), `features/admin/*` (`org-limit-card.tsx`, `organizations-page.tsx`, `organizations-search(.test).ts`, `user-detail-page.tsx`), `features/audit-log/*` (`audit-log-columns.tsx`, `org-activity-page.tsx`, `audit-log-search(.test).ts`, `platform-activity-page.tsx`, `self-security-log.tsx`, `user-activity-log.tsx`), `features/organizations/*` (members/danger-zone/lifecycle hooks, `members-search(.test).ts`).

Removed backend surface:

- API routers: `organization.*`, `members.*`, `project.*`, `audit.list` (org log), `platform.organizations.list`, `platform.users.setOrganizationLimit`.
- Changed: `platform.users.get` now returns the user directly (was `{ user, defaultMaxOrganizationsPerUser }`); `PlatformUser` has no `maxOrganizations`.
- `@b2c-template/api`: `orgProcedure`, `requirePermission`, `OrgPermissions`, `ActiveMembership`; `AuthorizationPort` is now `hasPlatformPermission` only; `Context` has no `defaultMaxOrganizationsPerUser`; `lib/members-list-config` deleted; `lib/audit-list-config` drops `orgAuditListConfig`, `ORG_LOG_ACTIONS`, `AUDIT_SCOPES`, platform list has no `scope`/`organization` column; `lib/platform-list-config` drops `platformOrganizationsListConfig`.
- `@b2c-template/auth`: `permissions` now exports only the platform catalog (`platformAc`, `platformRoles`, `platformStatements`, `superadmin`, `user`); deleted `permissions/org`, `permissions/helpers`, `org-members`, `org-limit`, `owner-role`, `invitation-token`, `plugins/invitation-sign-up`; `listPlatformOrganizations` and organization types removed from `@b2c-template/auth/platform`; audit actions: no `ORGANIZATION_AUDIT_ACTIONS`, no `user.org_limit_changed`; `AuditScope = "platform" | "user"`; `EmailSender.sendInvitation` removed; `USER_IS_LAST_OWNER` delete-account guard removed (`assertNotLastOwner`, `findLastOwnerOrganizations`); `AuthConfig` has no `DEFAULT_MAX_ORGS_PER_USER`; `RecordingEmailSender` has no invitation helpers.
- better-auth client plugins to drop on the web: `organizationClient` (and its `ac`/`roles`/dynamic access control); keep `adminClient` with `platformAc`/`platformRoles`. Server no longer exposes `/organization/*`, `signUpViaInvitation`, `acceptInvitation`, etc.
- Session no longer has `activeOrganizationId`; `user` additional field `maxOrganizations` is gone.

## Next step

Delivered: `feat/b2c-conversion` fast-forwarded into local `main` at `20ae3f4` (no remote configured). Remaining cleanup is optional: delete `feat/b2c-conversion` and `backup/t2-single`.

- T5 done: spec advisories resolved in `f2e4761` (shell R5.2/R5.5/R5.6, auth R7.2 write order + id-gap note, resend cooldown documented as client-only, account-settings R6.2/R6.4, data-table historical rows, audit-log typo), `b894119` (org-lifecycle and storybook banners), `d61e37e` (neutral nav fixture labels); `socialSignInTargets` narrower signature confirmed intended (only callers pass `{ origin, errorPath }`), architecture wording verified consistent. Checks: `pnpm lint` exit 0, `pnpm check-types` exit 0, `bun test apps/web/src/features/auth apps/web/src/shared` 411 pass / 0 fail (parent spot check `bun test apps/web/src/shared` 359 pass / 0 fail), relative links 0 broken. Review (T5 alone, base `f149a35`): high, approved and acknowledged; follow-up R7.2 "never records a failed action" contradiction fixed in the next docs commit. Remaining suggestions (nav test fixture labels vs. routes, redundant Google scope wording in shell spec R5.x) left as optional. Route: delegated (writer).

- Review (T3+T4 group, per commit from boundary `c5fb95e`): `cca5a98`, `8d0307a`, `ff2e202` approved and acknowledged (advisory only). `73030a7` (pure deletion, ~4.7k lines) exceeded the lens budget, so it was re-split in a detached worktree without rewriting the branch: 5 slices whose final tree is byte-identical to `73030a7` (routes + small edits, access-control, invitations, organizations components, organizations hooks/lib); all 5 approved and acknowledged. Then every later commit was assessed per commit: `c9c6994`, `bb19c05`, `eda69d3`, `e49a78c`, `8c0fa83`, `7ab22e1`, `81f13c1` approved and acknowledged; `7d56425`, `2243dad`, `e19a616`, `8d5fc73`, `7b19017`, `19afc20` passive (no review). Branch fully reviewed through `19afc20`.
- Advisory follow-ups (non-blocking): `docs/specs/dashboard-shell-and-auth-ui.md` R52 still mentions invitation sign-up and R55/R56 contradict each other; `docs/specs/auth-and-platform-admin.md` has an audit write-order contradiction (~L157) and unexplained R6/R7 id gaps; `docs/specs/account-settings.md` L155 "eligible" request is undefined; `docs/architecture/authorization.md:91` and `audit-log.md:31` wording; the `odd/tasks/org-lifecycle.md` banner understates the removal; `auth-search.ts:41` `socialSignInTargets` signature narrowed; data-table spec still lists stale org-audit task rows.
