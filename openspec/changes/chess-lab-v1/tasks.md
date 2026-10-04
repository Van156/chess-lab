# Tasks: Chess Lab v1

Inputs: `proposal.md`, `specs/*/spec.md` (14 capabilities), `design.md` (ADR-01..ADR-22, slice plan), `openspec/config.yaml`.
Requirement references use `capability / Requirement name` from the specs; ADR references point to `design.md`.

## Review Workload Forecast

| Field                   | Value                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | Phase 1 about 6,300 authored lines across 18 slices (migrations and lockfile excluded); range 6,300 to 7,500 including tests. Phases 2 to 4 not estimated at line level (coarse slices only)                                                                  |
| 400-line budget risk    | High (total); Medium per slice for S7, S8, S9b (about 400 each, at the limit)                                                                                                                                                                                 |
| Chained PRs recommended | Yes                                                                                                                                                                                                                                                           |
| Suggested split         | PR 1 (S0) -> PR 2 (S1a) -> PR 3 (S1b) -> PR 4 (S2) -> PR 5 (S3) -> PR 6 (S4a) -> PR 7 (S4b) -> PR 8 (S5a) -> PR 9 (S5b) -> PR 10 (S6) -> PR 11 (S7) -> PR 12 (S8) -> PR 13 (S9a) -> PR 14 (S9b) -> PR 15 (S10) -> PR 16 (S11a) -> PR 17 (S11b) -> PR 18 (S12) |
| Delivery strategy       | auto-chain                                                                                                                                                                                                                                                    |
| Chain strategy          | feature-branch-chain                                                                                                                                                                                                                                          |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Chain bases (feature-branch-chain, user-selected): tracker branch `feat/chess-lab-v1`. PR 1 (S0) base = `feat/chess-lab-v1`. Every later PR base = the immediately previous PR branch in the order above. Only the tracker merges to `main`. If a child PR shows the previous PR's changes, its base is wrong and must be retargeted or rebased before review. Slices without a dependency between them (S4a, S5a, S9a after S0) may be reordered, but then the base of each child must be re-chosen to the new previous slice.

Split log: S2 was split into S2a (schema, PR 4) and S2b (lint, PR 5); later PR numbers shift by one.

Budget notes: S7, S8 and S9b are estimated at about 400 lines. If an implementation exceeds 400 authored lines (additions plus deletions, migrations and lockfile excluded), split at the task boundary noted in the slice (S7 split point: after S7.6; S8 split point: after S8.3; S9b split point: after S9b.5) and insert the new PR in the chain. Per the Review Policy, review once per group of two completed slices.

### Suggested Work Units

