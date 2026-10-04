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

## S3 split record (auto-chain)

S3 was split into S3a `73a0153` (S3.1 to S3.7, about 692 lines, needs `size:exception` for its PR) and S3b `140d94e` (S3.8 to S3.10). Review follow-ups from the S1b and S2 review landed in `fdc2c75`. better-auth 1.7.5 serves generic-oauth through the social routes (design corrected: `signIn.social({ provider: "lichess" })`, callback `/callback/lichess`).

## S4a (`packages/lichess` client, branch feat/chess-lab-v1-s4a)

- [x] S4a.1 package `@b2c-template/lichess` (package.json, tsconfig, `src/index.ts`, `types.ts`, `config.ts`); registered by the `packages/*` workspace glob, `pnpm install` updated `pnpm-lock.yaml` (+9 lines).
- [x] S4a.2 RED observed: `Cannot find module './ndjson'` (0 pass, 1 error). S4a.3 GREEN: `ndjson.ts`, 8 pass.
- [x] S4a.4 RED observed: `./serial-gate` module missing (0 pass, 1 error). S4a.5 GREEN: `serial-gate.ts` (`acquire`, `run`, `backoff`, `reset`, `waitClear`), 16 pass cumulative.
- [x] S4a.6 RED observed: `./client` module missing (0 pass, 1 error). S4a.7 GREEN: `client.ts` `createLichessClient(deps)`, 36 pass cumulative.
- Design notes: the gate key is a sha256 of the token; `exportGames` holds the gate slot for the whole stream (released in `finally`, also on early `break`). 429: 60 s, 120 s, 240 s sleeps across `MAX_429_RETRIES = 3` retries; the 4th 429 throws `LichessRateLimited` with `retryAt = now + 300 s` and the pause stays on the gate for the user's next request; a clean response resets the doubling. Added `RATE_LIMIT_MAX_PAUSE_MS` (5 min) to config. 401 maps to `LichessUnauthorized`, other non-2xx to `LichessHttpError`, bad record shape or malformed NDJSON to `LichessProtocolError`. `explorer()` is implemented (small, through the same gate, always sends the token) and has two tests; the Phase 2 cache stays out of this package.
- Verification: `bun test packages/lichess` 36 pass; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` clean (oxlint then oxfmt, no files outside the slice changed); `bun test` 1082 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused `bun test packages/lichess` 36 pass; runtime harness = fake `fetch` with a chunked NDJSON ReadableStream plus fake clock and sleep (no real network, per design; no runtime boundary beyond the injected fetch); rollback boundary = `packages/lichess/**` and the `pnpm-lock.yaml` entry.
- Size: about 905 authored lines (about 445 production incl. config/types/index, about 460 tests), over the 400 advisory budget (est. was 350); tests not trimmed. Recommend `size:exception` for PR 6/7 of the chain.

## S4a split (auto-chain)

S4a came in at about 905 authored lines, so it was split at the task boundary: S4a-1 (S4a.1 to S4a.5: package, types, config, NDJSON parser, serial gate) on `feat/chess-lab-v1-s4a`, and S4a-2 (S4a.6, S4a.7: client) on `feat/chess-lab-v1-s4a2`, base S4a-1.

## Review S3 + S4a (base 4c8a2ec to 1c04ff6)

- High risk, 4 lenses, 1810 lines: APPROVED and acknowledged (lineage review-9d6d34228f245b17, authority burned). Next review boundary: 1c04ff6.

## S4b (import service and router, branch feat/chess-lab-v1-s4b, base feat/chess-lab-v1-s4a2)

- Delivery: single PR with user-approved `size:exception` (about 1,000+ authored lines across service, router, server wiring and tests). Base `feat/chess-lab-v1-s4a2`, chain strategy `feature-branch-chain`. No sub-branches.
- [x] S4b.1 `services/import-config.ts` (`IMPORT_WINDOW_MONTHS` 3, `FIRST_IMPORT_MAX_GAMES` 1000, `AUTO_SYNC_AFTER_MS` 6 h, plus `IMPORT_LEASE_MS` 2 min and `IMPORT_BATCH_SIZE` 50).
- [x] S4b.2 RED observed: `Cannot find module './import-service'` (0 pass, 1 error).
- [x] S4b.3 GREEN: `services/import-service.ts` (`createImportService` with `status`, `startSync`, `requestSync`; `shouldAutoSync`; `GamesSource`). First run 18 pass, 2 fail, both faulty test fixtures (a mid-stream failure that never triggered, `replace` instead of `replaceAll` on a PGN); fixed, 20 pass. `@b2c-template/chess` and `@b2c-template/lichess` (type-only) added to `packages/api` deps and tsconfig references; `apps/server` gained `@b2c-template/lichess`.
- [x] S4b.4 RED observed: `lichess.test.ts` 0 pass, 1 error (module missing); GREEN: 8 pass.
- [x] S4b.5 `routers/lichess.ts` (`status`, `sync`), registered in `routers/index.ts` (`privateData` kept); `context.ts` gained `ImportStatus`, `LichessPort`, `lichess` on `Context`. Existing test contexts in `packages/api` got a `lichess` stub.
- [x] S4b.6 `apps/server/src/import-runner.ts` (+ test, 4 pass; one `AbortController` per running import, `stop` aborts all), `lichess-port.ts` (`createGamesSource`, `createLichessPort`), `services.ts` wiring, `context.ts` passes `lichess`; `startBackgroundJobs().stop` aborts imports.
- Design notes and deviations: (1) `GamesSource.exportGames` receives `userId` and has no `token`; the server adapter resolves the token per run (`auth.api.getAccessToken`, selected by `accountId` = Lichess id because better-auth 1.7.5 does not accept `providerId` in the body) and throws `LichessUnauthorized` when none exists. (2) The service never imports Lichess at runtime: errors are classified by `name` (`LichessRateLimited` with `retryAt`, `LichessUnauthorized`); the raw error message is never stored (safe fixed messages). (3) `startSync` returns `{ status, done }` so the runner can fire and forget; `requestSync` awaits it (used by tests). (4) A `running` row whose lease lapsed reads as `idle` in `status` (interrupted, resumable). (5) `failed` is not auto-retried by `lichess.status` (avoids hammering with a rejected token); manual `lichess.sync` retries. (6) After the first import, a user with no cursor resumes from `last_synced_at`. (7) Games that cannot be mapped (invalid PGN, user not a player) are skipped but still advance the cursor. (8) Past the first-import cap, the remainder arrives on later syncs from the cursor.
- Verification: focused `bun test packages/api/src/services/import-service.test.ts packages/api/src/routers/lichess.test.ts` 28 pass; `bun test apps/server` 6 pass; `bun test` 1114 pass, 1 skip, 0 fail; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` clean.
- Work Unit Evidence: focused command above; runtime harness = real Postgres test DB with a fake `GamesSource` that fails mid-stream then resumes (resume test: 2 committed, failure, resume from cursor, 5 total, zero duplicates); rollback boundary = `packages/api/src/services/**`, `routers/lichess*`, `context.ts`, `routers/index.ts`, test context stubs, `apps/server/src/{import-runner,lichess-port,services,context}.ts`, package manifests and lockfile.

## S5a (`packages/study`, branch feat/chess-lab-v1-s5a, base feat/chess-lab-v1-s4b)

- Delivery: single PR, chain `feature-branch-chain` (PR base `feat/chess-lab-v1-s4b`). Over the advisory budget (see Size); user-approved `size:exception` applies; tests not trimmed.
- [x] S5a.1 package `@b2c-template/study` (dep `ts-fsrs` ^5.4.2, resolved 5.4.2), `tsconfig.json`, `src/index.ts`, `src/config.ts` (`DEFAULT_DAILY_NEW_CARDS` 20, `DEFAULT_STUDY_PARAMS` retention 0.9 / max interval 365 / fuzz on, plus `StudyParams` and `MAX_REVIEW_CLOCK_SKEW_MS` 5 min). `pnpm install` updated `pnpm-lock.yaml` (+19 lines).
- [x] S5a.2 RED observed: `Cannot find module './fsrs'` (0 pass, 1 error). S5a.3 GREEN: `fsrs.ts` (`newCardState`, `grade`, `ReviewLogEntry`, `clampReviewedAt`). First run 15 pass, 2 fail, both faulty test premises (Again on a Review card compared against `due` that equals the review time; max-interval test used Easy); fixed to compare against the previous interval and to use Good. 17 pass.
- [x] S5a.4 RED observed: `./day` module missing (0 pass, 1 error). S5a.5 GREEN: `day.ts` `localDayBounds` (binary search on the monotone local calendar day via `Intl.DateTimeFormat`; no hand-rolled offsets), 11 pass. Covers DST spring-forward (23 h), fall-back (25 h), Kolkata +05:30, Kathmandu +05:45, Lord Howe (23.5 h), Santiago DST gap swallowing midnight, unknown zone throws.
- [x] S5a.6 RED observed: `./queue` module missing (0 pass, 1 error). S5a.7 GREEN: `queue.ts` `selectQueue` + `QueueCandidate`; index exports; 14 queue tests; 42 pass cumulative.
- Design notes and deviations: (1) ts-fsrs 5.4 API: `fsrs(generatorParameters({ request_retention, maximum_interval, enable_fuzz })).next(card, now, grade)`; learning steps stay at ts-fsrs defaults (1m, 10m). (2) ts-fsrs keeps Hard < Good < Easy a day apart even past `maximum_interval` (observed Easy at 12 days with a 10-day cap), so `grade` caps `scheduledDays`/`due` to `maximumInterval` itself. (3) `ReviewLogEntry` = `{ grade, reviewedAt, elapsedDays, stateBefore }`; `elapsedMs` from the client is stored by the server layer (S5b), not here. (4) `clampReviewedAt(reviewedAt, lastReview, now)` clamps to `[lastReview, now + 5 min]` (ADR-13); S5b calls it. (5) `selectQueue` expects `due` and `fresh` pre-filtered by the caller (enabled pillars, due today, tz-aware via `localDayBounds`); learning/relearning cards due at or before `now` lead (oldest first); other due cards are round-robin across pillars (sorted by name, each lane oldest first, ties by card id); new cards (round-robin by pillar, capped at `max(0, dailyNewLimit - introducedToday)`) are spread evenly through them (ties: review first); result cut to `limit`. (6) `packages/study` imports only `ts-fsrs`; lint boundaries still pass.
- Verification: `bun test packages/study` 42 pass; `bun test tests/lint-boundaries.test.ts` 22 pass; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` clean (oxlint then oxfmt); `bun test` 1156 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused `bun test packages/study` 42 pass; runtime harness = pure functions with fixed `now`/time zones (no I/O); rollback boundary = `packages/study/**` and the `pnpm-lock.yaml` entry.
- Size: about 650 authored lines (about 270 production, about 330 tests, about 50 package manifest, tsconfig and lockfile), over the 400 advisory budget (est. was 300); tests not trimmed. `size:exception` recorded as user-approved.

## Decision: failed import retry (2026-10-04)

- User decision: an import in `failed` state (for example a rejected token) is retried only through the manual `lichess.sync` ("Sync now"). `lichess.status` does not auto-retry it; 429 backoff still resumes automatically through `import_retry_at`. Matches S4b as implemented in c5be388.
