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
