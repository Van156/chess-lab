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

## Review S4b + S5a (base 1c04ff6 to 4912cb9)

- Medium risk, 1 lens (reliability), 1786 lines: APPROVED and acknowledged (lineage review-b76aeedda75bd8c5, authority burned). Next review boundary: 4912cb9.
- Non-blocking follow-ups (pending):
  - R3-cursor-createdat-skips-late-finishing-games: the cursor is `max(createdAt) + 1`, and Lichess `since` filters by creation time, so a game created before a sync but finished after it (concurrent or correspondence games) is never imported. Needs a decision (exclude correspondence and/or re-fetch a lookback window; the upsert is idempotent).
  - R3-cursor-assumes-ascending-stream: resume is correct only for ascending `createdAt`. The client sends `sort=dateAsc`, so this holds today; document the ordering contract on `GamesSource` and assert it in a test.
  - R3-lease-not-fenced: `commitBatch` and the final state updates filter only by `userId`, not by lease ownership; a stale run past `IMPORT_LEASE_MS` can overwrite a newer run. v1 is single-instance, but fence the writes by lease holder.
  - R3-games-source-untested: add tests for `createGamesSource` / `createLichessPort` (missing token maps to `LichessUnauthorized`; a `getAccessToken` failure should map to unauthorized, not generic).

- Follow-ups done (commit fix(lichess), S5b branch):
  - [x] R3-cursor-createdat-skips-late-finishing-games: `IMPORT_LOOKBACK_MS` (24 h) applied to incremental `since`; export sends `perfType=ultraBullet,bullet,blitz,rapid,classical` plus client-side skip of `speed === "correspondence"`; cursor uses a stored-cursor baseline and `GREATEST`. RED: missing `IMPORT_LOOKBACK_MS` export and client param/skip tests failing; GREEN: service and client tests pass. Spec and design updated.
  - [x] R3-cursor-assumes-ascending-stream: ordering contract documented on `GamesSource`; test pins that an out-of-order stream imports all games and leaves the cursor at newest + 1.
  - [x] R3-lease-not-fenced: the lease timestamp is the fence token (no schema change, no migration); `commitBatch` and the final state updates match on it. RED: stale-run tests failed against unfenced writes; GREEN: real-DB takeover tests (stale commit and stale failure are no-ops).
  - [x] R3-games-source-untested: `apps/server/src/lichess-port.test.ts` added; token resolver errors now map to `LichessUnauthorized` (RED observed, then GREEN).

## S5b (review and settings routers, branch feat/chess-lab-v1-s5b, base feat/chess-lab-v1-s5a)

