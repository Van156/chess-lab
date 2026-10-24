# Feature: Opening explorer (chess-lab-v1 P2-d)

- **Source:** user request 2026-10-24, "start with the next one" after P2-e. Slice P2-d of `openspec/changes/chess-lab-v1/tasks.md` (line 310). Spec: `openspec/changes/chess-lab-v1/specs/opening-explorer/spec.md` (L9-77). Design: `design.md` ADR-09 (L232-253, S0.7 amendment L247, cache L249), the ADR-18 constants (L463-469), `user_settings.explorer_band_offset` (L139), `repertoire.explorer` (L492), `LichessPort.explorer` (L496). S0.7 facts: `openspec/changes/chess-lab-v1/notes/s0-verification.md` L25-31.
- **Branch:** T1 on `feat/chess-lab-v1-p2d`, branched from `feat/chess-lab-v1-p2e` at `bbc9228`. Each later task Tn gets `feat/chess-lab-v1-p2d<n>`, branched from the previous task's last commit. T3 is split across `p2d3` and `p2d3b`, and T5 across `p2d5` and `p2d5b`; the next task branches from the `b` branch.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from P2-b), one PR per task. Forecast is about 1,800 authored changed lines: T1 about 150, T2 about 300, T3 about 300, T4 about 350, T5 about 400, T6 about 300.
- **TDD:** source is `openspec/config.yaml` (`strict_tdd: false`; TDD for server/API and pure logic).
  - TDD is on for T1-T4.
  - T5 and T6 use TDD for pure `lib/` helpers and ordinary checks for components.
  - Runner: `bun test`.
- **Review (RDD):** user policy is groups of two with auto-consent.
  - Groups: T1+T2 (base `bbc9228`), T3+T4, then T4b+T5 and T6 alone (T4b was added after the T3+T4 review).
  - Untracked `.codegraph/` needs `--untracked-scope=exclude --expected-untracked-inventory=<sha from status>`.

## Objective

In the repertoire builder, show Lichess opening explorer stats for the current position: each move's game count and W/D/L as text. The rating band in use is visible and the user can adjust it inline. Any explorer move can be added to the repertoire. The builder keeps working when stats are missing or unavailable. Everything sits behind the `repertoire` pillar flag.

## Problem and why

Building a repertoire without data means guessing which replies matter. The spec (FR-05, NFR-04/05/06) asks for explorer stats beside candidate moves, a single rating-band rule, server-side throttled and cached requests that never expose the token, and accessible stats.

## Decisions

- **User, 2026-10-24: explorer list with Add.** A separate table for the current position lists the moves Lichess has played there, with games and W/D/L as text. Moves already in the repertoire are marked (joined by SAN, which is unique within one position). An Add button reuses `addMove`.
- **User, 2026-10-24: inline band offset.** The panel shows the band and has a select from 2 bands below to 2 above (`explorer_band_offset`, -2..+2 bucket steps). It saves through `settings.update`. The resulting band is clamped to the bucket list ends (0 and 2500).
- **Defaults from the design, all reversible:**
  - The `repertoire` pillar flag gates the explorer; there is no new flag.
  - Only the Lichess database is queried (`explorer.lichess.org/lichess`; no masters or player database; no `play`, `since` or `until`).
  - The band is one Lichess rating bucket (0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500). The own band is the largest bucket at or below the rating of the perf with the most games among blitz, rapid and classical.
  - Request speeds are those same three.
  - `FALLBACK_EXPLORER_BAND` is 1600. It applies when no non-provisional rating with games exists, and the offset applies to it too.
- **Cache:**
  - A hand-written in-process TTL+LRU lives in `apps/server`; `packages/lichess` stays stateless and no dependency is added.
  - The key is `positionKey|band|speeds`, shared across users.
  - TTL is 24 h and capacity is 5000 entries. Concurrent misses for one key share one in-flight promise.
  - On a 429 or error, a stale entry up to 7 days old is served with `stale: true`. Otherwise the result is "unavailable".
- **No token:** a missing or unusable token (including email-only accounts) maps to `LichessUnauthorized`. The panel then shows "unavailable" with a hint to sign in with Lichess again (ADR-09).
- **Rating snapshot:** `lichess_profile.rating_snapshot` is captured at sign-in and can go stale; v1 accepts that.

## Scope

