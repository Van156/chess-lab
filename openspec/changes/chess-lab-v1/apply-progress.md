# Apply progress: chess-lab-v1

## S0 (PR 1, branch feat/chess-lab-v1-s0)

- Done, commit d53b019. S0.6 manual 375px check pending with the user.

## S1a (PR 2, branch feat/chess-lab-v1-s1a)

- [x] S1a.1 package `@b2c-template/chess` created and registered; `chess.js` moved to the pnpm catalog (web uses `catalog:`).
- [x] S1a.2 RED observed: `Cannot find module './position'` (0 pass, 1 error).
- [x] S1a.3 GREEN: 15 pass. Note: chess.js 1.4 already omits non-capturable en-passant in FEN, so the test uses a raw FEN.
- [x] S1a.4 RED observed: pgn module missing (0 pass, 1 error).
- [x] S1a.5 GREEN: 6 pass.
- [x] S1a.6 `GLOSSARY.md` created from the design glossary.

## Review S0 + S1a (base e28dd17 to cfca8a5)

- Medium risk, reliability lens: APPROVED and acknowledged. Follow-up commits on this branch: f1d86bc (glossary stray row removed), 37e3508 (engine copy explicit in dev/start/build scripts because `vp run` skips npm pre-hooks). Next review boundary: cfca8a5.
- Review follow-up R3-castling-digit-untested: added `parseMove` castling test (`O-O`, `0-0`, UCI `e1g1`, and the queenside forms resolve to the same move). It passed immediately; no bug.

## S1b (PR 3, branch feat/chess-lab-v1-s1b)

- [x] S1b.1 `packages/chess/src/config.ts` (thresholds, CARD_SEVERITIES, MATE_CP, EVAL_CLAMP_CP, OPENING_PLY_LIMIT, ENDGAME_MATERIAL, TIME_PRESSURE_RATIO).
- [x] S1b.2 RED observed: `Cannot find module './classify'` (0 pass, 1 error).
- [x] S1b.3 GREEN: `classify.ts` (`screenCandidates`, `classifyGame`, plus `gamePhase`, `isTimePressure`, `sideToMoveCp`). After fixing three faulty test fixtures (illegal best moves, wrong eval series) and `-0` normalization: 29 classify tests pass.
- [x] S1b.4 idempotence test (same input twice, identical output).
- [x] S1b.5 exports added to `index.ts`.
- Interpretation notes: `PlyEval` is side-to-move relative (UCI) and `evals[i]` is the position after `i` plies. Endgame = non-pawn material at most 13 for EACH side. Plies with a missing/null eval, or without a legal best move, are skipped. `ClassifiedMistake` gained `clockInitialMs` (ADR-05 stores `clock_initial_ms`; not in the design interface).
- Verification: `bun test packages/chess` 51 pass; `bun test` 876 pass, 47 skip, 1 known env failure (requireTestDatabaseOrSkip); `pnpm check-types` and `pnpm --filter web check-types` clean; `pnpm check` changed no tracked files beyond the slice.
- Work Unit Evidence: focused `bun test packages/chess/src/classify.test.ts` 29 pass; runtime harness `bun -e classifyGame(...)` returned one mistake (ply 1, bestSan d4, opening) for a 150 cp loss; rollback boundary `classify.ts`, `config.ts`, `classify.test.ts`, index exports.

- S1b committed as 62ec7f4 (~419 authored lines, slightly over the advisory budget; tests not trimmed).

## S2 (PR 4, branch feat/chess-lab-v1-s2)

- [x] S2.1 conventions confirmed (`db:generate`, audit.ts pattern); `db:generate` needs `DATABASE_URL` set (any value).
- [x] S2.2 RED observed: `bun test packages/db/src/schema/chess-schema.test.ts` 0 pass, 7 fail (tables missing).
- [x] S2.3 GREEN: `lichess.ts`, `settings.ts`, `games.ts`, `cards.ts`. First run had 3 failures caused by the test (Drizzle builders are thenables, `rejects` needs a real promise); fixed with a `run()` wrapper, then 7 pass.
- [x] S2.4 `schema/chess-relations.ts` (`chessRelations` via `defineRelationsPart`), exported from `schema/index.ts` and spread in `relations.ts`.
- [x] S2.5 migration `20261004170342_medical_terrax` (add-only). Drizzle expressed the CHECK `num_nonnulls("mistake_id") = 1` natively, no hand edit.
- [x] S2.6 RED observed: `bun test tests/lint-boundaries.test.ts` 7 pass, 15 fail; fixtures under `tests/lint-boundaries/fixtures/{packages/chess,study,lichess,apps/web/src/app,shared/lib}`.
- [x] S2.7 GREEN: 22 pass. Three overrides added in `.oxlintrc.json`, new web patterns repeated in the `shared/**` override.
- Exact web rule: group `[@b2c-template/lichess(/**), @b2c-template/db(/**), @b2c-template/auth, @b2c-template/auth/**, !@b2c-template/auth/permissions]`. `apps/web/src/app/auth-client.ts` legitimately imports `@b2c-template/auth/permissions` (client-safe), so it is negated; fixture proves permissions stays allowed and `auth` / `auth/audit` fail.
- Verification: `bun test packages/db tests/lint-boundaries.test.ts` 98 pass; `pnpm check-types` clean; `pnpm --filter web check-types` clean; `pnpm check` clean (no warnings; changed only slice files); `bun test` 1016 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused command above; runtime harness = real Postgres test DB with migration applied via `db:test:prepare`; rollback boundary = schema/{lichess,settings,games,cards,chess-relations,chess-schema.test}.ts, index/relations edits, migration dir, `.oxlintrc.json`, lint test and fixtures.