| Unit | Goal                                      | Likely PR                       | Focused test command                                                                              | Runtime harness                                                                             | Rollback boundary                                                           |
| ---- | ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| S0   | Deps, engine copy, spikes, API fact notes | PR 1 (base `feat/chess-lab-v1`) | `bun test tests/lint-boundaries.test.ts` (no regression)                                          | `pnpm --filter web build` then `ls apps/web/public/engine`; open the board spike at 375 px  | `apps/web/scripts/`, `apps/web/public/engine` ignore, spike route, `notes/` |
| S1a  | `packages/chess` core                     | PR 2 (base PR 1)                | `bun test packages/chess`                                                                         | `bun -e "import {positionKey} from '@b2c-template/chess'; ..."` against fixture FEN         | `packages/chess/`                                                           |
| S1b  | Classification                            | PR 3 (base PR 2)                | `bun test packages/chess/src/classify.test.ts`                                                    | `bun -e` run `classifyGame` on fixture PGN and eval array                                   | `classify.ts`, `config.ts`                                                  |
| S2   | Phase 1 schema + package lint             | PR 4 (base PR 3)                | `bun test packages/db tests/lint-boundaries.test.ts`                                              | `pnpm db:test:prepare` then schema integration test; `oxlint` on fixtures                   | `packages/db/src/schema/*`, migration, `.oxlintrc.json` overrides           |
| S3   | Lichess sign-in                           | PR 5 (base PR 4)                | `bun test packages/auth`                                                                          | Auth integration test with fake Lichess endpoints (callback creates user + encrypted token) | `packages/auth/src/lichess-*`, provider registration                        |
| S4a  | `packages/lichess` client                 | PR 6 (base PR 5)                | `bun test packages/lichess`                                                                       | Fake-fetch NDJSON stream with 429 and fake clock                                            | `packages/lichess/`                                                         |
| S4b  | Import service + router                   | PR 7 (base PR 6)                | `bun test packages/api/src/services/import-service.test.ts`                                       | Real DB import with fake `GamesSource` that fails mid-stream, then resumes                  | `import-service.ts`, `lichess` router, server wiring                        |
| S5a  | `packages/study`                          | PR 8 (base PR 7)                | `bun test packages/study`                                                                         | `bun -e` grade a new card through all four grades                                           | `packages/study/`                                                           |
| S5b  | Review + settings routers                 | PR 9 (base PR 8)                | `bun test packages/api/src/services/review-service.test.ts`                                       | Real DB: replay `reviewLogId` twice, assert one log and one card update                     | `review-service.ts`, `review/settings` routers                              |
| S6   | Board wrapper                             | PR 10 (base PR 9)               | `bun test apps/web/src/shared/components/board`                                                   | SSR render tests; manual 375 px touch check from S0 spike notes                             | `apps/web/src/shared/components/board/`                                     |
| S7   | Midnight shell, flags, Today              | PR 11 (base PR 10)              | `bun test packages/api/src/features.test.ts apps/web/src/app`                                     | `pnpm dev`, sign in, / redirects to /today; `GET /api/public/features`                      | `globals.css` tokens, navigation, flags, Today feature                      |
| S8   | Review session UI                         | PR 12 (base PR 11)              | `bun test apps/web/src/features/review`                                                           | Dev server: grade 20 cards offline then online, confirm replay is idempotent                | `apps/web/src/features/review/`, review routes                              |
| S9a  | Engine runtime + licence page             | PR 13 (base PR 12)              | `bun test apps/web/src/features/engine`                                                           | Dev server: analyse one position, worker lazy-loaded, /licenses page loads                  | `apps/web/src/features/engine/`, `routes/licenses.tsx`                      |
| S9b  | Analysis pipeline                         | PR 14 (base PR 13)              | `bun test packages/api/src/services/analysis-service.test.ts`                                     | Dev server: import a game, run analysis, mistakes and cards appear                          | `analysis-service.ts`, `analysis` router, `use-game-analysis`               |
| S10  | Games and mistakes UI                     | PR 15 (base PR 14)              | `bun test apps/web/src/features/games apps/web/src/features/mistakes`                             | Dev server: list games, open a mistake detail with board                                    | `features/games`, `features/mistakes`, routes                               |
| S11a | Export                                    | PR 16 (base PR 15)              | `bun test packages/api/src/services/export-service.test.ts apps/server/src/export-routes.test.ts` | `curl -b cookie /api/export/data.json` streams JSON without tokens                          | `export-service.ts`, `export-routes.ts`, export UI                          |
| S11b | Lichess-only deletion                     | PR 17 (base PR 16)              | `bun test packages/auth/src/lichess-account.test.ts`                                              | Auth integration: stale session returns `REAUTH_REQUIRED`, success cascades                 | `lichess-account.ts` delete endpoint, danger page                           |
| S12  | Template cleanup                          | PR 18 (base PR 17)              | `pnpm check-types && bun test`                                                                    | Dev server: no /prototype/* routes, nav shows only pillars + Account                        | deleted prototype/dashboard files (revert restores them)                    |

## Conventions

- Test-first marker: `[T]` = TDD (RED test task precedes GREEN task; per `openspec/config.yaml`, TDD covers server, auth, API and pure logic). `[O]` = ordinary checks (UI, scaffolding, config).
- React/TSX tasks (marked `[react]`): implementation routes to the `react-staff` agent (model `sonnet`) with the feature document locator, authorized scope, TDD mode (strict_tdd false, scoped), runner `bun test`, and the slice `Verify` commands.
- Every slice closes with at least one work-unit commit (Conventional Commit) with tests and docs together; the commit is the review candidate.
- Per-slice standard verification (run at slice closure, in addition to the slice's focused command): `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` (runs `oxfmt --write`; commit any formatting it applies before review), `bun test`.
- Paths marked `(read-only)` are only read.
- Phase 1 DB tasks that run migrations: generate with `pnpm db:generate` (command name follows `packages/db` scripts; confirm in S2.1) and never hand-edit generated SQL except the CHECK constraint if Drizzle cannot express it.

---

## Phase 1: Mistakes pillar end to end (S0 to S12)

### S0: Dependencies and spikes (PR 1, est. 250 lines, base `feat/chess-lab-v1`)

Satisfies: engine-runtime / Separate, unmodified, lazy-loaded worker; engine-runtime / Permissive-only app bundle; chess-board / Client-only rendering behind a wrapper interface (spike); game-import / Rate-limit compliance (fact verification); opening-explorer / Server-side requests that respect rate limits (fact verification). Open questions closed: Lichess API facts, board library verdict, Stockfish pinning, Dockerfile pnpm.

- [x] S0.1 [O] Add dependencies: `chess.js` and `react-chessboard` in `apps/web/package.json`, `stockfish` (asset source only, devDependency) in `apps/web/package.json`; `ts-fsrs` deferred to S5a, `chess.js` for `packages/chess` deferred to S1a. Update `pnpm-lock.yaml`.
- [x] S0.2 [O] Create `apps/web/scripts/copy-engine.ts`: copy the pinned lite single-thread `stockfish-*-lite-single.js` + `.wasm` and the GPL text (`Copying.txt`) unmodified from `node_modules/stockfish` into `apps/web/public/engine/`; wire into `apps/web/package.json` `predev` and `prebuild` scripts. File names pinned after S0.8.
- [x] S0.3 [O] Modify `apps/web/.gitignore` to ignore `public/engine/`.
- [x] S0.4 [O] Modify `apps/web/vite.config.ts`: workbox `globIgnores: ["engine/**"]` and a runtime `CacheFirst` route for /engine/.
- [x] S0.5 [O] [react] Create the throwaway spike screen `apps/web/src/routes/prototype/board-spike.tsx` (deleted in S12) rendering react-chessboard v5 at 375 px with tap-tap and drag moves, promotion and arrows.
- [ ] S0.6 [O] Manual check: 375 px touch spike on a real phone or device emulation; record verdict (keep react-chessboard or switch `chess-board-impl.tsx` to cm-chessboard) in `openspec/changes/chess-lab-v1/notes/s0-verification.md`.
- [x] S0.7 [O] Verify and record in the same notes file the Lichess API facts against current docs (https://lichess.org/api): export parameters (`since`, `sort=dateAsc`, `clocks`, `opening`, `pgnInJson`, `moves`, `evals`, `finished`, `Accept: application/x-ndjson`), exact 429 policy (wait one minute), whether the opening explorer requires a token, and PKCE S256-only for /oauth. Update ADR-09 values in design if any differ.
- [x] S0.8 [O] Verify and record the Stockfish pin: exact npm version, lite single-thread file names, supported `UCI_Elo` min/max read from the `uci` handshake, upstream source URL; set the `ENGINE_ID` value to use in S9a.
- [x] S0.9 [O] Verify and record the `apps/server/Dockerfile` finding: Dockerfile installs `pnpm@11`, repo uses pnpm 12 (read-only comparison of `apps/server/Dockerfile` (read-only) and root `package.json` `packageManager` (read-only)); note the fix needed before first deploy (fix itself is part of the hosting decision, not this slice).
- [x] S0.10 [O] Record that the Stockfish GPL reading remains a launch gate in the notes file.

Verify: `pnpm --filter web build`; `ls apps/web/public/engine`; confirm dist contains no `stockfish` in the main bundle; standard checks.

### S1a: `packages/chess` core (PR 2, est. 350 lines, base PR 1)

Satisfies: chess-board / Typed SAN input (parser), mistake-analysis / Repeat-mistake identification (position key), mistake-analysis / Mistake record contents (clocks, FEN); ADR-01, ADR-05.

- [x] S1a.1 [O] Create `packages/chess/package.json` (`@b2c-template/chess`, dep `chess.js`), `packages/chess/tsconfig.json`, `packages/chess/src/index.ts` (public interface); register the package in the workspace; update lockfile.
- [x] S1a.2 [T] RED: write `packages/chess/src/position.test.ts` covering `positionKey` (same key regardless of move order and clocks; castling rights included; en-passant square only when an en-passant capture is legal), `parseMove` (SAN and UCI, case-tolerant, illegal returns `null`, promotion), `legalMoves`, `applyMove`.
- [x] S1a.3 [T] GREEN: implement `packages/chess/src/position.ts` (`positionKey`, `legalMoves`, `parseMove`, `applyMove`) per the Interfaces section of design.
- [x] S1a.4 [T] RED: write `packages/chess/src/pgn.test.ts` with fixture PGNs: headers, `%clk` clock comments, missing clocks (null), non-standard start FEN, initial clock from `TimeControl`.
- [x] S1a.5 [T] GREEN: implement `packages/chess/src/pgn.ts` `parseGame(pgn)` returning headers, `ParsedPly[]` (fenBefore, san, uci, color, clockMs) and `initialClockMs`.
- [x] S1a.6 [O] Create `GLOSSARY.md` at repo root from the design glossary table (terms only, no implementation detail), first slice that introduces code using these terms.

Verify: `bun test packages/chess`; `pnpm check-types`; standard checks.

### S1b: `packages/chess` classification (PR 3, est. 300 lines, base PR 2)

Satisfies: mistake-analysis / Classification by evaluation loss; Mistake record contents; Cards for carded severities only (`CARD_SEVERITIES`); mistake-filters / Filter by game phase and Filter by time pressure (data side); ADR-12 classification rules, ADR-18 constants.

- [x] S1b.1 [O] Create `packages/chess/src/config.ts` with `DEFAULT_THRESHOLDS` (50/100/200), `CARD_SEVERITIES`, `MATE_CP`, `EVAL_CLAMP_CP`, `OPENING_PLY_LIMIT`, `ENDGAME_MATERIAL`, `TIME_PRESSURE_RATIO`.
- [x] S1b.2 [T] RED: write `packages/chess/src/classify.test.ts`: mate mapped to `±1000`, clamp to `±1000`, loss from mover perspective, threshold boundaries (49/50, 99/100, 199/200), only the user's colour classified, phase rules (opening below ply 20, endgame at non-pawn material <= 13, else middlegame), time pressure (`clock_left < 0.1 * initial`), null evals skipped.
- [x] S1b.3 [T] GREEN: implement `packages/chess/src/classify.ts` `screenCandidates` and `classifyGame` returning `ClassifiedMistake[]` (including `positionKey`, best move SAN/UCI, `clockLeftMs`).
- [x] S1b.4 [T] Add a test for idempotent output: classifying the same input twice yields identical results (supports `(game_id, ply)` upsert).
- [x] S1b.5 [O] Export the new API from `packages/chess/src/index.ts`.

Verify: `bun test packages/chess`; standard checks.

### S2: Phase 1 schema and package lint (PR 4, est. 380 lines, base PR 3)

Satisfies: review-queue / Single card with exactly one source; review-queue / Cards only for the owning user; mistake-analysis / Exactly one card per mistake; mistake-analysis / Analysis owned by the user; lichess-account / Account linking to games; data-control / Deletion removes all user data (cascade); game-import / Idempotent and resumable import (unique key); ADR-02, ADR-03, ADR-04, ADR-05, ADR-06.

- [x] S2.1 [O] Inspect `packages/db/package.json` scripts and `packages/db/src/schema/audit.ts` (read-only) to confirm migration command and conventions.
- [x] S2.2 [T] RED: write `packages/db/src/schema/chess-schema.test.ts` (against the test DB via `db:test:prepare`): CHECK `card_exactly_one_source` rejects zero sources; unique `(user_id, lichess_game_id)`; unique `(game_id, ply)` on `mistake`; unique `card.mistake_id`; unique `review_log.id`; deleting a `user` cascades to every Phase 1 chess table.
- [x] S2.3 [T] GREEN: create `packages/db/src/schema/lichess.ts` (`lichess_profile`), `settings.ts` (`user_settings`), `games.ts` (`game`, `game_analysis`, `mistake` with pgEnums `severity`, `phase`), `cards.ts` (`card` with CHECK and FSRS columns, `review_log`) per ADR-04 to ADR-06, including named indexes `(user_id, due)`, `(user_id, state)`, `(user_id, position_key, played_uci)`, `(user_id, eco)`, `(user_id, played_at desc)`, `(user_id, reviewed_at)`, `(card_id, reviewed_at)`.
- [x] S2.4 [O] Modify `packages/db/src/schema/index.ts` and `packages/db/src/relations.ts` (spread new `defineRelationsPart` parts).
- [x] S2.5 [O] Generate the add-only migration via the db generate script; commit `packages/db/src/migrations/*`.
- [x] S2.6 [T] RED: extend `tests/lint-boundaries.test.ts` with cases and add fixtures under `tests/lint-boundaries/fixtures/`: `packages/chess/**` and `packages/study/**` importing db/auth/api/lichess/react/`@/**` fail; `packages/lichess/**` importing db/api/react fail; `apps/web/src/**` importing `@b2c-template/lichess|db|auth` fail; a `shared/` file importing `@b2c-template/lichess` fails (repeat web patterns in the `shared/**` override).
- [x] S2.7 [O] GREEN: modify `.oxlintrc.json` with the three overrides and repeat the new web patterns in the `apps/web/src/shared/**` override.

Verify: `pnpm db:test:prepare && bun test packages/db tests/lint-boundaries.test.ts`; standard checks.

### S3: Lichess sign-in (PR 5, est. 380 lines, base PR 4)

Satisfies: lichess-account / Sign in with Lichess using PKCE; Immutable Lichess identity as account subject; Synthetic non-deliverable email; Token encrypted at rest and never sent to the browser; Account linking to games; app-shell / Email sign-up UI flag (provider list part); ADR-07.

- [x] S3.1 [T] RED: `packages/auth/src/synthetic-email.test.ts` for `syntheticEmail(id)` (`<id>@lichess.invalid`) and `isSyntheticEmail`.
- [x] S3.2 [T] GREEN: create `packages/auth/src/synthetic-email.ts`.
- [x] S3.3 [T] RED: `packages/auth/src/lichess-provider.test.ts`: config builder output (PKCE true, empty scopes, `authentication: "post"`, `accountSubject` uses immutable id, `overrideUserInfo: true`), `fetchLichessAccount` with injected fetch maps /api/account and rejects non-OK.
- [x] S3.4 [T] GREEN: create `packages/auth/src/lichess-provider.ts`.
- [x] S3.5 [T] RED: `packages/auth/src/lichess-account.integration.test.ts` (better-auth test utils, fake Lichess endpoints): callback creates a user with synthetic email, stores `account.access_token` encrypted (`$ba$` or hex form), upserts `lichess_profile` (id, username, ratings), second sign-in refreshes username and keeps the same user, no auto-link to an email account.
- [x] S3.6 [T] GREEN: create the plugin in `packages/auth/src/lichess-account.ts` (profile upsert via plugin `hooks.after` matcher on /callback/:id (provider id from ctx.params.id; better-auth 1.7.5 serves generic-oauth through the social routes); delete endpoint comes in S11b); modify `packages/auth/src/index.ts` to register `genericOAuth` when `LICHESS_CLIENT_ID` is set, set `account.encryptOAuthTokens: true`, extend `AuthConfig`.
- [x] S3.7 [T] RED then GREEN: `packages/auth/src/email/factory.ts` drops and logs sends to synthetic addresses (test in the existing email factory test file or a new `factory.test.ts`).
- [x] S3.8 [T] RED then GREEN: `packages/auth/src/social-providers.ts` `listEnabledSocialProviders` includes `lichess` when configured; test with and without `LICHESS_CLIENT_ID`.
- [x] S3.9 [O] Modify `apps/server/src/env.ts` and `.env.schema` for `LICHESS_CLIENT_ID` (optional; no secret).
- [x] S3.10 [O] [react] Modify `apps/web/src/features/auth/components/sign-in-page.tsx` to render the Lichess button from the providers list (`authClient.signIn.social({ provider: "lichess" })`); email sign-up behind the flag lands in S7.

Verify: `bun test packages/auth`; standard checks.

### S4a: `packages/lichess` client (PR 6, est. 350 lines, base PR 5)

Satisfies: game-import / Streamed import; Rate-limit compliance; Incremental sync (`since`); opening-explorer / Server-side requests that respect rate limits (gate only; explorer endpoint in Phase 2); lichess-account / Token encrypted at rest and never sent to the browser (server-only package); ADR-09. Uses S0.7 verified parameters.

- [x] S4a.1 [O] Create `packages/lichess/package.json` (`@b2c-template/lichess`), `tsconfig.json`, `src/index.ts`, `src/types.ts`, `src/config.ts` (`RATE_LIMIT_PAUSE_MS` 60000, `MAX_429_RETRIES` 3).
- [x] S4a.2 [T] RED: `packages/lichess/src/ndjson.test.ts`: lines split across chunk boundaries, trailing line without newline, blank keep-alive lines, malformed line error.
- [x] S4a.3 [T] GREEN: `packages/lichess/src/ndjson.ts` streaming parser.
- [x] S4a.4 [T] RED: `packages/lichess/src/serial-gate.test.ts`: no overlap per user key, parallel across users, pause honoured, doubling up to 5 minutes (fake clock and sleep).
- [x] S4a.5 [T] GREEN: `packages/lichess/src/serial-gate.ts`.
- [x] S4a.6 [T] RED: `packages/lichess/src/client.test.ts` with fake `fetch`: `account(token)`; `exportGames` request URL and headers (`since`, `sort=dateAsc`, `clocks`, `opening`, `pgnInJson`, `moves`, `evals=false`, `finished`, ndjson Accept); non-standard variants skipped; 429 pauses then retries up to `MAX_429_RETRIES` then throws `LichessRateLimited` with `retryAt`; abort via `AbortSignal`.
- [x] S4a.7 [T] GREEN: `packages/lichess/src/client.ts` `createLichessClient(deps)`; export from `index.ts`.

Verify: `bun test packages/lichess`; standard checks.

### S4b: Import service and router (PR 7, est. 380 lines, base PR 6)

Satisfies: game-import / First import over a configured window; Incremental sync; Idempotent and resumable import; Import progress and failure visibility; Rate-limit compliance (backoff state); lichess-account / Token encrypted at rest and never sent to the browser (token read only through server port); ADR-10, ADR-19.

- [x] S4b.1 [O] Create `packages/api/src/services/import-config.ts` (`IMPORT_WINDOW_MONTHS` 3, `FIRST_IMPORT_MAX_GAMES` 1000, `AUTO_SYNC_AFTER_MS` 6 h, lease duration).
- [x] S4b.2 [T] RED: `packages/api/src/services/import-service.test.ts` (real DB, fake `GamesSource`): first import uses the window; resume after mid-stream failure yields zero duplicate games and continues from committed cursor; lease blocks a concurrent run (returns current status); 429 sets `import_state='backoff'` with `import_retry_at`; other errors set `failed` with safe message; end sets `idle` and `first_import_done_at`; first import cap; `game_analysis` rows created `pending`.
- [x] S4b.3 [T] GREEN: `packages/api/src/services/import-service.ts` (`requestSync`, lease acquire, per-batch transaction with cursor), parsing PGN headers via `@b2c-template/chess` `parseGame` (add dep) for `user_color`, speed, time control, ECO.
- [x] S4b.4 [T] RED then GREEN: `packages/api/src/features-less` router test `packages/api/src/routers/lichess.test.ts`: `lichess.status` (enqueues sync when `last_synced_at` older than 6 h; never throws for "already running"), `lichess.sync`; ownership by session user.
- [x] S4b.5 [O] Create `packages/api/src/routers/lichess.ts`; modify `packages/api/src/routers/index.ts` (register; keep `privateData` until S12) and `packages/api/src/context.ts` (`lichess: LichessPort` type-only port, `ImportStatus`).
- [x] S4b.6 [O] Modify `apps/server/src/services.ts`: build the Lichess client, `LichessPort` adapter (token via `auth.api.getAccessToken` for provider `lichess`), `ImportRunner` with `AbortController` per import, `startBackgroundJobs` stop aborts imports; modify `apps/server/src/context.ts` to pass `lichess`.

Verify: `bun test packages/api apps/server`; standard checks.

### S5a: `packages/study` (PR 8, est. 300 lines, base PR 7)

Satisfies: review-queue / FSRS scheduling; Daily queue from all pillars; Review session flow (optimistic grading); ADR-13.

- [x] S5a.1 [O] Create `packages/study/package.json` (`@b2c-template/study`, dep `ts-fsrs`), `tsconfig.json`, `src/index.ts`, `src/config.ts` (`DEFAULT_DAILY_NEW_CARDS` 20, `DEFAULT_STUDY_PARAMS`: retention 0.9, max interval 365, fuzz on).
- [x] S5a.2 [T] RED: `packages/study/src/fsrs.test.ts`: `newCardState`, each grade 1..4 transition (state, due moves forward, lapses on Again from Review), pure for fixed `now`, `reviewedAt` clamp helper behaviour.
- [x] S5a.3 [T] GREEN: `packages/study/src/fsrs.ts` (`newCardState`, `grade`, `ReviewLogEntry`).
- [x] S5a.4 [T] RED: `packages/study/src/day.test.ts`: `localDayBounds` across DST changes and half-hour zones.
- [x] S5a.5 [T] GREEN: `packages/study/src/day.ts`.
- [x] S5a.6 [T] RED: `packages/study/src/queue.test.ts`: learning cards first, then review due today, new cards capped by `dailyNewLimit - introducedToday`, even interleave of new cards, round-robin across pillars so none starves, `limit` honoured.
- [x] S5a.7 [T] GREEN: `packages/study/src/queue.ts` `selectQueue`; export from `index.ts`.

Verify: `bun test packages/study`; standard checks.

### S5b: Review and settings routers (PR 9, est. 380 lines, base PR 8)

Satisfies: review-queue / Single card with exactly one source; Daily queue from all pillars; Grades never lost (server idempotency); Cards only for the owning user; app-shell / Per-phase feature flags (queue excludes flagged-off pillars, flags object added in S7: use pillar filter input now); mistake-analysis / Card prompt is the position before the mistake; ADR-13, ADR-19.

- [x] S5b.1 [T] RED: `packages/api/src/services/review-service.test.ts` (real DB): `grade` replay of the same `reviewLogId` returns stored `state_after` and does not double-apply; concurrent grade of same card is serialized (`FOR UPDATE`); `reviewedAt` clamped to `[last_review, now + 5 min]`; grading another user's card returns NOT_FOUND; queue respects daily new limit in the user's time zone and `introducedToday` from `state_before.state = 0`; queue hydrates prompt FEN (position before the mistake), orientation, answers (best move), context (played SAN, game id, eval loss).
- [x] S5b.2 [T] GREEN: `packages/api/src/services/review-service.ts` (`getQueue`, `gradeCard`), `cardPillar(row)` TS helper and `cardPillarSql` helper in `packages/db`.
- [x] S5b.3 [T] RED then GREEN: `packages/api/src/routers/review.test.ts` and `settings.test.ts`: `review.queue({limit})`, `review.grade` zod input (`reviewLogId` uuid, grade 1..4, elapsedMs bounds), `settings.get` (lazy upsert defaults), `settings.update` (daily limit bounds, IANA time zone validation).
- [x] S5b.4 [O] Create `packages/api/src/routers/review.ts`, `settings.ts`; register in `packages/api/src/routers/index.ts`; add `@b2c-template/study` dep to `packages/api`.

Verify: `bun test packages/api`; standard checks.

### S6: Board wrapper (PR 10, est. 350 lines, base PR 9) [react]

Satisfies: chess-board / all requirements (Client-only rendering behind a wrapper interface; Touch and pointer move input; Arrows and square highlights; Blindfold mode; Accessible move list; Typed SAN input; Keyboard operation); app-shell / 375 px layout and touch targets; ADR-16. Implementation routes to `react-staff`.

- [x] S6.1 [O] [react] Create `apps/web/src/shared/components/board/board-theme.ts` (CSS variables `--board-light`, `--board-dark`, `--board-highlight`, `--board-arrow` from `midnightBoard` in `apps/web/src/routes/prototype/-midnight-shell.tsx` (read-only)).
- [x] S6.2 [O] [react] Create `chess-board.tsx` (static placeholder with accessible `label` until mounted, `React.lazy` of the impl) and `chess-board-impl.tsx` (react-chessboard v5; legal-move-only `onMove`, tap-tap, promotion, arrows, highlights, `hidden` blindfold via empty piece renderers, last move). Apply the S0.6 verdict (swap to cm-chessboard if the spike failed).
- [x] S6.3 [T] [react] RED then GREEN: SSR tests `move-list.test.tsx` and component `move-list.tsx` (ordered list, `aria-current` on current ply, keyboard selectable).
- [x] S6.4 [T] [react] RED then GREEN: SSR tests `san-input.test.tsx` and component `san-input.tsx` (labelled field, accepts legal SAN/UCI via `parseMove`, rejects illegal, `aria-live` error).
- [x] S6.5 [T] [react] SSR test `chess-board.test.tsx`: placeholder renders with label and same-size squares; blindfold hides pieces; touch targets at least 44 px for controls.
- [x] S6.6 [O] [react] Create `index.tsx`; add `@b2c-template/chess` dep to `apps/web`. Add Storybook story for `ChessBoard` only if required by `tests/ui-story-coverage` (check; board lives in `apps/web`, likely not required).

Verify: `bun test apps/web/src/shared/components/board`; `pnpm --filter web check-types`; manual: board at 375 px.

### S7: Midnight shell, flags and Today (PR 11, est. 400 lines, base PR 10) [react + API]

Satisfies: app-shell / Midnight shell and pruned navigation; Per-phase feature flags; Today home; Today load performance; 375 px layout and touch targets; Shell accessibility; Email sign-up UI flag; ADR-17, ADR-18, ADR-21. Server parts are TDD. Web parts route to `react-staff`.

- [ ] S7.1 [T] RED: `packages/api/src/features.test.ts`: `parseFeatureFlags(env)` default `mistakes` only; comma list; unknown tokens ignored; `emailSignUp` default off.
- [ ] S7.2 [T] GREEN: `packages/api/src/features.ts` (`FeatureFlags`, `parseFeatureFlags`); modify `packages/api/src/context.ts` (`features`), `packages/api/src/index.ts` (`featureProcedure(pillar)` throws NOT_FOUND when off; test in `packages/api/src/index.test.ts`).
- [ ] S7.3 [T] RED then GREEN: `apps/server/src/public-routes.ts` `GET /api/public/features` (no-store); extend `apps/server/src/public-routes` test; modify `apps/server/src/env.ts` and `.env.schema` for `CHESSLAB_FEATURES`; modify `apps/server/src/context.ts`.
- [ ] S7.4 [T] RED then GREEN: `packages/api/src/routers/today.test.ts` and `today.ts`: `today.summary` (due count per pillar, new budget left, streak, sync status, scoped to user; reuse review-service helpers); register in `routers/index.ts`.
- [ ] S7.5 [O] [react] Port Midnight tokens into `packages/ui/src/styles/globals.css` (dark scheme: background `#0b1220`, card `#131c2e`, border `#243350`, foreground `#e6edf7`, muted `#a3b3cb`, primary `#3ee6b0`, primary-foreground `#04231a`, radius 1rem); force dark for v1; verify contrast 4.5:1 for muted-on-background and primary-foreground-on-primary with a contrast tool and adjust muted if lower (closes Open Question: Contrast); check `tests/storybook-css` still passes.
- [ ] S7.6 [O] [react] Modify `apps/web/src/app/navigation.ts`, `use-nav-context.ts` (`NavContext.features`, fetch /api/public/features), `home-redirect.ts` (/ -> /today): nav items Today, Review, Mistakes, Repertoire, Blindfold, Progress plus Account; pillar items gated by flags. (Split point if over budget.)
- [ ] S7.7 [O] [react] Create `apps/web/src/features/today/**` (summary cards, Start review CTA with prefetch on hover/focus, sync status) and `apps/web/src/routes/_auth/today.tsx` with `staticData: { appShell: true }`; modify `sign-in-page.tsx` to hide email sign-up unless `emailSignUp`.
- [ ] S7.8 [O] Manual: Today under 2 s on throttled mid-range profile; keyboard navigation and visible focus; 375 px layout (record in PR notes).

Verify: `bun test packages/api apps/server apps/web/src/app`; `pnpm --filter web check-types`; standard checks.

### S8: Review session UI (PR 12, est. 400 lines, base PR 11) [react]

Satisfies: review-queue / Review session flow; Next card under 200 ms; Grades never lost; Daily queue from all pillars; chess-board / Typed SAN input and Keyboard operation (used in session); ADR-14, ADR-15.

- [ ] S8.1 [T] RED: `apps/web/src/features/review/lib/grade-outbox.test.ts` (fake storage): synchronous append survives reload, FIFO order, removal only after success or non-retryable error (`NOT_FOUND`, `BAD_REQUEST` dropped and logged), retry with backoff on network error, replay keeps `reviewLogId`, per-user key.
- [ ] S8.2 [T] GREEN: `apps/web/src/features/review/lib/grade-outbox.ts` (flush on `online`, `visibilitychange`, app start; sign-out best-effort flush); `config.ts` (`QUEUE_PAGE_SIZE` 50, `QUEUE_PREFETCH_THRESHOLD` 10).
- [ ] S8.3 [O] [react] `hooks/use-review-queue.ts` (TanStack Query, in-memory queue, prefetch when remaining < 10, optimistic re-show of Again cards using `@b2c-template/study` `grade`). (Split point if over budget.)
- [ ] S8.4 [O] [react] `components/review-session.tsx` (board props change only, answer by move or `SanInput`, reveal answer, four grade buttons at least 44 px, session summary) and `apps/web/src/routes/_auth/review.tsx`.
- [ ] S8.5 [O] Manual: next card under 200 ms on throttled 4G profile; offline grading then reconnect shows no lost or duplicated logs; keyboard-only session.

Verify: `bun test apps/web/src/features/review`; `pnpm --filter web check-types`; standard checks.

### S9a: Engine runtime and licence page (PR 13, est. 350 lines, base PR 12) [react]

Satisfies: engine-runtime / Analysis runs in the browser; Separate, unmodified, lazy-loaded worker; Typed analysis API and job queue; Licence and source offered; Permissive-only app bundle; Engine strength control (UCI option plumbing); ADR-11.

- [ ] S9a.1 [T] RED: `apps/web/src/features/engine/lib/uci.test.ts`: parse `info depth .. score cp|mate .. pv`, `bestmove`, `option name UCI_Elo ... min .. max`; build `go`, `setoption` commands.
- [ ] S9a.2 [T] GREEN: `apps/web/src/features/engine/lib/uci.ts`.
- [ ] S9a.3 [T] RED then GREEN: `lib/engine-queue.test.ts` and `engine-queue.ts`: one job at a time, `interactive` pre-empts `background` by `stop`, cancellable jobs, analysis jobs reset `UCI_LimitStrength false` and `Skill Level 20`.
- [ ] S9a.4 [O] [react] `lib/engine-client.ts` (lazy `Worker`, handshake `uci/isready`, `Hash 16`, `Threads 1`, read `UCI_Elo` range, "engine unavailable" error path), `config.ts` (`SCREEN_DEPTH` 10, `CONFIRM_DEPTH` 18, `SUBMIT_EVERY_PLIES` 10, `ENGINE_ID` from S0.8, `ENGINE_STRENGTH_LEVELS`, `ENGINE_DRILL_MOVETIME_MS` constants may be added in Phase 3), `index.ts`.
- [ ] S9a.5 [O] [react] `apps/web/src/routes/licenses.tsx` (public, outside `_auth`): GPL-3.0 text, upstream source URL for pinned version, direct links to served /engine/* files; link from shell footer.
- [ ] S9a.6 [O] Manual: confirm the engine is absent from the main bundle (`pnpm --filter web build`, inspect chunks), not precached by the service worker, and loads on first `analyse` call.

Verify: `bun test apps/web/src/features/engine`; `pnpm --filter web check-types`; standard checks.

### S9b: Analysis pipeline (PR 14, est. 400 lines, base PR 13) [API + react]

Satisfies: engine-runtime / Shallow-then-deep analysis; Persisted evaluations enable resume; mistake-analysis / all requirements (Classification, record contents, cards for carded severities, exactly one card per mistake, card prompt, repeat identification, analysis owned by the user); game-import / Import progress and failure visibility (analysis status); ADR-12.

- [ ] S9b.1 [T] RED: `packages/api/src/services/analysis-service.test.ts` (real DB): `next` returns oldest non-complete game with evals and `next_ply`; `submitEvals` merges by ply idempotently and advances `next_ply`; rejects another user's game, plies out of range, out-of-bound depth or cp; `complete` upserts mistakes `ON CONFLICT (game_id, ply)` and creates exactly one New card per carded mistake, repeat `complete` creates no duplicates, inaccuracies not carded by default, sets `status = complete`, all in one transaction.
- [ ] S9b.2 [T] GREEN: `packages/api/src/services/analysis-service.ts` using `classifyGame` from `@b2c-template/chess`.
- [ ] S9b.3 [T] RED then GREEN: `packages/api/src/routers/analysis.test.ts` and `analysis.ts` (`next`, `submitEvals`, `complete`) behind `featureProcedure("mistakes")`; register in `routers/index.ts`.
- [ ] S9b.4 [T] RED then GREEN: repeat-mistake query helper test (same `position_key` and `played_uci` across games) in `analysis-service.test.ts` (data availability for Progress).
- [ ] S9b.5 [O] [react] `apps/web/src/features/engine/hooks/use-game-analysis.ts`: screen at depth 10 from `next_ply`, submit every 10 plies and on `visibilitychange/pagehide`, confirm candidates at depth 18, call `complete`; pause while review session open; stop when hidden longer than `PAUSE_HIDDEN_MS`. (Split point if over budget.)
- [ ] S9b.6 [O] [react] Analysis status UI component (progress, "engine unavailable", resume) mounted from Today and Games (consumed in S10).

Verify: `bun test packages/api`; `pnpm --filter web check-types`; standard checks. Manual: import a game, let analysis run, confirm mistakes and cards appear in the review queue.

### S10: Games and mistakes UI (PR 15, est. 350 lines, base PR 14) [react + API]

Satisfies: mistake-analysis / Mistake record contents (displayed), Analysis owned by the user; game-import / Import progress and failure visibility (Sync now, status); app-shell / Today home links; ADR-19.

- [ ] S10.1 [T] RED then GREEN: `packages/api/src/routers/games.test.ts` + `games.ts` (`list` cursor pagination via `packages/db/src/lib/pagination.ts`, `get`) and `mistakes.test.ts` + `mistakes.ts` (`list`, `get`), all scoped by session user id combined in the WHERE clause; ownership rejection tests; register routers.
- [ ] S10.2 [O] [react] `apps/web/src/features/games/**` (games list with analysis status, sync status with "Sync now" and failure/backoff message) and `apps/web/src/routes/_auth/games*.tsx`.
- [ ] S10.3 [O] [react] `apps/web/src/features/mistakes/**` (mistake list, detail with board before the mistake, played vs best move arrows, `MoveList`, link to game) and `apps/web/src/routes/_auth/mistakes*.tsx` guarded by flag in `beforeLoad`.
- [ ] S10.4 [O] Manual: keyboard-only and 375 px pass on both screens.

Verify: `bun test packages/api apps/web/src/features`; `pnpm --filter web check-types`; standard checks.

### S11a: Export (PR 16, est. 350 lines, base PR 15) [API + react]

Satisfies: data-control / Export all personal data; Deletion and export accessible; lichess-account / Token encrypted at rest and never sent to the browser (export excludes tokens); ADR-20.

- [ ] S11a.1 [T] RED: `packages/api/src/services/export-service.test.ts` (real DB): `exportUserJson` contains every section (user, settings, lichessProfile without lease fields, games, analyses, mistakes, cards, reviewLogs), no token fields, keyset pages of 500 produce valid single JSON for more than 1000 rows, only the caller's rows; `exportUserPgn` streams all imported games separated by blank lines.
- [ ] S11a.2 [T] RED: meta-test in the same file enumerating every table in `packages/db/src/schema` with a `user_id` column and asserting `exportUserJson` covers it (fails today for any missing table).
- [ ] S11a.3 [T] GREEN: `packages/api/src/services/export-service.ts`.
- [ ] S11a.4 [T] RED then GREEN: `apps/server/src/export-routes.test.ts` and `export-routes.ts`: 401 without session, `Content-Disposition: attachment`, `Cache-Control: no-store`, streaming via `hono/streaming`; modify `apps/server/src/index.ts` to mount /api/export.
- [ ] S11a.5 [O] [react] `apps/web/src/features/data-control/**` export links (plain anchors to /api/export/data.json and /api/export/games.pgn), accessible labels; mount in `apps/web/src/features/account/components/danger-page.tsx` or a new data section.

Verify: `bun test packages/api apps/server`; standard checks.

### S11b: Lichess-only account deletion (PR 17, est. 350 lines, base PR 16) [auth + react]

Satisfies: data-control / Account deletion without email; Deletion removes all user data; Deletion and export accessible; lichess-account / Synthetic non-deliverable email (account UI hides email flows); ADR-08.

- [ ] S11b.1 [T] RED: extend `packages/auth/src/lichess-account.integration.test.ts` for `POST /api/auth/lichess/delete-account`: no session rejected; impersonated session rejected; session older than `DELETE_FRESH_WINDOW_MS` returns 403 `REAUTH_REQUIRED`; wrong username returns 400 `USERNAME_MISMATCH` (case-insensitive match otherwise); audit failure aborts the delete (fail closed); success deletes sessions and user, clears cookie, and cascades every chess row (assert row counts in all Phase 1 tables).
- [ ] S11b.2 [T] GREEN: add the endpoint and `DELETE_FRESH_WINDOW_MS` to `packages/auth/src/lichess-account.ts` using the existing `events.userDeleting` seam.
- [ ] S11b.3 [O] [react] Modify `apps/web/src/features/account/components/{danger-page,security-page,profile-page}.tsx`: for synthetic-email users hide email/password/verification flows, show the typed-username delete flow with re-auth via `authClient.signIn.social({ provider: "lichess", callbackURL: "/account/danger?confirm=1" })` on `REAUTH_REQUIRED`; real-email users keep the emailed-link flow.
- [ ] S11b.4 [O] Manual: keyboard-only and screen-reader labels on the delete flow.

Verify: `bun test packages/auth`; `pnpm --filter web check-types`; standard checks.

### S12: Template cleanup (PR 18, est. 300 lines mostly deletions, base PR 17) [react]

Satisfies: app-shell / Midnight shell and pruned navigation; ADR-21, ADR-19 (remove `privateData`).

- [ ] S12.1 [O] [react] Delete `apps/web/src/routes/prototype/**` (including the S0 `board-spike.tsx`); update the route tree and any references.
- [ ] S12.2 [O] [react] Delete `apps/web/src/routes/_auth/dashboard.tsx`; remove the theme preference card (dark forced); move admin group out of the main navigation (still reachable for superadmins).
- [ ] S12.3 [T] Remove the demo `privateData` procedure from `packages/api/src/routers/index.ts` and fix its tests (`bun test packages/api`).
- [ ] S12.4 [O] Update docs: `docs/architecture/web-app.md` (read the file first) and README sections for new packages, flags (`CHESSLAB_FEATURES`), env (`LICHESS_CLIENT_ID`), engine asset copy.
- [ ] S12.5 [O] Final Phase 1 pass: `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check`, `bun test`; manual NFR checks (Today load, 200 ms next card, contrast, keyboard).

Verify: standard checks; dev server shows no /prototype/* routes.

---

## Phase 2: Repertoire and opening explorer (coarse, one tracker-chain extension)

Deferred note: the left-repertoire deviation algorithm (FR-16: matching a game to a repertoire, transpositions, first out-of-book ply, which side deviated, "add this line") is NOT designed in detail. A design refresh against the repertoire specs MUST happen before slice P2-c starts. Phase 2 tasks below are slice-level only and will be broken into ordered tasks after that refresh. Each slice stays under 400 lines and chains onto the previous PR.

- [ ] P2-a Repertoire schema and graph: `packages/db/src/schema/repertoire.ts` (repertoire, repertoire_position, repertoire_move, idea_note), `card.repertoire_position_id` and widened CHECK migration, `packages/chess/src/repertoire-graph.ts` (transpositions, cycle rejection). Satisfies repertoire / Repertoire trees per colour, Transpositions. [T]
- [ ] P2-b Repertoire router and builder UI: `routers/repertoire.ts` (list, create, rename, delete, get, addMove, deleteMove, setIdeaNote), `features/repertoire/**`, idea notes (one line, max 140 chars), accessible builder with `SanInput`. Satisfies repertoire / Navigate and edit the tree, Idea notes, Accessible builder. [T server, O UI, react-staff]
- [ ] P2-c Repertoire cards and left-repertoire flag (BLOCKED on design refresh): cards only where side to move equals repertoire colour, queue hydration, deviation function in `packages/chess`, `addLineFromGame`. Satisfies repertoire / Repertoire cards, Left-repertoire flag. [T]
- [ ] P2-d Opening explorer: `packages/lichess` explorer endpoint, server LRU cache with stale-serve in the `LichessPort` adapter (`apps/server`), `ratingBandFor` and `FALLBACK_EXPLORER_BAND` in `packages/chess/src/explorer-band.ts`, `explorer_band_offset` setting, UI stats beside candidate moves with accessible text. Satisfies opening-explorer / all requirements. Depends on S0.7 explorer-auth finding. [T server, O UI, react-staff]
- [ ] P2-e Export coverage: extend `exportUserJson` with repertoires, positions, moves, idea notes; the S11a meta-test must pass. Satisfies data-control / Export all personal data. [T]

## Phase 3: Blindfold drills and voice input (coarse)

Deferred note: voice move input detail (speech-to-SAN grammar, recogniser configuration, confidence and ambiguity handling) and the voice privacy notice (wording, placement, consent shown before first microphone use) are NOT designed. A design refresh MUST happen before slice P3-d starts. Fixed seams only: `features/voice-input`, `parseMove` for legality, feature-detected, typed SAN always present.

- [ ] P3-a Drills schema: `packages/db/src/schema/drills.ts` (drill per failed item, drill_session), `card.drill_id` and widened CHECK migration, `packages/chess/src/drill-items.ts` (stable `item_key`s). [T]
- [ ] P3-b Drills router: `drills.start`, `finish` (upsert drill and card per failed item, `ON CONFLICT DO NOTHING`), `abandon`, `history`, `DRILL_ABANDON_AFTER_MS` handling, drills excluded from best depth when abandoned. Satisfies blindfold-drills / Drill sessions recorded, Drill results feed cards. [T]
- [ ] P3-c Coordinates, square colour and replay drills UI with peek counting, mobile and accessible. Satisfies blindfold-drills / Coordinates drill, Square colour drill, Replay drill with peek counting, Mobile and accessible drills. [O, react-staff]
- [ ] P3-d Voice move input (BLOCKED on design refresh): `packages/chess/src/spoken-move.ts`, `features/voice-input/**`, privacy notice. Satisfies voice-move-input / all requirements. [T pure, O UI, react-staff]
- [ ] P3-e Engine blindfold drill: strength levels via `UCI_LimitStrength/UCI_Elo` or `Skill Level` (range from S0.8), `ENGINE_STRENGTH_LEVELS`, `ENGINE_DRILL_MOVETIME_MS`. Satisfies blindfold-drills / Engine blindfold, engine-runtime / Engine strength control. [O, react-staff]
- [ ] P3-f Export coverage for drills and drill sessions; meta-test must pass. [T]

## Phase 4: Progress and mistake filters (coarse)

- [ ] P4-a Mistake filters: `mistakes.list` filters (opening, phase, time pressure, combined with URL state), UI usable on mobile and by keyboard. Satisfies mistake-filters / all requirements. [T server, O UI, react-staff]
- [ ] P4-b Progress dashboard server: `routers/progress.ts` with streak, accuracy per pillar, repeat-mistake rate trend (uses `(user_id, position_key, played_uci)` index), weakest openings (`WEAKEST_OPENINGS_RULE`), blindfold best depth, heatmap; `progress-config.ts`. Satisfies progress / all requirements except UI. [T]
- [ ] P4-c Progress UI: charts and heatmap, accessible text alternatives, mobile layout. Satisfies progress / Data from the user only, usable on mobile. [O, react-staff]

---

## Open Decisions That Block Later Slices

| Decision                                                                                            | Blocks                                                                          | Owner action                                                                      |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Server hosting (ADR-22: A recommended, B, C) and Dockerfile pnpm@11 vs pnpm 12 alignment            | First tester release (not Phase 1 implementation)                               | Owner chooses; align Dockerfile before first deploy                               |
| Email sign-in beside Lichess (PRD open question; `emailSignUp` flag default off)                    | S7 sign-in UI wiring (default off keeps it unblocked); account UI scope in S11b | Owner decides; reversible default in place                                        |
| Tester gating: separate environment plus flags (assumed) vs per-user allowlist (adds admin surface) | First tester release                                                            | Owner decides; allowlist would add a slice                                        |
| Stockfish GPL launch gate (licensing reading confirmed)                                             | Public launch                                                                   | Owner confirms reading (not legal advice); S9a ships licence page and source link |
| Left-repertoire deviation algorithm design refresh                                                  | P2-c                                                                            | Design refresh before Phase 2 starts                                              |
| Voice move input and privacy notice design refresh                                                  | P3-d                                                                            | Design refresh before Phase 3 starts                                              |
| PRD defaults (explorer band, carded eval-loss threshold, first import window)                       | Reversible config constants only                                                | Revisit with tester data                                                          |

## Spec Coverage Check (capability to slice)

| Capability       | Slices                 |
| ---------------- | ---------------------- |
| lichess-account  | S3, S4b, S11b          |
| game-import      | S4a, S4b, S10          |
| engine-runtime   | S0, S9a, S9b, P3-e     |
| mistake-analysis | S1a, S1b, S2, S9b      |
| review-queue     | S2, S5a, S5b, S8       |
| chess-board      | S6, S0 spike           |
| app-shell        | S7, S12                |
| data-control     | S11a, S11b, P2-e, P3-f |
| repertoire       | P2-a, P2-b, P2-c       |
| opening-explorer | S4a (gate), P2-d       |
| blindfold-drills | P3-a, P3-b, P3-c, P3-e |
| voice-move-input | P3-d                   |
| mistake-filters  | P4-a                   |
| progress         | P4-b, P4-c             |