- **In:**
  - `packages/chess/src/explorer-band.ts`
  - `packages/lichess` `explorer()` params and config constants
  - `apps/server` explorer cache and the `LichessPort.explorer` adapter (token resolver extracted from `services.ts`)
  - `packages/api` `Context` type, the `repertoire.explorer` procedure, and the `settings.update` `explorerBandOffset` field
  - Under `apps/web/src/features/repertoire/**`: the explorer panel, hooks, Add action, band select, stories, registry entries and tests
- **Out:**
  - Masters and player databases
  - Refreshing `rating_snapshot`
  - An account settings page
  - Explorer outside the builder
  - Cards (P2-c)
  - Any DB migration (the `explorer_band_offset` column already exists)

## Constraints

- Router conventions: `featureProcedure("repertoire")`; every query scopes input ids by `context.session.user.id`; zod 4; `ORPCError`.
- The token never reaches the browser.
- Explorer calls go through the per-token `SerialGate`. A cache hit does not take the gate.
- Web follows container/presentational. Every presentational component has a story and a `tests/lib/app-story-registry.ts` entry.
- Stats are text, never colour alone; keyboard use works without drag; the layout works at 375 px.
- About 400 authored lines per task is a planning heuristic, not a cap.

## Tasks

- [x] **T1 — Rating band rule** [T]: `packages/chess/src/explorer-band.ts` + test + `index.ts` export. Branch `feat/chess-lab-v1-p2d`. Route: delegated writer (2 non-trivial files).
  - Constants: `EXPLORER_RATING_BUCKETS`, `FALLBACK_EXPLORER_BAND = 1600`, `EXPLORER_BAND_SPEEDS = ["blitz","rapid","classical"]`, `EXPLORER_BAND_OFFSET_MIN = -2`, `EXPLORER_BAND_OFFSET_MAX = 2`.
  - `ratingBandFor(perfs, offset = 0)`, where `perfs` is a perf snapshot with `{rating?, games?, prov?}`.
- [x] **T2 — Explorer client params and cache** [T]: Branch `feat/chess-lab-v1-p2d2`. Route: delegated writer.
  - `packages/lichess`: `explorer()` sends `moves`, `topGames=0` and `recentGames=0`; config gets `EXPLORER_CACHE_TTL_MS` (24 h), `EXPLORER_CACHE_MAX_ENTRIES` (5000) and `EXPLORER_STALE_MAX_MS` (7 d); tests for params, a 429 and move parsing.
  - `apps/server/src/explorer-cache.ts`: pure TTL+LRU with injectable clock, in-flight dedupe and stale-serve, with tests.
- [x] **T3 — `LichessPort.explorer` adapter** [T]: Branches `feat/chess-lab-v1-p2d3` (part A) and `feat/chess-lab-v1-p2d3b` (part B). Route: delegated writer.
  - From the T1+T2 review: fail fast on a 429 while respecting the gate pause; an adapter deadline that serves stale or "unavailable" while the load continues; a stale lookup on the cache; a concurrent-waiters test.
  - `Context` `LichessPort.explorer(userId, {positionKey, fen, band, speeds})` returns `{status:"ok", stats, stale} | {status:"unavailable", reason:"unauthorized"|"rate_limited"|"error"}`.
  - The adapter checks the cache before the gate and serves stale on 429 or error. The token resolver is extracted from `services.ts`.
  - Tests in `lichess-port.test.ts`; fix the other `Context["lichess"]` fakes.
- [x] **T4 — `repertoire.explorer` and band offset setting** [T]: Branch `feat/chess-lab-v1-p2d4`. Route: delegated writer.
  - Input `{repertoireId, positionId}`, owned by the caller. The procedure reads the position FEN and key, `rating_snapshot` and `explorerBandOffset`, then computes `ratingBandFor`.
  - It returns `{band, offset, speeds, result}` with moves mapped to `{san, uci, games, white, draws, black}`.
  - `settings.update` accepts `explorerBandOffset` (int, -2..+2, bounds from T1).
  - Tests in `repertoire.test.ts` (fake port; flag off gives `NOT_FOUND`; ownership) and `settings.test.ts`.