## S2 split (auto-chain)

S2 came in at about 684 authored lines, so it was split at the task boundary (auto-chain): S2a schema (S2.1 to S2.5) on `feat/chess-lab-v1-s2` (PR 4) and S2b package lint rules (S2.6, S2.7) on `feat/chess-lab-v1-s2b` (PR 5, base PR 4). Every later PR number in the tasks forecast shifts by one.

- Split commits: S2a = e09e045 (~638 authored lines; needs `size:exception` for PR 4), S2b = 4c8a2ec.

## Review S1b + S2 (base cfca8a5 to 4c8a2ec)

- High risk, 4 lenses: APPROVED and acknowledged. Next review boundary: 4c8a2ec.
- Follow-ups done (apply job A): R2-misnamed-toLossCp (renamed to `sideToMoveCp` in classify.ts, index.ts, tests), R2-fixture-comment-permissions and R2-fixture-comment-relative (fixture headers now say "Allowed (not a violation)"), R2-misplaced-doc-comment (JSDoc moved onto the `sideToMove` test helper), R3-illegal-best-move-untested (new classify test: `bestUci` illegal in `fenBefore` skips the ply). `bun test packages/chess tests/lint-boundaries.test.ts`: 74 pass.
- Deferred follow-up R1-001 / R3-ownership-not-db-enforced: composite FKs for owner consistency are not added; ownership is enforced at app level through `protectedProcedure`. Revisit before launch.

## S3 (PR 6 after the S2 split, branch feat/chess-lab-v1-s3)

- [x] S3.1 RED observed: `Cannot find module './synthetic-email'` (0 pass, 1 error).
- [x] S3.2 GREEN: `synthetic-email.ts`, 4 pass.
- [x] S3.3 RED observed: `lichess-provider` module missing (0 pass, 1 error).
- [x] S3.4 GREEN: `lichess-provider.ts` (`buildLichessOAuthConfig`, `fetchLichessAccount`), 10 pass.
- [x] S3.5 RED observed: 9 integration tests fail (provider not registered, 404 on sign-in).
- [x] S3.6 GREEN: `lichess-account.ts` plugin plus `index.ts` wiring (`genericOAuth`, `encryptOAuthTokens: true`); 9 pass after the two fixes below.
- [x] S3.7 RED observed: factory test file errored on missing `withoutSyntheticRecipients`; GREEN: wrapper in `email/factory.ts`, applied inside `createAuth`.
- [x] S3.8 RED observed: 2 of 3 new tests fail; GREEN: `listEnabledSocialProviders` lists `lichess` when `LICHESS_CLIENT_ID` is set.
- [x] S3.9 `LICHESS_CLIENT_ID` (optional, no secret) added to `apps/server/.env.schema`; `src/env.ts` is generated and gitignored (`pnpm --filter server env:generate`). No `.env.example` exists.
- S3.10 (React sign-in button) remains pending for the react-staff writer.
- Deviations and gotchas (better-auth 1.7.5): (1) generic-oauth serves providers through the SOCIAL routes, not `/oauth2/*`: start with `POST /sign-in/social { provider: "lichess" }` (client: `authClient.signIn.social({ provider: "lichess" })`, NOT `signIn.oauth2`), callback is `/callback/lichess`; the plugin hook matcher sees the route template `/callback/:id`, so the provider id is read from `ctx.params.id`. (2) The synthetic-email send guard lives in `withoutSyntheticRecipients` (factory.ts) and is applied around the sender in `createAuth` so existing `createEmailSender` instanceof tests keep passing. (3) The provider config captured global `fetch` at construction; resolved per call now. (4) `getUserInfo` returns `null` on failure (error redirect instead of a 500). (5) The profile is parked by Lichess id in `getUserInfo` and consumed by the hook, so no second `/api/account` call.
- Verification: `bun test packages/auth` 199 pass; `bun test` 1045 pass, 1 skip, 0 fail; `pnpm check-types` and `pnpm --filter web check-types` clean; `pnpm check` clean (oxlint then oxfmt; no files outside the slice changed).
- Work Unit Evidence: focused `bun test packages/auth/src/lichess-account.integration.test.ts` 9 pass; runtime harness = real Postgres test DB (`db:test:prepare`) with stubbed Lichess token and account endpoints through the real better-auth handler; rollback boundary = `packages/auth/src/{synthetic-email,lichess-provider,lichess-account}.ts` and tests, `index.ts`, `email/factory.ts(+test)`, `social-providers.ts(+test)`, `apps/server/.env.schema`.
- Size: about 730 authored lines (about 270 production, about 460 tests), over the 400 advisory budget; tests not trimmed. Recommend `size:exception`, or split at S3.7/S3.8 (about 100 lines) from S3.1-S3.6.
- S3.10 [O] done: the sign-in page already renders `SocialSignInButtons` from the server providers list, so the Lichess button needed only `SocialProviderId` widened to `"google" | "lichess"`, a label, a `CrownIcon`, and neutral OAuth error copy (no longer Google-specific). `useSocialSignIn` calls `authClient.signIn.social({ provider })`, which covers `lichess` through the social route. Added a `parseEnabledProviders` test and a `WithLichess` story. Verification: `bun test apps/web/src/features/auth` 53 pass; `bun test` 1046 pass, 1 skip, 0 fail; both `check-types` clean; `pnpm check` clean.