- Delivery: single PR with user-approved `size:exception` (see Size). Chain `feature-branch-chain`, PR base `feat/chess-lab-v1-s5a`.
- [x] S5b.1 RED observed: `Cannot find module '@b2c-template/study'` then `./review-service` missing (0 pass, 1 error); `card-pillar.test.ts` RED on missing module. Real-DB tests cover replay, serialized concurrent grades (FOR UPDATE), clamping, foreign card NOT_FOUND, queue limits, tz-aware introduced-today and hydration.
- [x] S5b.2 GREEN: `packages/api/src/services/review-service.ts` (`createReviewService` with `getQueue`, `gradeCard`), `settings-service.ts` (`getSettings` lazy upsert, `updateSettings`), `packages/db/src/card-pillar.ts` (`cardPillar`, `cardPillarSql`, `CardPillar`). 23 pass (service + helper) on first GREEN run.
- [x] S5b.3 RED observed: `./review` and `./settings` modules missing (0 pass, 2 errors); GREEN: `review.test.ts` and `settings.test.ts`, 49 pass cumulative with the service tests.
- [x] S5b.4 `routers/review.ts` (`queue`, `grade`), `routers/settings.ts` (`get`, `update`), registered in `routers/index.ts`; `@b2c-template/study` added to `packages/api` deps and tsconfig references (`pnpm-lock.yaml` +3).
- Design notes and deviations: (1) `gradeCard` locks the card `FOR UPDATE` first (scoped by user id), then checks for an existing log by `(id, user_id, card_id)`, then inserts the log `ON CONFLICT DO NOTHING`; this reorders the ADR-13 "insert first" sketch because `state_before/after` are NOT NULL, and still gives idempotency plus per-card serialization. (2) A `reviewLogId` already used by another user or card yields `CONFLICT` without leaking state. (3) Grade result is `{ replayed, card }`; a fresh grade and a replay both go through a JSON round trip so the shape is identical. (4) The stored `reviewed_at` is the clamped time (used for the local-day "introduced today" count); `received_at` keeps server time. (5) Queue due candidates are all non-new cards with `due < end of local day` (overdue included); fresh cards are the oldest `newBudget` by `created_at`. (6) Pillar filter is a service input `enabledPillars` (default `["mistakes"]`); S7 will pass flags. (7) Prompt is `mistake.fen_before`, orientation is `game.user_color`, answers are the best move (`bestSan`, `bestUci`), context is `playedSan`, `gameId`, `evalLossCp`, `ply`. (8) Routers use `context.db` and build the service per call (no new port in `Context`). (9) `review.queue` input is optional (`limit` 1..200, default 50); `review.grade` input: uuid `reviewLogId`, grade 1..4, ISO `reviewedAt`, `elapsedMs` 0..3,600,000.
- Decision gaps (product values chosen here, confirm or change): `daily_new_card_limit` bounds 0..200 (0 pauses new cards); queue limit max 200; `elapsedMs` max one hour (from the design example).
- Known limitation: with several pillars, fresh cards are fetched oldest-first limited to the remaining budget, so one pillar could crowd out the others before round-robin; irrelevant while only Mistakes exists, revisit when Phase 2 adds pillars.
- Verification: focused `bun test` (review-service, review router, settings router) 49 pass; `bun test packages/db/src/card-pillar.test.ts` 3 pass; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` clean; `bun test` 1208 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused command `bun test packages/api/src/services/review-service.test.ts`; runtime harness = real Postgres test DB (replay of one `reviewLogId` yields one log and one card update; four concurrent grades give reps 4); rollback boundary = `review-service.ts`, `settings-service.ts`, `routers/{review,settings}*`, `routers/index.ts`, `packages/db/src/card-pillar*`, `packages/api` manifest and tsconfig.
- Size: about 1,056 authored lines (about 420 production, about 640 tests), over the 400 advisory budget (est. 380); tests not trimmed. `size:exception` user-approved.

## S6 (board wrapper, branch feat/chess-lab-v1-s6, base feat/chess-lab-v1-s5b)

- Delivery: single PR with user-approved `size:exception` (about 630 authored lines, est. 350; about 345 production and about 285 tests). Chain `feature-branch-chain`, PR base `feat/chess-lab-v1-s5b`.
- S0.6 manual 375 px touch check is STILL PENDING (no recorded verdict). Kept react-chessboard v5 (5.12.1) per the current decision; everything library-specific lives in `chess-board-impl.tsx`, so a later swap to cm-chessboard stays local to that file. If the user's check fails, only that file changes.
- [x] S6.1 `board-theme.ts`: `boardTheme` constants and `boardThemeStyle` (`--board-light`, `--board-dark`, `--board-highlight`, `--board-arrow`, plus `--board-last-move`). Values are copied from `midnightBoard` (not imported): the prototype route is deleted in S12 and `shared/` should not depend on it.
- [x] S6.2 `chess-board.tsx` (labelled `role="group"` root, 64-square same-size placeholder until mounted via `useSyncExternalStore`, `React.lazy` of the impl inside `Suspense`), `chess-board-impl.tsx` (react-chessboard v5 `options`: legal-move-only `onMove`, tap-tap, drag, promotion picker, arrows, highlights, last move, blindfold), `board-types.ts` (`BoardProps`, `BoardMove`, `BoardArrow`, `PromotionPiece`). Legality and SAN come from `legalMoves` / `parseMove` of `@b2c-template/chess`; chess.js is not used in the impl.
- [x] S6.3 RED observed: `move-list.test.tsx` 0 pass, 1 error (`Cannot find module './move-list'`); GREEN: 7 pass. `MoveList`: `<ol>` of full moves, `aria-current="step"` on the current ply, buttons (min 44 px) only when `onSelect` is given, `aria-live="polite"` sr-only text "Current move: 1... e5".
- [x] S6.4 RED observed: `san-input.test.tsx` 0 pass, 1 error (`Cannot find module './san-input'`); GREEN: 9 pass. `SanInput` uses the pure `checkMoveText(fen, text)` (SAN or UCI through `parseMove`; illegal, ambiguous, malformed and empty give one error); `aria-live="polite"` error region, `aria-invalid`, `aria-describedby`.
- [x] S6.5 RED observed: `chess-board.test.tsx` 0 pass, 1 error (`Cannot find module './chess-board'`); GREEN: 7 pass after fixing one test premise (see below). Covers placeholder label and 64 same-size squares, no pieces before mount, CSS variables, blindfold (32 pieces vs none, squares stay) through SSR render of the impl, and promotion picker controls at least 44 px (`min-h-11`).
- [x] S6.6 `index.tsx` (exports `ChessBoard`, `MoveList`, `SanInput` and types); `@b2c-template/chess` added to `apps/web` deps (`pnpm-lock.yaml` +3). No Storybook story: `tests/lib/app-story-registry.ts` is an explicit registry, board components are not in it, so `tests/ui-story-coverage.test.ts` does not require one.
- Deviations and notes: (1) Blindfold passes an EMPTY POSITION to react-chessboard instead of empty piece renderers: observed that empty renderers still leave one focusable `role="button"` wrapper per piece (32 stray tab stops); legality keeps using the real `fen`. (2) Dragging is disabled in blindfold and while the promotion picker is open (tap-tap and typed input still work). (3) A promotion drag returns the piece to its square and opens the picker; the move is reported only after a piece is chosen. (4) Arrow-drawing by the user is off (`allowDrawingArrows` false); arrows are consumer-supplied only. (5) `MoveList` `onSelect(ply)` is 1-based ply (position after that many plies), consistent with `currentPly`. (6) The first blindfold test asserted no `data-piece` and failed with renderers (see (1)); fixed by the empty-position approach, not by weakening the test.
- Not verifiable here: real touch behaviour at 375 px (S0.6) and drag-vs-scroll; SSR tests cannot exercise pointer events or the promotion flow interactively.
- Verification: `bun test apps/web/src/shared/components/board` 23 pass; `bun test tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` pass (55 with the board tests); `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` exit 0; `bun test` 1242 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused `bun test apps/web/src/shared/components/board` 23 pass; runtime harness = SSR render of the placeholder and the impl (`renderToStaticMarkup`), plus `pnpm check-types` which builds the web bundle with the lazy chunk; rollback boundary = `apps/web/src/shared/components/board/**`, `apps/web/package.json` and `pnpm-lock.yaml` entries.

## Review S5b + S4b follow-ups + S6 (base f3a998c to 35ac23d)

- Medium risk, 1 lens (reliability), 2051 lines: APPROVED and acknowledged (lineage review-60a97d9bad988a1b, authority burned). Next review boundary: 35ac23d.
- Non-blocking follow-ups (pending):
  - R3-token-resolver-errors-all-map-to-unauthorized (`apps/server/src/lichess-port.ts`): only not-found and refresh-rejected token errors should map to `LichessUnauthorized`; transient errors (DB, network timeout, abort) must be rethrown so the import records a retryable failure. Add tests that separate both kinds.
  - R3-board-selection-survives-position-change (`chess-board-impl.tsx`): reset the selected square and the pending promotion when `fen` changes; add interaction tests for tap-tap, promotion, `onMove` rejection and blindfold click.
  - R3-move-list-out-of-range-ply-label (`move-list.tsx`): clamp or reject an out-of-range `currentPly`; add a test.
  - R3-queue-due-rows-unbounded (`review-service.ts`): bound the due-card query (for example by the requested limit plus learning cards) instead of loading the whole backlog.
- Follow-ups done (server side; the two board items stay pending):
  - R3-token-resolver-errors-all-map-to-unauthorized: DONE. `lichess-port.ts` now maps only a better-auth `APIError` with `body.code` in `ACCOUNT_NOT_FOUND`, `FAILED_TO_GET_ACCESS_TOKEN` (better-auth wraps every failure of the refresh step under it), `REFRESH_TOKEN_NOT_FOUND` (plus the existing null token) to `LichessUnauthorized`; everything else (DB error, abort, unknown `APIError` code) is rethrown unchanged. Codes were read from better-auth 1.7.5 `api/routes/account.mjs`. RED: the new "rethrown unchanged" test failed (the old bare catch threw `LichessUnauthorized`, 6 pass / 1 fail); GREEN: `bun test apps/server/src/lichess-port.test.ts` 7 pass. Caveat: because better-auth wraps refresh-step failures (including a transient DB write) in `FAILED_TO_GET_ACCESS_TOKEN`, a transient failure inside that step still maps to unauthorized; it cannot be told apart from outside.
  - R3-queue-due-rows-unbounded: DONE. `review-service.ts` ranks due cards in SQL (`row_number()` partitioned by pillar and "learning/relearning already due", ordered by due, id) and loads only rank <= `limit`, which is exactly what `selectQueue` can consume. A first, naive bound (top `limit` per pillar by due only) failed the new real-DB test (learning cards due more recently than the review backlog were dropped), so that test guards the semantics. Honest note: the bound itself (rows loaded) is not observable from results, so no test can fail on the missing LIMIT alone; the test, "with more due cards than the limit, the queue still starts with the right cards", asserts the unchanged queue behaviour. Before the change it passed (characterization), with the naive bound it failed, with the final query it passes.
  - Verification: `bun test apps/server packages/api/src/services/review-service.test.ts` 34 pass; `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` clean; `bun test` 1246 pass, 1 skip, 0 fail.
- Follow-ups done (board side):
  - R3-board-selection-survives-position-change: DONE. The tap-to-move state machine moved to the pure `board-selection.ts` (`tap`, `resolveMove`, `selectionFor`); the selection is stamped with its `fen` and `selectionFor` discards it when the position differs (derived, no reset effect). `chess-board-impl.tsx` uses it. apps/web has no DOM test environment (only `renderToStaticMarkup`), so interaction tests target the pure logic in `board-selection.test.ts`: tap-tap move, deselect/reselect, promotion choice and pending-ignores-taps, illegal move rejection, blindfold (selection depends only on the real fen), reset on `fen` change for selection and pending. Not covered without a DOM: the actual library click wiring and the `onMove` returning false path inside the component.
  - R3-move-list-out-of-range-ply-label: DONE. `move-list.tsx` clamps `currentPly` to `[0, moves.length]` (non-finite becomes 0). RED: 2 new tests failed (past-end ply gave "Starting position"; the board test file errored on the missing module); GREEN: `bun test apps/web/src/shared/components/board` 36 pass, 0 fail.
  - Verification: `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` clean; `bun test` 1259 pass, 1 skip, 0 fail.

## S7 (Midnight shell, flags and Today, branch feat/chess-lab-v1-s7, base feat/chess-lab-v1-s6)

### Server part (S7.1 to S7.4)

Mode: standard (strict_tdd false), `[T]` tasks with observed RED before GREEN. Runner `bun test`. Delivery: single-pr slice in the `feature-branch-chain` (PR base `feat/chess-lab-v1-s6`). The web part (S7.5 to S7.8) is done separately.

- [x] S7.1 RED observed: `bun test packages/api/src/features.test.ts` 0 pass, 1 error (`Cannot find module './features'`).
- [x] S7.2 GREEN: `packages/api/src/features.ts` (`PILLAR_FLAGS`, `PillarFlag`, `FeatureFlags`, `parseFeatureFlags`, `enabledCardPillars`); `Context.features`; `featureProcedure(pillar)` in `packages/api/src/index.ts` (protected, then `NOT_FOUND` when off). RED for the procedure: `index.test.ts` errored on the missing `featureProcedure` export; GREEN: features + index 17 pass. Existing test contexts now carry `features: parseFeatureFlags({})`.
- [x] S7.3 RED observed: `GET /features` tests failed with a non-JSON 404 body (2 fail); GREEN: `public-routes.test.ts` 4 pass. `createPublicRoutes(env, features)` serves the flags with `Cache-Control: no-store`. `CHESSLAB_FEATURES` added to `.env.schema` (`@optional @public`), `env.ts` regenerated with `pnpm --filter server env:generate` (gitignored), `services.ts` exports `features = parseFeatureFlags(ENV)`, passed by `context.ts` and `index.ts`.
- [x] S7.4 RED observed: `today.test.ts` 0 pass, 1 error (missing `../services/today-service` and `./today`); GREEN: pure `computeStreak` plus DB-backed router tests (zeros, session scoping, flag-off pillars excluded, new budget, streak in the user time zone, sync status read without triggering a sync, unauthenticated). `today-service.ts` (`createTodayService().getCounts`, `computeStreak`); `review-service.ts` now exports `newCardAllowance` (local day, introduced today, new budget), reused by `getQueue` and Today so both agree; `routers/today.ts` registered as `today` in `routers/index.ts`.
- `review.queue` now passes `enabledPillars: enabledCardPillars(context.features)` (ADR-17: flagged-off pillars leave the queue); new test in `review.test.ts`.

API surface for the web part:

- `GET /api/public/features` (no-store) returns `{ mistakes: boolean, repertoire: boolean, blindfold: boolean, progress: boolean, emailSignUp: boolean }` (`FeatureFlags`, exported from `@b2c-template/api/features`). Default: only `mistakes` true.
- `today.summary` (no input) returns `{ due: { mistakes?: number }, dueTotal: number, newBudgetLeft: number, streak: { days: number, reviewedToday: boolean }, sync: ImportStatus }`, where `ImportStatus = { state: "idle" | "running" | "backoff" | "failed", lastSyncedAt: Date | null, retryAt: Date | null, gamesImported: number }`. `sync.gamesImported === 0` with no `lastSyncedAt` is the "no games yet" onboarding signal; `today.summary` does not enqueue a sync (the Today loader calls `lichess.status`).
- Flag names in `CHESSLAB_FEATURES`: `mistakes`, `repertoire`, `blindfold`, `progress`, `emailSignUp` (comma list, case-insensitive; unset means `mistakes` only; an explicit list replaces the default).

Deviations and notes: (1) `emailSignUp` is a token in the same `CHESSLAB_FEATURES` list (design says it "uses the same mechanism"). (2) `featureProcedure` has no consumer yet (pillar routers arrive in later slices); it is covered by unit tests. (3) `due` counts cards with state != New and due before the end of the user's local day (the same window as the queue).

Verification: focused `bun test packages/api/src/features.test.ts packages/api/src/index.test.ts packages/api/src/routers/today.test.ts apps/server` 44 pass, 0 fail; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` clean; `bun test` 1284 pass, 1 skip, 0 fail.

Work Unit Evidence: focused command above; runtime harness = real Postgres test DB through the router tests (`today.test.ts`, `review.test.ts`) and Hono `routes.request` for the public route; rollback boundary = `packages/api/src/{features,index,context}.ts`, `routers/{today,review,index}.ts`, `services/{today-service,review-service}.ts`, `apps/server/src/{public-routes,services,context,index}.ts`, `.env.schema`.

Workload: the server part alone is about 657 authored lines (630 added, 27 deleted, openspec docs excluded), roughly 55% tests. It stays one cohesive unit (flags, procedure, route, summary share one context change), so it is recorded as `size:exception` (user-approved for S7); the split point named in tasks.md (after S7.6) is not used.

### Web part (S7.5 to S7.7)

Mode: standard (strict_tdd false), `[O]` tasks with ordinary checks; pure helpers and presentational components have `bun test` SSR tests (`renderToStaticMarkup`). Routed to `react-staff`. Delivery unchanged: single-pr slice (`size:exception`, user-approved, recorded here) in the `feature-branch-chain`. S7.8 is a manual check and is not marked.

- [x] S7.5 Midnight tokens ported to the `.dark` scheme in `packages/ui/src/styles/globals.css` (background `#0b1220`, card/popover `#131c2e`, border `#243350`, foreground `#e6edf7`, muted-foreground `#a3b3cb`, primary `#3ee6b0`, primary-foreground `#04231a`; secondary/muted/accent `#1b2740`, input `#2d4066`, sidebar tokens from the prototype). `--radius` is 1rem and the `--radius-sm..4xl` scale in `@theme inline` now derives from it (it was hard-coded 2px to 12px, so the token alone would not have restyled components). Dark is forced in `routes/__root.tsx` (`forcedTheme="dark"`, no system theme) and the theme toggle left the authenticated shell; the Preferences theme card stays until the cleanup slice. Contrast (WCAG relative luminance, computed): muted-foreground on background 8.80:1, on card 8.00:1, on muted 6.99:1; foreground on background 15.89:1, on card 14.45:1; primary-foreground on primary 10.43:1; primary on background 11.72:1. All are above 4.5:1, so the muted token was NOT adjusted (closes Open Question: Contrast). The border on background is 1.48:1 (decorative separator; interactive controls keep their own focus ring in the mint primary, 11.72:1). `pnpm build-storybook` built and `tests/storybook-css.test.ts` ran (not skipped) and passed.
- [x] S7.6 `app/feature-flags.ts` (`readFeatureFlags` strict validation, `fetchFeatureFlags` rejects on any failure, `NO_FEATURES` while loading), `app/use-feature-flags.ts` (query `["public-features"]`, 60 s stale), `NavContext.features` in `app/navigation.ts` plus `pillarEnabled(flag)` predicate, `use-nav-context.ts`, `home-redirect.ts` (`/` goes to `/today`; a session lookup error still defers to the `_auth` guard), `postSignInPath` now `/today`. `FeatureFlags` is imported type-only from `@b2c-template/api/features` (no lint boundary issue; `tsc` and `oxlint` pass). Sidebar group "Chess Lab" lists Today; Dashboard left the sidebar (the `/dashboard` route still exists until the cleanup slice).
- [x] S7.7 `features/today/**`: pure `lib/today-view-model.ts` (`todayMode`, `dueParts`, `streakMessage`, `formatDuration`, `describeSync`), `hooks/use-today.ts` (summary query, `lichess.status` as auto-sync owner polled every 5 s while running or backing off, `lichess.sync` mutation as "Sync now", summary invalidated when a sync leaves `running`, review queue prefetch), presentational `today-view`, `due-card`, `summary-cards`, `sync-status`, `start-review-button` (hover and focus prefetch), container `today-page`, route `routes/_auth/today.tsx` with `staticData: { appShell: true }`. Email sign-up is hidden in `sign-in-page.tsx` unless `emailSignUp` (the "Sign up" switch link; the email sign-in form stays). Four stories added and registered in `tests/lib/app-story-registry.ts`. The engine/board are not imported by Today (lazy-loaded elsewhere).

Decision gaps and deviations: (1) The spec lists Review, Mistakes, Repertoire, Blindfold and Progress in the nav, but their routes do not exist yet and the nav `to` is typed to real routes, so no entries are rendered for them; each slice adds its item with its route (`visible: pillarEnabled(...)` for pillars). Gating is covered by a fixture test. (2) "Start review" renders disabled until the review route exists: `TodayPage` takes an optional `reviewTo`, so S8 passes `"/review"` in `routes/_auth/today.tsx` and the hover and focus prefetch (`review.queue` with `input: {}`) goes live; S8 must keep that query input in sync with the review screen's own query. (3) With nothing due but new-card allowance left, Today still offers Start review (the spec only defines the empty state for nothing due AND no new cards allowed). (4) A direct visit to `/sign-up` still shows the email sign-up form: the spec scenario covers the sign-in page only. (5) `verify-email-page` and impersonation still navigate to `/dashboard`; left for the cleanup slice.

Verification: `bun test apps/web/src/features/today apps/web/src/app tests/storybook-css.test.ts tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 100 pass, 0 fail; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm --filter web build` exit 0; `pnpm check` clean; `bun test` 1329 pass, 0 fail.

Work Unit Evidence: focused commands above; runtime harness = SSR render tests for every Today state plus the production build (manual runtime check is S7.8); rollback boundary = `packages/ui/src/styles/globals.css`, `apps/web/src/app/{feature-flags,use-feature-flags,use-nav-context,navigation,home-redirect}*`, `apps/web/src/features/today/`, `routes/_auth/today.tsx`, sign-in flag wiring, `tests/lib/app-story-registry.ts`.

Workload: the web part is about 1,280 authored lines (additions plus deletions, openspec docs excluded), roughly 55% tests and stories; with the server part (about 657) the slice is about 1,940 lines. Recorded as `size:exception` (user-approved); the S7.6 split point is not used.

## Review S5b/S6 follow-ups + S7 (base 35ac23d to 4ef2777)

- High risk (auth: sign-in form), 4 lenses, 2320 lines: APPROVED and acknowledged (lineage review-21dc445ad0f5ee24, authority burned). Next review boundary: 4ef2777.
- Non-blocking follow-ups (pending):
  - R1-emailsignup-flag-ui-only (WARNING): `emailSignUp` only hides the link; better-auth email sign-up and `/sign-up` still accept registrations. Gate email sign-up server-side in `createAuth` (and the `/sign-up` route) on the flag, or reword the env comment to say it is UI-only. Needs a user decision.
  - R3-today-summary-refresh-missed-transitions (WARNING): `use-today.ts` refetches the summary only on the running -> other edge; transitions running -> backoff -> idle, or a sync that finishes between polls, leave counts stale. Refetch on any change of `lastSyncedAt` / `gamesImported`, and test the invalidation logic.
  - R2-today-now-is-fetch-timestamp (WARNING): `now` in `use-today.ts` is a fetch timestamp; rename (for example `asOf`) or tick a clock so relative times stay live.
  - R3/R4-today-summary-coupled-to-sync-status: settle `lichess.status` separately in `today.summary` so a status failure degrades only the sync field.
  - R4-backoff-polls-at-fixed-5s: derive the poll interval from `retryAt` while in backoff.
  - R2-review-queue-magic-state-numbers: share named card-state constants with `packages/study` instead of `in (1, 3)`.
  - R2-card-pillar-list-duplicated: derive `enabledCardPillars` from the `CardPillar` source of truth.
  - R2-today-router-comment-misnames-caller: the comment mentions a Today loader; the caller is the `useToday` hook.
  - R2-use-today-unused-error: drop the unused `error` or use it to drive the load-error UI.

- Follow-ups done (server side, commit fix(api), S7 branch; the others stay pending):
  - R3/R4-today-summary-coupled-to-sync-status: `today.summary` now settles `lichess.status` separately; output is `{ ...TodayCounts, sync: ImportStatus | null }` (`null` when the status read rejects). RED: new `today.test.ts` case with a rejecting stub failed with the thrown error; GREEN after the change. Web: `SyncStatus` is `NonNullable<TodaySummary["sync"]>`, `todayMode` null-guards, `TodayView` shows "Sync status unavailable" when `sync` is null.
  - R2-review-queue-magic-state-numbers: `CARD_STATE` and `LEARNING_CARD_STATES` exported from `packages/study` (used by `selectQueue`, `review-service.ts`, `today-service.ts`).
  - R2-card-pillar-list-duplicated: `CARD_PILLARS` in `packages/db` card-pillar is the source of truth for `CardPillar`; `enabledCardPillars` derives from it; new test asserts every pillar has a flag.
  - R2-today-router-comment-misnames-caller: comment now names the `useToday` status query.
  - Verification: `bun test packages/api packages/study` 229 pass; `pnpm check-types` and `pnpm --filter web check-types` exit 0; `pnpm check` clean; `bun test` 1331 pass, 0 fail.

- Follow-ups done (web side, `fix(web)` commit, S7 branch; R1-emailsignup-flag-ui-only stays pending for a user decision):
  - R3-today-summary-refresh-missed-transitions: pure `shouldRefreshSummary(prev, next)` in `features/today/lib/sync-schedule.ts`; `useToday` invalidates the summary when a sync leaves running/backoff or `lastSyncedAt`/`gamesImported` change (covers running -> backoff -> idle and "Sync now" returning idle). RED: `bun test` on `sync-schedule.test.ts` failed with "Cannot find module './sync-schedule'"; GREEN after implementation.
  - R2-today-now-is-fetch-timestamp: `useNow()` live clock (30 s tick) in `hooks/use-now.ts`; `useToday().now` is that clock, `TodayView` keeps its injected `now`.
  - R4-backoff-polls-at-fixed-5s: pure `syncPollInterval(sync, now)`: 5 s while running, until retryAt + 2 s bounded to 5-60 s in backoff, `false` otherwise. Tests in the same file.
  - R2-use-today-unused-error: `error` removed from `useToday`; `TodayPage` already drives the load-error UI off missing `data`. Null `sync` falls back to the summary's copy, then to the view's "Sync status unavailable".
  - Verification: `bun test` 1345 pass, 0 fail; `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` exit 0.

## S8 (review session UI, branch feat/chess-lab-v1-s8, base feat/chess-lab-v1-s7)

Mode: standard (strict_tdd false), `[T]` tasks S8.1/S8.2 with observed RED then GREEN; S8.3/S8.4 `[O]` with ordinary checks plus pure-helper and SSR tests. Runner `bun test`. Routed to `react-staff`. Delivery: single PR with user-approved `size:exception` (recorded), chain `feature-branch-chain`, PR base `feat/chess-lab-v1-s7`. S8.5 is a manual check and is not marked.

- [x] S8.1 RED observed: `bun test apps/web/src/features/review` 0 pass, 1 error (`Cannot find module './grade-outbox'`).
- [x] S8.2 GREEN: `lib/grade-outbox.ts` (`createGradeOutbox` with `append`, `pending`, `flush`; `bindFlushTriggers`; `flushWithin`; `backoffDelay`; `isNonRetryableGradeError`) and `config.ts` (`QUEUE_PAGE_SIZE` 50, `QUEUE_PREFETCH_THRESHOLD` 10, plus retry, re-show and sign-out constants). 13 tests passed first run after one faulty test fixture (a `const` used before its declaration), then 16 with `flushWithin`.
- [x] S8.3 `lib/review-queue.ts` (pure reducer: in-memory queue, grade history, paging, optimistic Again re-show through `@b2c-template/study` `grade`, `LEARNING_CARD_STATES`), `hooks/use-review-queue.ts` (`useFirstPage` with `orpc.review.queue.queryOptions({ input: {} })`, the exact key the Today prefetch warms; `useReviewQueue` with the outbox and page fetches), `hooks/use-grade-outbox.ts` (per-user outbox registry, `useGradeOutboxSync` mounted in the `_auth` layout, `flushPendingGrades`). `@b2c-template/study` added to `apps/web` deps (`pnpm-lock.yaml` +3).
- [x] S8.4 `components/review-session.tsx` (presentational, every phase from props), `review-card-view.tsx` (board, `SanInput`, reveal, four grade buttons `min-h-11`), `review-card.tsx` (state, focus and keys 1 to 4), `session-summary.tsx`, `review-page.tsx` (container), `routes/_auth/review.tsx`. `routes/_auth/today.tsx` now passes `reviewTo="/review"` (Start review and its prefetch are live). Review nav item gated by `pillarEnabled("mistakes")`. Three stories added and registered in `tests/lib/app-story-registry.ts`.
- Sign-out: `handleSignOut` gained an optional `beforeSignOut` (best effort, errors swallowed); `UserMenu` takes it as a prop and `AuthenticatedShell` passes `flushPendingGrades` (feature boundary respected: auth never imports review; an earlier attempt importing review inside `UserMenu` broke an unrelated test through `app/orpc` env access, so the wiring moved to the app shell). The flush waits at most 3 s (`SIGN_OUT_FLUSH_TIMEOUT_MS`).

Design notes and deviations:

1. Outbox entries carry `reviewedAt` as an ISO string (JSON storage); the oRPC input transform turns it into a `Date` on the server. Non-retryable codes: `NOT_FOUND`, `BAD_REQUEST` (as specified) plus `CONFLICT` (a `reviewLogId` owned by another user or card; retrying can never succeed). Everything else, including `UNAUTHORIZED` and server errors, is retried with backoff (2 s doubling to 60 s, reset on success). The outbox re-reads storage before each write so a grade appended mid-flush or by another tab is kept; a storage write failure is logged, not thrown (the session continues in memory, documented risk: that grade is not durable).
2. `QueueItem` has no card state beyond `state` and `due`, so the optimistic Again re-show builds a neutral stand-in card for `grade(...)`; only the Learning or Relearning state and due date are used. The Again card re-appears after `RESHOW_GAP` (3) other cards, or at the end of a short queue, only when it is due within `RESHOW_WINDOW_MS` (15 min). The server stays authoritative.
3. Paging: `review.queue` has no offset or cursor, so a later page may repeat cards graded here whose grade has not been applied yet. The reducer skips every card id it has already loaded and asks for `QUEUE_PAGE_SIZE + grades given` cards (capped at the server max 200). A page with nothing new ends paging. A page failure pauses paging until the next grade or the Try again button; grades are never affected.
4. The first page is seeded into the session once; later refetches of the first page are ignored on purpose so a session in progress is never reshuffled. After the first grade the cached queue and `today.summary` are invalidated without refetch (`refetchType: "none"`), so the next visit to Today or Review is fresh.
5. The board is wrapped in a card keyed by card id plus answer count, so each card starts unrevealed. The board component itself is a child of that keyed subtree, so strictly it remounts per card (ADR-14 says only props change). Not changed here: the lazy chunk is already loaded after the first card, and remounting is what guarantees no stale selection or promotion state. Re-check the 200 ms budget in S8.5; if it fails, hoist the board out of the key and rely on the `fen`-derived selection reset added in the S6 follow-ups.
6. Keyboard: on a fine pointer the move field is focused when a card appears; on touch the card itself is focused (no on-screen keyboard). After Show answer, focus moves to Good and keys 1 to 4 grade (ignored inside text fields and with modifiers). Buttons expose `aria-keyshortcuts`.
7. Answer matching ignores check, mate and annotation marks, and only shows whether the attempt matched the best move after the reveal (the spec does not ask for instant feedback).
8. Outbox flush at app start and on `online` / `visibilitychange` is mounted in the `_auth` layout (`useGradeOutboxSync`), so pending grades are sent from any signed-in page, not only the review screen.

Decision gaps (confirm or change): `RESHOW_GAP` 3 and `RESHOW_WINDOW_MS` 15 min; `SIGN_OUT_FLUSH_TIMEOUT_MS` 3 s; retry backoff base 2 s and cap 60 s; treating `CONFLICT` as non-retryable.

Verification: `bun test apps/web/src/features/review apps/web/src/features/today tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 144 pass, 0 fail; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm --filter web build` exit 0; `pnpm check` clean (oxlint then oxfmt); `bun test` 1414 pass, 0 fail.

Work Unit Evidence: focused `bun test apps/web/src/features/review` (outbox with fake storage, queue reducer, answer helpers, SSR of session, card and summary); runtime harness = SSR render tests plus the production build (manual runtime check is S8.5); rollback boundary = `apps/web/src/features/review/`, `routes/_auth/{review,today,route}.tsx`, `app/{navigation,authenticated-shell}*`, `features/auth/{lib/sign-out,components/user-menu}*`, `tests/lib/app-story-registry.ts`, `apps/web/package.json` and lockfile entry.

### Review correction R3-outbox-cross-user-submit-drops-grades

Outboxes lived for the whole tab and submitted with whatever session cookie the browser held, so user A's flush or backoff retry could run under user B and be dropped as NOT_FOUND/CONFLICT. `createGradeOutbox` now takes `isActive` (drain stops, queue intact, when false) and exposes `dispose()` (cancels the pending retry, flushes become no-ops). The hook tracks the active user id, disposes and unregisters the outbox on user change or sign-out, and `flushPendingGrades` flushes only the active user's outbox then disposes it. RED: `bun test apps/web/src/features/review/lib/grade-outbox.test.ts` 16 pass, 2 fail (inactive outbox submitted; `dispose is not a function`). GREEN: same file 18 pass, `bun test apps/web/src/features/review` 68 pass; `pnpm --filter web check-types`, `pnpm check-types`, `pnpm check` exit 0; `bun test` 1416 pass, 0 fail.

## Review S7 follow-ups + S8 (base 4ef2777 to 90c7e9b)

- High risk (auth: user menu sign-out), 4 lenses, 2254 lines. One CRITICAL finding (R3-outbox-cross-user-submit-drops-grades) required a bounded correction: 90c7e9b (99 lines, plan 120, budget 200). Targeted validation passed; APPROVED and acknowledged (lineage review-55b495e3e3c1d09b, authority burned). Next review boundary: 90c7e9b.
- R1-outbox-survives-account-switch and R4-outbox-cross-user-drop-after-signout describe the same pre-correction defect; 90c7e9b addresses them (inactive outboxes never submit, dispose on user change, sign-out flushes only the active user).
- Non-blocking follow-ups (pending):
  - R3-outbox-remove-write-failure-resubmit-loop (WARNING): `remove()` ignores a failed write, so `drain` resubmits the same head forever; stop draining (or keep an in-memory skip set) when the write fails.
  - R4-outbox-append-write-failure-loses-grade (WARNING): when `append` cannot persist, the grade is never submitted; submit it directly (in-memory fallback) and surface a warning.
  - R2-reviewcard-key-comment-misleading (WARNING): the comment in `review-session.tsx` says the board stays mounted; it remounts per card. Fix the comment, or hoist the board out of the keyed subtree (also helps the 200 ms budget).
  - R4-outbox-head-of-line-blocking: one deterministic retryable failure blocks every later grade; cap attempts per entry or move it aside and surface it.
  - R2-review-config-duplicated-server-caps: share `QUEUE_MAX_PAGE_SIZE` and `MAX_ELAPSED_MS` with the server router limits.
  - R2-review-queue-magic-new-state: use `CARD_STATE` in `review-queue.ts` and `STATE_LABEL`.
  - R3-session-wiring-untested: no tests for `use-review-queue` glue and the 1..4 key handling (no DOM env).

### Follow-ups done (post-S8 review, react-staff)

- R3-outbox-remove-write-failure-resubmit-loop: `remove()` now records the id in an in-memory `acknowledged` set when the write fails; `readStored()` filters it out, so `drain` never resubmits it. RED: `grade-outbox.test.ts` hung (infinite microtask resubmit loop, killed). GREEN: 23 pass.
- R4-outbox-append-write-failure-loses-grade: `append` keeps an entry that cannot be persisted in an in-memory `unpersisted` list that `read()` (and so `pending` and `drain`) includes; it is logged as memory-only. RED: new test failed (grade never submitted). GREEN: same file.
- R4-outbox-head-of-line-blocking: server failures that carry an error code (except `UNAUTHORIZED`) count per grade; at `OUTBOX_MAX_ATTEMPTS` (5, config) the grade is set aside for the rest of the session (stays in storage and `pending`, retried next session) and logged, so later grades flow. Network errors and `UNAUTHORIZED` never count. RED: 2 fail (later grade never sent; counted 8 vs 7 calls, test-loop fix then GREEN). GREEN: 23 pass.
- R2-reviewcard-key-comment-misleading: hoisted. `ReviewCard` is no longer keyed; it takes `turnKey` (card id plus answers given), resets attempt and reveal during render and re-runs the focus effect on it. `ChessBoard` stays mounted and only receives props (ADR-14; S6 `fen`-derived selection reset applies). `SanInput` is unmounted while the answer is shown, so it starts empty each card. Comment fixed; design note 5 above is superseded. S8.5 manual 200 ms check still applies.
- R2-review-config-duplicated-server-caps: `QUEUE_MAX_PAGE_SIZE` and `MAX_ELAPSED_MS` now live in `packages/study/src/config.ts` (exported from the index); the `review` router and `review-queue.ts` import them; removed from the web config.
- R2-review-queue-magic-new-state: `review-queue.ts` and `STATE_LABEL` use `CARD_STATE`.
- Still pending: R3-session-wiring-untested (needs a DOM env, not approved).
- Verification: `bun test apps/web/src/features/review packages/api/src/routers/review.test.ts packages/study` 132 pass, 0 fail; `pnpm check-types`, `pnpm --filter web check-types`, `pnpm --filter web build`, `pnpm check` exit 0; `bun test` 1421 pass, 0 fail (one earlier full run had 3 import-service timeouts under load, which passed in isolation 3 times and on the rerun; unrelated).

## S9a (engine runtime and licence page, branch feat/chess-lab-v1-s9a, base feat/chess-lab-v1-s8)

Mode: standard (strict_tdd false), `[T]` tasks S9a.1 to S9a.3 with observed RED then GREEN; S9a.4/S9a.5 `[O]` with ordinary checks plus transport-injected and SSR tests. Runner `bun test`. Routed to `react-staff`. Delivery: single PR with user-approved `size:exception` (recorded; about 1,370 authored lines, tests included, against the 350 estimate), chain `feature-branch-chain`, PR base `feat/chess-lab-v1-s8`. S9a.6 needs a browser and is not marked.

- [x] S9a.1 RED observed: `bun test apps/web/src/features/engine/lib/uci.test.ts` 0 pass, 1 error (`Cannot find module './uci'`).
- [x] S9a.2 GREEN: `lib/uci.ts` (pure parser `parseUciLine` for `info depth/score cp|mate/pv/multipv`, `bestmove` incl. `(none)`, spin `option`, `uciok`, `readyok`; builders `buildGo`, `buildSetOption`, `buildPosition`, `buildStrengthOptions`; `clampElo`). 21 pass on first run.
- [x] S9a.3 RED observed: `engine-queue.test.ts` 0 pass, 1 error (`Cannot find module './engine-queue'`). GREEN: `lib/engine-queue.ts` (`createEngineQueue(transport)`, `submit` returns `{ result, cancel }`, `fail`, `EngineJobCancelledError`, `EngineUnavailableError`); 12 pass, then 13 with the cancel-while-pre-empted test added after fixing a real gap (a cancel arriving during a pre-emption stop used to be lost and requeue the job).
- [x] S9a.4 `config.ts` (`SCREEN_DEPTH` 10, `CONFIRM_DEPTH` 18, `SUBMIT_EVERY_PLIES` 10, `ENGINE_ID` `stockfish-19-lite-single`, served paths, upstream URL, `Hash` 16, `Threads` 1, handshake timeout 30 s), `lib/engine-client.ts` (`createEngineClient({ createTransport })`: lazy session, `uci` then `Hash 16`, `Threads 1`, `isready`, reads the `UCI_Elo` range, every failure becomes `EngineUnavailableError` and is not cached so the next call restarts the worker; `createWorkerTransport` wraps a real `Worker`, the only browser-only code), `index.ts` (public API plus a shared lazy `engine`). Unrequested but added: `engine-client.test.ts` (8 tests with a fake transport: lazy creation, handshake order, reuse, load failure, handshake timeout, crash mid-job, retry, cancel before ready). `ENGINE_STRENGTH_LEVELS` and `ENGINE_DRILL_MOVETIME_MS` left for Phase 3 as the task allows; the queue already accepts `strength` (`{ elo }` or `{ skill }`).
- [x] S9a.5 `routes/licenses.tsx` (public, outside `_auth`, no shell), `features/engine/components/licenses-page.tsx` (presentational, props-free; GPL-3.0 summary, link to the licence, "separate unmodified file" statement, upstream source URL, direct links to the three served files; link to the full text is the served `Copying.txt`, per the task's allowed alternative), story and SSR test, registry entry in `tests/lib/app-story-registry.ts`. Footer link: `AuthenticatedShell` sidebar footer shows a "Licences" link above the user menu (hidden when the sidebar is icon-collapsed).
- [ ] S9a.6 NOT marked (needs a browser). Evidence gathered without one, after `pnpm --filter web build`:
  - Engine absent from the main bundle: `grep -lE "stockfish|Stockfish"` over `dist/assets/*.js`, `dist/sw.js`, `dist/workbox-*.js`, `dist/index.html` matches only `dist/assets/licenses-*.js` (7.1 kB, the licence page text and path strings); `index-*.js` has no `WebAssembly` and no stockfish string. The 21 kB worker script and the 1.8 MB wasm exist only as `dist/engine/*`.
  - Service worker: precache is 97 entries (1735.92 KiB); `dist/sw.js` has no `stockfish`, no `.wasm` and no `engine/` precache entry; its only `/engine/` match is the CacheFirst runtime route.
  - Still to verify by hand in a browser: `/licenses` renders and the three links download; no `/engine/*` request on page load; the worker is requested on the first `engine.analyse(...)` call (S9b wires the first caller; until then use the console: import `engine` from the feature in a dev build, or wait for S9b.5).

Design notes and deviations:

1. Queue contract: a pre-empted background job is requeued at the front of the background lane and restarts from scratch (a cancel during the stop wins over the requeue). The next job is sent only after the stopped search reports `bestmove`, as UCI requires. Secondary `multipv` lines are ignored for the result.
2. Strength is a job property: no `strength` means analysis, which always sends `UCI_LimitStrength false` and `Skill Level 20` before `position`/`go`, so a drill can never weaken analysis (ADR-11). Elo clamping is the caller's job through `clampElo(range, elo)` with the range from `client.eloRange()`.
3. The `/licenses` page is standalone (no header or shell), since `PublicShell` is not mounted by any route today. It links back to `/`.
4. `ENGINE_SOURCE_URL` is the repository named in the S0.8 notes (https://github.com/nmrugg/stockfish.js); the page does not link a tag or commit for 19.0.0 because S0.8 did not record one.
5. `lint`: `no-useless-spread` rejected `[...listeners]`; the fake transports iterate the `Set` directly (deletion during iteration is safe).

Decision gaps (confirm or change): handshake timeout 30 s; "Licences" footer text and its hiding when the sidebar is icon-collapsed; whether the analysis status UI link (ADR-11 also lists it) lands in S9b; the GPL-3.0 full text is linked (served `Copying.txt`) rather than inlined.

Verification: `bun test apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 77 pass, 0 fail; `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm --filter web build` exit 0; `pnpm check` exit 0 (oxlint then oxfmt, nothing left to commit); `bun test` 1467 pass, 0 fail.

Work Unit Evidence: focused `bun test apps/web/src/features/engine` (parser, builders, queue with fake transport, client handshake/failure paths, SSR of the licence page); runtime harness = production build plus bundle and precache inspection above (browser check is S9a.6); rollback boundary = `apps/web/src/features/engine/`, `apps/web/src/routes/licenses.tsx`, the footer link in `apps/web/src/app/authenticated-shell.tsx`, the registry line in `tests/lib/app-story-registry.ts`.

## Review S8 follow-ups + S9a (base 90c7e9b to 0bace40)

- Medium risk, 1 lens (reliability), 1685 lines: APPROVED and acknowledged. Next review boundary: 0bace40.
- Non-blocking follow-ups (pending):
  - R3-engine-queue-no-search-watchdog (WARNING): only the handshake has a timeout; a stalled worker or a lost `bestmove` blocks every later job and every cancel. Add a per-job watchdog (for example depth/movetime-derived) that terminates and restarts the worker and rejects the job with `EngineUnavailableError`; test with a silent fake transport.
  - R3-reviewcard-turnkey-reset-untested (WARNING): no test pins the render-time reset on `turnKey` (next card, and the same card after Again). Extract the reset into a pure helper and test it.
  - R3-outbox-attempts-not-consecutive: reset the per-grade attempt count on a transient failure, or fix the comment; add a test.
- Follow-ups done (fix on feat/chess-lab-v1-s9a, one commit after 7c591df):
  - R3-engine-queue-no-search-watchdog: DONE. `createEngineQueue(transport, options)` arms a per-job watchdog (`searchTimeoutMs(limit)` = slack 10 s + depth x 3 s or movetime, ceiling 120 s; `ENGINE_SEARCH_BUDGET` in `config.ts`) and a bounded wait after `stop` (`ENGINE_STOP_TIMEOUT_MS` 5 s, also for pre-emption). On expiry the queue fails itself (running and queued jobs reject with `EngineUnavailableError`) and calls `onStall`; the client terminates the worker and drops the session, so the next call starts a fresh worker. Timers are injected (`setTimer`/`clearTimer`). RED: `engine-queue.test.ts` 0 pass, 1 error (missing `searchTimeoutMs` export). GREEN: queue watchdog suite (silent job, in-time job, fresh watchdog per job, cancel during silent search, cancel answered in time, silent pre-emption, later submissions, budget maths) plus a client test (silent search, worker terminated, next call creates a second transport and succeeds). Deviation: a cancel that hits the stop timeout rejects with `EngineUnavailableError`, not `EngineJobCancelledError`, since the worker is gone.
  - R3-reviewcard-turnkey-reset-untested: DONE. Pure `lib/card-turn.ts` (`initialCardTurn`, `nextCardTurnState`), used by `ReviewCard` (one `turn` state replaces three). Tests: next card clears, same card after Again (same id, larger done count) clears, same key keeps the same object. RED not observed separately: test and helper were written in the same step (GREEN first run, 4 pass).
  - R3-outbox-attempts-not-consecutive: DONE. A transient failure (network or UNAUTHORIZED) now deletes the grade's attempt count, so the cap counts consecutive server failures. RED: new test failed (grade was set aside after the cap despite an intervening network failure). GREEN: 78 pass in `features/review`.

## S9b API part (analysis pipeline, branch feat/chess-lab-v1-s9b, base feat/chess-lab-v1-s9a)

Mode: standard (strict_tdd false), runner `bun test` against the test database on :5437.

- [x] S9b.1 to S9b.4: `services/analysis-config.ts` (input schemas and bounds), `services/analysis-service.ts` (`next`, `submitEvals` merge by ply keeping the deeper eval, `complete` in one transaction with mistakes upserted `ON CONFLICT (game_id, ply)` and one New card per carded mistake, `repeatMistakes`), `routers/analysis.ts` behind `featureProcedure("mistakes")`, registered in `routers/index.ts`. RED for these tasks was written in an interrupted earlier session and is not re-observed here (recorded honestly).
- Resume fix: the test "keeps stored evals where the incoming entry is null" asserted `toMatchObject([{ cp: 30 }, null])` against a fully screened 28-entry array, which can never match. The implementation was correct; the test now compares against the evals stored before the null batch.

Verification: `bun test packages/api` 225 pass, 0 fail; `pnpm check-types` exit 0; `pnpm check` exit 0.

Next: S9b.5 (`use-game-analysis`) and S9b.6 (analysis status UI), routed to `react-staff`.

## S9b React part (S9b.5, S9b.6), routed to react-staff

- [x] S9b.5 `features/engine/hooks/use-game-analysis.ts` (thin hook) over pure, fake-tested modules: `lib/analysis-plan.ts` (FENs, screen indices from `next_ply`, confirm indices around the user's inaccuracy-or-worse moves skipping depth-18 positions, batching), `lib/analysis-run.ts` (screen at 10, submit every `SUBMIT_EVERY_PLIES` and at phase end, confirm at 18, `complete`, next game), `lib/pause-gate.ts` (closing cancels the running search; the position is redone on reopen). Flush on `visibilitychange` (hidden) and `pagehide`; stop after `PAUSE_HIDDEN_MS` hidden; invalidates review queue and Today summary after each completed game. Shared engine moved to `lib/shared-engine.ts` to avoid an import cycle.
- [x] S9b.6 `components/analysis-status-view.tsx` (presentational: live-region message, progress, Resume, "Engine licence" link), `components/analysis-status.tsx` (container), 7 stories, registry entry. Not mounted: mounting is left to S10 (mounting would auto-start analysis).

Decision gaps: `PAUSE_HIDDEN_MS` = 5 min (design gives no value); analysis auto-starts on mount; review-open detection is route-based (`/review`); flush on `pagehide` is best effort (server `next_ply` recovers lost work); the hook itself is untested (no DOM env), so browser behaviour rests on the S9b manual check.

Size: about 1,220 authored lines for the React part (about 520 tests), plus 938 for the API part (8c91c0e), against the 400 estimate.

Verification: `bun test apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 127 pass, 0 fail (re-run by the parent); `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` exit 0. Manual dev-server check (import a game, run analysis, mistakes and cards appear) pending until S10 mounts the UI.

Delivery (user decision 2026-10-06): S9b ships as two PRs in the `feature-branch-chain`, split at the planned point after the API part.

- PR 14 `feat/chess-lab-v1-s9b` (base `feat/chess-lab-v1-s9a`): 8c91c0e, API part S9b.1 to S9b.4.
- PR 14b `feat/chess-lab-v1-s9b2` (base `feat/chess-lab-v1-s9b`): React part S9b.5, S9b.6. S10 now bases on `feat/chess-lab-v1-s9b2`.

## S10 (games and mistakes UI, branch feat/chess-lab-v1-s10, base feat/chess-lab-v1-s9b2)

Mode: standard (strict_tdd false), runner `bun test` (test DB on :5437).

- [x] S10.1 RED observed: `games.test.ts` and `mistakes.test.ts` 0 pass, 2 fail, 2 errors (`Cannot find module './games'`, `./mistakes`). GREEN: `routers/games.ts` (`list` keyset by `(playedAt desc, id desc)` with derived `analysisStatus`, `pending` when no analysis row; `get` with PGN, time control, `nextPly`) on `protectedProcedure` (game import is core, no pillar flag); `routers/mistakes.ts` (`list` by `(game.playedAt, gameId, ply)` desc, optional `gameId`; `get` with game summary and PGN) on `featureProcedure("mistakes")`; `services/cursor.ts` (opaque base64url keyset cursor, bad cursor is BAD_REQUEST). Session user id is in every WHERE clause; foreign ids are NOT_FOUND.
- Deviations: `pagination.ts` has only page/offset helpers, so keyset cursors got their own helper (reusing `clampLimit`, `MAX_PAGE_SIZE`). Mistake ordering uses the game's `playedAt` instead of `mistake.createdAt` (microsecond precision would break a JS Date cursor). Sync status reuses S4b `lichess.status` and `lichess.sync`; no new procedure.

Verification: `bun test packages/api` 244 pass, 0 fail, 0 skipped; `pnpm check-types` exit 0; `pnpm check` exit 0. Parent re-run: games and mistakes tests 19 pass.

- [x] S10.2 `features/games/**` (infinite `games.list` with Load more, analysis status as text, sync status reusing Today's `SyncStatus` with Sync now, polling and backoff/failure message), `routes/_auth/games.tsx`. Routed to `react-staff`.
- [x] S10.3 `features/mistakes/**` (list filtered by optional `gameId`; detail with board before the mistake, played (red) and best (green) arrows plus a text alternative, evals from the user's side, `MoveList` from the PGN, Lichess game link and "More mistakes from this game"), `routes/_auth/mistakes/{route,index,$id}.tsx` with `beforeLoad` `requireFeature(queryClient, "mistakes")` (redirects to `/today`, fails closed). Routed to `react-staff`.
- Mounting: `app/background-analysis.tsx` renders `AnalysisStatus` when the `mistakes` flag is on, once on Today and once on Games (sibling routes, so one run at a time; the old route's cleanup stops its run). Plumbing: `app/require-feature.ts`, `isFeatureEnabled`, shared `featureFlagsQueryOptions`, nav items (Games always, Mistakes behind the flag), `shared/testing/render-with-router.tsx` for SSR tests with real `Link` hrefs, analysis invalidates `games.list` and `mistakes.list` after each game.
- S10.2 and S10.3 are committed together: they share the plumbing, nav and registry hunks, and the Games "View mistakes" link only type-checks once the mistakes routes exist.

Decision gaps: no in-app game page (mistake detail links to Lichess); the sync failure message is generic because the status payload has no failure reason (the spec's "token revoked" wording needs a server field); analysis now starts from Today when games are pending; dates in UTC `YYYY-MM-DD`; the `_auth/review` route has no flag guard (out of scope).

Size: about 1,640 authored lines for S10.2 and S10.3 (mostly tests and stories) plus about 620 for S10.1.

Verification: `bun test apps/web/src/features tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 442 pass; `bun test apps/web/src/app` 38 pass (parent re-run of both: 480 pass, 0 fail); `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` exit 0. S10.4 (keyboard-only, 375 px) is manual and not marked.

## Review S9a follow-ups + S9b + S10 (base 0bace40 to 82a9151)

The whole group (82 files, about 4,900 lines) stopped with `lens_context_budget_exceeded` before any authority was created, so it was reviewed one slice at a time (standing user consent granted each time). All five were APPROVED and acknowledged; no correction opened. Next review boundary: 82a9151.

| Slice                  | Range            | Risk / lenses                                     | Lines |
| ---------------------- | ---------------- | ------------------------------------------------- | ----- |
| S9a follow-ups         | 0bace40..f15b883 | medium / reliability                              | 386   |
| S9b API                | f15b883..8c91c0e | medium / reliability                              | 942   |
| S9b React + split note | 8c91c0e..f4e5994 | medium / reliability                              | 1244  |
| S10.1 API              | f4e5994..df50591 | medium / reliability                              | 635   |
| S10.2, S10.3 web       | df50591..82a9151 | high / risk, resilience, readability, reliability | 1679  |

Non-blocking follow-ups (pending):

- Engine/review (S9a follow-ups): R3-search-watchdog-is-total-budget-not-silence (WARNING: the watchdog caps total search time, it does not detect silence; either re-arm on `info` or fix the comments and pin it with a test); R3-reviewcard-non-functional-turn-update (use a functional `setTurn` updater).
- Analysis service: R3-complete-rollback-unproved (WARNING, deterministic: the rollback test fails before any insert); R3-nextply-skips-gaps (WARNING: a screen batch past the resume point or all nulls can advance `nextPly` over unevaluated plies); R3-unreadable-submit-not-failed (WARNING: an unreadable PGN on submit never marks the game failed, so `next` can stall on it); R3-failed-status-revived (a submit revives a failed game).
- Analysis run: R3-vacuous-failed-submit-assertion (WARNING: asserts on an unused harness); R3-flush-failure-poisons-run (WARNING: a failed best-effort flush rejects the shared send queue and ends the run as failed); R3-hook-browser-behaviour-unproved.
- Games/mistakes API: R3-cursor-value-validation (WARNING: a well-formed cursor with a bad timestamp gives a 500, a fractional ply is rounded); R3-cursor-test-gap.
- Games/mistakes web: R3/R4 sync-mutation error silent (WARNING); R4-load-more-error-silent (WARNING); R3-mistake-notfound-retry / R4-not-found-retried (WARNING: NOT_FOUND is retried 3 times before "not found" shows); R4-guard-latency-on-flag-outage (WARNING: `requireFeature` waits for flag retries before redirecting); R3-async-describe (WARNING: an async `describe` in `mistake-detail-view.test.tsx`); R2-001 (WARNING, `BEST_ARROW_NAME`); R3-requirefeature-untested; R4-infinite-refetch-fanout; R2-002 to R2-005 (duplicated date and side-label helpers, nested page container, inconsistent fixture).

Delivery (user decision 2026-10-06): S10 ships as two PRs in the `feature-branch-chain`.

- PR 15 `feat/chess-lab-v1-s10` (base `feat/chess-lab-v1-s9b2`): df50591, S10.1 API.
- PR 15b `feat/chess-lab-v1-s10b` (base `feat/chess-lab-v1-s10`): 82a9151 S10.2 and S10.3 web, plus the review docs. Later slices base on `feat/chess-lab-v1-s10b`.

## Review follow-ups, API part (on feat/chess-lab-v1-s10b)

- R3-complete-rollback-unproved: DONE. The all-or-nothing test now fails the final status update inside the transaction, after every mistake and card write, and asserts 0 mistakes, 0 cards, status unchanged. It passed on first run (the code already rolled back); it is meaningful because the failure can only happen after the writes.
- R3-nextply-skips-gaps: DONE. A screen batch with `fromPly` past the stored `nextPly` is BAD_REQUEST (nothing stored); `nextPly` advances only through the batch's contiguous non-null prefix. A terminal null (mate or stalemate at the last position) still lets the game complete because `complete` needs `nextPly >= plies`. RED observed for past-resume-point, all-null and mid-batch null.
- R3-unreadable-submit-not-failed: DONE. An unreadable PGN on submit marks the game `failed` (committed outside the rolled-back transaction, shared `markFailed` helper) and then throws BAD_REQUEST; `next` no longer returns it. RED observed.
- R3-failed-status-revived: DONE. `submitEvals` to a failed game is CONFLICT. RED observed.
- R3-cursor-value-validation and R3-cursor-test-gap: DONE. `decodeCursor(cursor, schema)` validates a zod tuple per router (ISO timestamp that parses, non-empty id, integer ply >= 0) and throws BAD_REQUEST before SQL. RED: 7 of the new cursor tests failed on the old code (wrong arity and wrong types were already rejected). Added a mistakes paging test whose boundary falls inside one game.

Verification: `bun test packages/api` 263 pass, 0 fail, 0 skip (one earlier run hit a 5 s timeout in the unrelated import-service cap test; it passed on two reruns); `pnpm check-types` exit 0; `pnpm check` exit 0. Parent re-run: analysis service and routers 148 pass.

## Review follow-ups, web part (on feat/chess-lab-v1-s10b), routed to react-staff

- R3-search-watchdog-is-total-budget-not-silence: DONE (parent decision: silence watchdog). Every engine output line re-arms the per-job timer; `ENGINE_SEARCH_SILENCE_MS` 30 s replaces the depth-derived budget; the stop wait is unchanged and output during a stop does not extend it. RED: the new long-reporting-job tests never settled on the old queue.
- R3-reviewcard-non-functional-turn-update: DONE. Functional `setTurn` updaters via `recordAttempt` and `revealAnswer` in `lib/card-turn.ts` (pure tests).
- R3-vacuous-failed-submit-assertion: DONE. The test asserts on the failing run's own `complete` calls.
- R3-flush-failure-poisons-run: DONE. `flush` sends a copy of the pending batch, waits behind queued sends, swallows its own failure and leaves the batch and send queue untouched, so `fromPly` stays contiguous (the server now rejects batches past `nextPly`); the overlap resend is idempotent. RED: the run ended "failed" instead of "finished".
- R3-hook-browser-behaviour-unproved: DONE. `lib/hidden-tab-policy.ts` with injected timers, 5 tests.
- Sync now error (R3/R4): DONE. `syncFailed` plus `withSyncRequestError` show a retryable message in the existing status line; status refetched on error.
- R4-load-more-error-silent: DONE. Shared `shared/components/feedback/load-more.tsx` (alert plus Try again) used by Games and Mistakes, with stories and tests.
- NOT_FOUND retry (R3/R4): DONE. `shouldRetryMistake` skips NOT_FOUND.
- R4-guard-latency-on-flag-outage and R3-requirefeature-untested: DONE. The guard calls `ensureQueryData` with `retry: false`; 4 tests (on, off, load error redirects fast, cached). RED: 3 of 4 failed on the old code.
- R3-async-describe: DONE (render in `beforeAll`).
- R2-001: DONE. `BEST_ARROW_COLOR` comes from the board theme; the legend uses the same constant; a test pins colour and name pairs.
- R2-002 to R2-005: DONE. `shared/lib/game-display.ts` (`formatUtcDate`, `sideLabel`); one owner of page width (route); fixture PGN result consistent.
- R4-infinite-refetch-fanout: DONE. `listRefetchType` marks deeply paged lists (more than 2 pages) stale instead of refetching every page.

Decision gaps: `ENGINE_SEARCH_SILENCE_MS` 30 s and `LIVE_REFRESH_MAX_PAGES` 2 are tunable choices; the sync-triggered `games.list` invalidation has no page guard yet; the global query error toast still fires alongside the new inline alerts.

Verification: `bun test apps/web tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 907 pass, 0 fail (parent re-run 907 pass); `pnpm check-types` exit 0; `pnpm --filter web check-types` exit 0; `pnpm check` exit 0.

## Review follow-up fixes (base 82a9151 to 719ff10)

- Medium risk, 1 lens (reliability), 1267 lines: APPROVED and acknowledged. Next review boundary: 719ff10.
- R3-flush-reads-gameid-after-await (WARNING): DONE inline in the next commit; `flush` captures the game id and a copy of the evals before awaiting.
- Pending, non-blocking:
  - R3-mid-batch-null-can-stall-run (WARNING): an engine null for a NON-terminal position would stop the server resume point and make later batches BAD_REQUEST. This is accepted for now, because a position with legal moves always gets a score. Fix it if it shows up, by having the client restart a batch at the server's `nextPly`, or by submitting a non-terminal null as a hard failure.
  - R3-sync-error-sticky: the Sync now error persists after a later successful background sync.
  - R3-refresh-paged-list-unproved: `refreshPagedList` cache-shape wiring is untested.

## S11a (export, branch feat/chess-lab-v1-s11a, base feat/chess-lab-v1-s10b)

Mode: standard (strict_tdd false), runner `bun test` (test DB on :5437).

- [x] S11a.1, S11a.2 RED: `export-service.test.ts` 0 pass, 1 fail, 1 error (`Cannot find module './export-service'`). S11a.3 GREEN: `services/export-service.ts` (async generators `exportUserJson`, `exportUserPgn`; keyset pages of `EXPORT_PAGE_SIZE` 500 scoped by user id; one valid JSON document, also when empty). Sections: `user` (explicit columns, plus `lichessUsername`), `settings`, `lichessProfile` (runner state `importLeaseUntil`, `importRetryAt`, `importState`, `importError` dropped), `games`, `analyses`, `mistakes`, `cards`, `reviewLogs`. Tests: every section, planted secrets absent, empty account, 1201 games over several chunks, only the caller's rows, PGN of 1001 games separated by single blank lines. Meta-test enumerates every drizzle table with a `user_id` column; each must be an export section or in `EXCLUDED_TABLES` with a reason (`account`: tokens and password hash; `session`: session tokens, IP, user agent). GREEN 6/6.
- [x] S11a.4 RED: `Cannot find module './export-routes'`. GREEN: `apps/server/src/export-routes.ts` (`createExportRoutes` with injected deps; `/data.json`, `/games.pgn`; 401 without session; `Cache-Control: no-store` also on 401; `Content-Disposition: attachment`; streamed with `hono/streaming`), 4 tests; mounted at `/api/export` in `apps/server/src/index.ts`.
- Parent addition: an impersonated session (`session.impersonatedBy`) gets 401 on export, matching the deletion rule (untested wiring in `index.ts`).

Decision gaps: "lease fields" interpreted as all import runner state; `audit_log` (keyed by `actor_user_id`) is not exported; a mid-stream DB error truncates the download with no logging.

Verification: `bun test packages/api apps/server` 288 pass, 0 fail, 0 skip; `pnpm check-types` exit 0; `pnpm check` exit 0. Parent re-run: export tests 10 pass; types and check after the impersonation change exit 0.

- [x] S11a.5 `features/data-control/**`: pure `buildExportUrls(serverUrl)` (tested), presentational `DataExportCard` ("Your data", plain anchors "Download all your data (JSON)" and "Download your games (PGN)" to the server origin `VITE_SERVER_URL`, no `download` attribute since it is ignored cross-origin and the server sends `Content-Disposition: attachment`), story, SSR test, registry entry. Mounted on the danger page above deletion (the account area has no cheap section mechanism). Routed to `react-staff`. Not checked against a running server (cookie on top-level navigation).
      Verification: `bun test apps/web tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 912 pass; parent re-run: `pnpm check-types` exit 0, `pnpm --filter web check-types` exit 0, data-control and story coverage 15 pass; `pnpm check` exit 0.