- [x] **T4b — Explorer review fixes** [T]: Branch `feat/chess-lab-v1-p2d4b`. Route: delegated writer (2-3 non-trivial server files).
  - (a) R3-shared-inflight-token-failures: the cache's in-flight dedupe is keyed per user (an `inflightKey` option or similar) while the stored value stays under the shared key. Add a cross-user test: A's in-flight load fails with a 401 while B's concurrent request uses B's token and gets ok.
  - (b) R3-vacuous-unauthorized-cache-test: build both ports on one shared cache instance, so an unlinked user is proved to get `unauthorized` for a cached position.
- [x] **T5 — Explorer panel (read-only)** [T lib, O UI]: Branches `feat/chess-lab-v1-p2d5` (helpers) and `feat/chess-lab-v1-p2d5b` (UI). Route: delegated `react-staff`.
  - `lib/` helpers: W/D/L percent text, in-repertoire mark by SAN, band label.
  - Presentational `ExplorerPanel`: a table with the band label; states for loading, empty ("no games recorded"), unavailable (with a reason and a Lichess sign-in hint for unauthorized) and stale.
  - `use-explorer` hook and container wiring in the builder page.
  - Stories, registry entries and SSR tests.
- [ ] **T6 — Add from explorer and inline band select** [T lib, O UI]: Branch `feat/chess-lab-v1-p2d6`. Route: delegated `react-staff`.
  - An Add button on explorer moves not in the repertoire, through the existing `addMove` flow.
  - A band select from -2 to +2 that labels the resulting band, saves via `settings.update` and refetches the explorer.
  - `repertoire.explorer` also returns `ownBand` (`ratingBandFor(perfs, 0)`), so the select can label each offset correctly, even when the band was clamped at an end.
  - From the T4b+T5 review: `bandLabel` falls back to the bare number for an off-bucket band; the `useExplorer` state mapping becomes a pure tested helper.
  - Stories, registry entries and tests.

## Acceptance criteria

- These spec scenarios are covered by tests (server and pure helpers) or by components with stories:
  - Stats shown
  - Rare or novel position
  - Explorer unavailable
  - Default band, band above, unknown rating
  - Throttled, cache hit
  - Percentages as text
- With the flag off, `repertoire.explorer` returns `NOT_FOUND`.
- No token field reaches the browser.
- All standard checks pass.

## Checks

- **Focused:**
  - T1: `bun test packages/chess/src/explorer-band.test.ts`
  - T2: `bun test packages/lichess apps/server/src/explorer-cache.test.ts`
  - T3: `bun test apps/server/src/lichess-port.test.ts`
  - T4: `bun test packages/api/src/routers/repertoire.test.ts packages/api/src/routers/settings.test.ts`
  - T5 and T6: `bun test apps/web/src/features/repertoire tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`
- **Standard:** `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check`, `bun test`. Run `pnpm db:test:prepare` first for the DB suites.

## Progress

- 2026-10-24: feature document created after mapping, along with the two user decisions above. Next: T1.
- 2026-10-24 T1 done (route: delegated writer, 2 non-trivial files plus `config.ts` and `index.ts`).
  - RED: `bun test packages/chess/src/explorer-band.test.ts` -> `error: Cannot find module './explorer-band'` (0 pass, 1 fail, 1 error).
  - GREEN: 12 pass, 0 fail (parent re-ran: 12 pass).
  - `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1877 pass, 0 fail.
  - Constants live in `packages/chess/src/config.ts` (ADR-18). `ratingBandFor` and `PerfSnapshot` are exported from `index.ts`.
  - A `NaN` offset counts as 0; `±Infinity` is clamped to the offset range.
  - Commit `083ede9` (162 authored lines). Review: pending with T2. Next: T2.
- 2026-10-24 T2 done (route: delegated writer, 6 files).
  - RED: `bun test packages/lichess apps/server/src/explorer-cache.test.ts` -> `SyntaxError: Export named 'EXPLORER_MOVES' not found` and the missing `explorer-cache.ts` (16 pass, 2 fail, 2 errors).
  - GREEN: 51 pass, 0 fail (parent re-ran: 51 pass).
  - `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1891 pass, 0 fail.
  - `explorer()` also sends `moves=12` (`EXPLORER_MOVES`), `topGames=0` and `recentGames=0`.
  - Cache constants are in `packages/lichess/src/config.ts`.
  - `createExplorerCache<T>({ ttlMs, staleMaxMs, maxEntries, now })` returns `get(key, load) -> { value, stale }`: a Map-order LRU with in-flight dedupe and stale on load failure; the loader's error is rethrown otherwise.
  - Not yet wired (T3).
  - Commit `e154910` (300 authored lines).
- 2026-10-24 Review T1+T2 (bbc9228 to 50829a3, lineage review-ec03e63d65e1316d), 1 lens (reliability): APPROVED and acknowledged. Next review boundary: 50829a3.
  - Accepted into T3: R3-stale-after-full-retry (SUGGESTION). The client rejects a 429 only after its 60+120+240 s retries, so stale data on 429 would take minutes, and nothing remembers the failure. The stale path also has no test with concurrent waiters on one failing load.
  - T3 scope grows (technical decision, same user-visible behaviour as the spec's "Explorer unavailable"):
    - Explorer requests fail fast on a 429 (no in-request sleeps), while the backoff still holds: no explorer request is sent during the pause.
    - The adapter waits at most a short deadline. On timeout it serves a stale entry if one exists, otherwise "unavailable". The load keeps running and fills the cache for the next request.
    - This also covers waiting behind a long import on the same per-token gate.
    - The cache gets a stale lookup for that path, plus a concurrent-waiters test.
- 2026-10-24 T3 done (route: delegated writer, 13 files).
  - RED: `bun test apps/server/src/lichess-port.test.ts apps/server/src/explorer-cache.test.ts packages/lichess` -> `SyntaxError: Export named 'createExplorerPort' not found` (62 pass, 1 fail, 1 error).
  - TDD deviation: the writer wrote the gate, client and cache source before their tests. It showed RED afterwards by restoring those three files to HEAD: 4 `peek` tests, 2 gate tests and 3 client fail-fast tests failed with `expect(received).toBeInstanceOf(expected)`.
  - GREEN: 90 pass (parent re-ran: 90 pass).
  - `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1923 pass, 0 fail.
  - Gate and client:
    - `SerialGate.acquire/run(key, ..., { failIfPaused })` throws `LichessRateLimited(pausedUntil)` on entry and after the previous holder.
    - `send(..., failFast)` still sets the gate backoff, then throws without sleeping. Only `explorer()` uses fail-fast; import paths are unchanged.
    - Two old explorer 429 retry tests were replaced by fail-fast tests.
  - `EXPLORER_WAIT_MS = 5000`. `createExplorerPort`:
    - Token first: none or unusable gives `unauthorized`, also on cache hits.
    - It then races `cache.get` against the deadline. On timeout it returns `cache.peek(key)` or `unavailable/timeout`; the background load is caught.
  - `resolveLichessToken` is extracted in `services.ts`. `requireAccessToken` keeps the credential-error mapping in one place. `createLichessPort(service, runner, explorer)`.
  - Size: about 810 authored lines, 500 of them tests, so `auto-chain` split it by tree:
    - Part A `244e82f` on `p2d3` (gate, client and cache stale lookup; 258 lines; tests and types checked alone).
    - Part B `09fd8de` on `p2d3b` (port types, adapter and wiring; 552 lines). That is still over 400 after one slicing pass, because 359 lines are the port tests. Recommend `size:exception` for that PR.
    - The two commits together give the same tree as the original `df3a28a`.
  - Known gap (not blocking): a pause that begins while an explorer request is already sending does not abort it; that request fails fast on its own 429.
  - Review: pending with T4. Next: T4.
- 2026-10-24 T4 done (route: delegated writer, API; 7 files).
  - RED (tests first): `bun test packages/api/src/routers/repertoire.test.ts packages/api/src/routers/settings.test.ts packages/api/src/lib/perf-snapshot.test.ts` -> `Cannot find module './perf-snapshot'`, plus missing `explorer` and `explorerBandOffset` (32 pass, 19 fail, 1 error).
  - GREEN: 64 pass (parent re-ran: 64 pass).
  - `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1955 pass, 0 fail.
  - `repertoire.explorer({repertoireId, positionId})`:
    - Returns `{ band, offset, speeds, result }`, where `result` is either `{status:"ok", stale, totals:{white,draws,black,games}, opening|null, moves:[{san,uci,white,draws,black,games}]}` or `{status:"unavailable", reason}`.
    - The mapping is `explorerView` in the router. `explorerContext` in the repertoire service reads the owned position, the snapshot and the offset without creating a settings row.
  - `lib/perf-snapshot.ts` `parsePerfSnapshot` (zod): malformed input gives null, so the fallback band applies.
  - `settings.update` accepts `explorerBandOffset` as `z.int()` within -2..2.
  - Commit `623bcb1` (343 authored lines).
- 2026-10-24 Review T3+T4 (50829a3 to 6ee9622, lineage review-3b7172f0142d4508), 1 lens (reliability): APPROVED and acknowledged. Next review boundary: 6ee9622.
  - R3-shared-inflight-token-failures (WARNING): the cache is shared and its in-flight load captures the first caller's token. A user who joins it inherits that token's 401 (told to re-link), 429, pause or import wait.
  - R3-vacuous-unauthorized-cache-test (WARNING): the "unauthorized even when cached" test builds the cold port on a fresh cache, so token-before-cache is unproved.
  - User chose "Fix now as T4b" (2026-10-24).
  - Decision: in-flight dedupe becomes per user (`key|userId`) while stored stats stay shared across users. This is a deviation from design L249, which shares one in-flight promise per key across users. Concurrent cold misses from different users now each call Lichess with their own token.
- 2026-10-24 T4b done (route: delegated writer, 4 server files).
  - RED (tests first): `bun test apps/server/src/explorer-cache.test.ts apps/server/src/lichess-port.test.ts` -> 47 pass, 3 fail. The new in-flight-key cache tests failed, and in the cross-user port test B inherited A's 401 (`unauthorized` instead of `ok`).
  - The rewritten (b) test passed in RED, as expected. To prove it meaningful, the writer temporarily read the cache before the token: the test failed (1 fail), then the file was restored.
  - GREEN: 49 pass (parent re-ran: 49 pass).
  - `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1960 pass, 0 fail.
  - `cache.get(key, load, { inflightKey = key })`; the adapter passes `${key}|${userId}`.
  - The old cross-user "one client call" port test was removed as part of the recorded deviation; a same-user dedupe test replaces it.
  - Commit `8b78eac` (206 authored lines). Review: pending with T5. Next: T5.
- 2026-10-24 T5 done (route: delegated react-staff, 13 files).
  - TDD on `lib/` only. RED: `bun test apps/web/src/features/repertoire/lib/explorer-view.test.ts` -> `error: Cannot find module './explorer-view'` (0 pass, 1 fail, 1 error).
  - GREEN: 11 pass. A first run had 1 fail on copy case, so the copy was reworded.
  - Focused run 137 pass (parent re-ran: 137 pass). `pnpm check-types`, `pnpm --filter web check-types` and `pnpm check` exit 0; full `bun test` 1983 pass, 0 fail.
  - `lib/explorer-view.ts`: `shareOf` (largest remainder), `formatGames`, `describeExplorerMove` (en-US), `bandLabel` (next-bucket upper bound), `inRepertoire` (SAN), `unavailableText`, `STALE_NOTE`. Explorer types are in `lib/repertoire-types.ts`.
  - `ExplorerPanel`:
    - Props: `{ state: loading|failed|loaded, childMoves, bandControl?, moveAction? }`. The T6 slots are not used yet.
    - A table with an sr-only caption and `scope=col`; percentages are text, the bar is `aria-hidden`, and "In repertoire" is a text badge.
  - `useExplorer` uses `retry: false`, a 5 min `staleTime` and no placeholder; an error becomes `failed`.
  - The panel is its own Card between "Current line" and the idea note editor.
  - Not verified (needs a browser): 375 px, focus, screen reader.
  - Size: 584 authored lines, so `auto-chain` split it by tree:
    - `fb22391` on `p2d5`: helpers and types, 174 lines; tests and types checked alone.
    - `a9a91e2` on `p2d5b`: panel, hook, wiring, stories and tests, 410 lines. Slightly over 400 after one slicing pass, so recommend `size:exception`.
    - The two commits together give the same tree as the original `db1c43f`.
- 2026-10-24 Review T4b+T5 (6ee9622 to 835ec9f, lineage review-22533db380ec5e86), 1 lens (reliability): APPROVED and acknowledged. Next review boundary: 835ec9f.
  - Folded into T6, which touches the same code:
    - R3-bandlabel-unknown-band: `bandLabel` renders an inverted range for an off-bucket band.
    - R3-use-explorer-mapping-untested: the query-state to panel-state mapping in `useExplorer` is not tested.
  - Pending suggestion: R3-microtask-flush-ordering. The cross-user port test does not assert that both client calls started before gate A rejects.
  - Next: T6.
