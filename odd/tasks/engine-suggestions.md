# Feature: Engine suggestions in the repertoire builder — T5 next; in-browser check pending

- **Source:** user request 2026-10-24: "for the repertoire preparation use as reference chess.com and lichess and include the use of stockfish for suggestion similar [to] that webapp". New scope: the PRD and `openspec/changes/chess-lab-v1/tasks.md` have no engine-in-builder requirement.
- **Branch:** T1 on `feat/engine-suggestions`, branched from `main` at `0a7c9bf`. Each later task Tn gets `feat/engine-suggestions<n>`, branched from the previous task's last commit. T3 is split across `p3` and `p3b`, so T4 branches from `feat/engine-suggestions3b`.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from P2-b and P2-d), one PR per task. Forecast is about 1,250 authored changed lines: T1 about 250, T2 about 300, T3 about 400, T4 about 300.
- **TDD:** source is `openspec/config.yaml` (`strict_tdd: false`; TDD for server/API and pure logic).
  - TDD is on for T1 and T2.
  - T3 and T4 use TDD for pure `lib/` helpers and ordinary checks for components.
  - Runner: `bun test`.
- **Review (RDD):** user policy is groups of two with auto-consent.
  - Groups: T1+T2 (base `0a7c9bf`), then T3+T4.
  - Untracked `.codegraph/` needs `--untracked-scope=exclude --expected-untracked-inventory=<sha from status>`.

## Objective

While building a repertoire, show Stockfish suggestions for the current position, the way the Lichess and chess.com analysis boards do. That means an on/off toggle, an eval bar beside the board, the top engine lines with score and depth, and a best-move arrow on the board. Any suggested first move can be added to the repertoire. Stockfish runs in the browser, and the builder keeps working when the engine is off or unavailable.

## Problem and why

The explorer shows what people play, not what is sound. Lichess and chess.com pair the explorer with a live engine, so a player can check a candidate move before committing it to a repertoire. Chess Lab already runs Stockfish in the browser for game analysis (NFR-01), so the builder can reuse it at no server cost.

## Decisions

- **User, 2026-10-24: engine panel only.** Local Stockfish only, so there is no Lichess cloud eval, no Masters database and no per-move engine eval in the explorer table. Those stay possible follow-ups.
- **Defaults, all reversible:**
  - The panel is on by default. The toggle is remembered per browser in `localStorage`, with every access wrapped in try/catch; it is a per-viewer convenience, not a setting.
  - It shows 3 lines (`SUGGESTION_LINES`) and searches to depth 18 (`SUGGESTION_DEPTH`). Progress is shown live as the depth grows, like both sites.
  - Suggestion jobs use `interactive` priority, so they pre-empt the background game analysis on the shared worker. That analysis resumes once the suggestion search ends.
  - Each line is shown in SAN with move numbers, truncated to 8 plies (`SUGGESTION_PV_PLIES`).
  - Scores are shown from White's side, like both sites: `+0.34`, `-1.20`, `#3`, `#-2`.
  - The eval bar uses the Lichess win-chance curve, `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`. A mate counts as 100 or 0, and the bar follows the board orientation.
  - The best-move arrow is the first move of line 1, drawn in a colour distinct from idea-note arrows.
  - The repertoire pillar flag already gates the builder; there is no new flag.

## Scope

- **In:**
  - `apps/web/src/features/engine/**`: MultiPV in the queue and job request, config constants, and public API exports.
  - `apps/web/src/features/repertoire/**`: engine view helpers, the suggestion state, the `useEngineSuggestions` hook, the presentational `EnginePanel` and `EvalBar`, the builder wiring, stories, `tests/lib/app-story-registry.ts` entries and tests.
  - Docs: `docs/architecture/web-app.md`, engine section.
- **Out:**
  - Lichess cloud eval
  - Masters or player databases
  - Engine evals inside the explorer table
  - Threat mode
  - Infinite analysis
  - Server or API changes
  - DB migrations

## Constraints

- The engine stays an unmodified, separate, lazy-loaded worker (NFR-08, ADR-11). Nothing new loads it before the panel asks for a suggestion.
- Game analysis must behave exactly as before. Every job sends `MultiPV`, and jobs without `multiPv` reset it to 1, the same way strength options are reset.
- The web app follows container/presentational. Every presentational component has a story and a registry entry.
- Features import each other only through their public API (`@/features/engine`); `.oxlintrc.json` enforces this.
- Scores and lines are text, never colour alone. The eval bar is decorative (`aria-hidden`) because the same score is in the text. Depth updates do not flood screen readers. Keyboard use works, and the layout works at 375 px.
- About 400 authored lines per task is a planning heuristic, not a cap.

## Tasks

- [x] **T1 — MultiPV in the engine runtime** [T]: Branch `feat/engine-suggestions`. Route: delegated writer (`engine-queue.ts` and its tests, plus `uci.ts` and `index.ts`; 2+ non-trivial files).
  - `EngineJobRequest.multiPv?: number`. The queue sends `setoption name MultiPV value <multiPv ?? 1>` before every job, next to the strength options.
  - `EngineInfo` and `EngineResult` gain `lines: EngineLine[]` (`{ multipv, depth, score, pv }`): the latest info per index, sorted by index. `depth`, `score` and `pv` still come from line 1, so existing callers are unchanged.
  - `onProgress` fires on every info line with the updated snapshot. Secondary lines no longer get dropped, but they still never replace line 1's score.
  - Export `EngineLine` and `EngineInfo` from `@/features/engine`.
  - Tests: MultiPV is sent and reset; lines are collected per index; line 1 drives `score`; game-analysis command sequences are unchanged apart from the MultiPV reset.
- [x] **T2 — Engine view helpers** [T]: Branch `feat/engine-suggestions2`. Route: delegated writer (`react-staff`; pure `lib/` module and tests).
  - In `apps/web/src/features/repertoire/lib/engine-view.ts`: White-side score from the FEN's side to move, `formatScore`, an accessible `describeScore`, `winPercent` (Lichess curve, mate clamps), `pvToSan` (move-numbered SAN via `parseMove` from `@b2c-template/chess`; stops at the first illegal move; plies limit), `bestMoveArrow` and an `inRepertoire` mark for each line's first move.
  - Engine constants `SUGGESTION_LINES`, `SUGGESTION_DEPTH` and `SUGGESTION_PV_PLIES` live in the engine `config.ts` and are exported from its public API.
  - Reuse `moveLabel` and `formatEval` ideas from `features/mistakes/lib/mistake-format.ts` only through copying the pattern, never through a cross-feature internal import.
- [x] **T3 — Suggestion hook and engine panel** [T lib, O UI]: Branches `feat/engine-suggestions3` (fix, state and hooks) and `feat/engine-suggestions3b` (UI). Route: delegated `react-staff`.
  - A pure reducer for the suggestion state (`off | starting | analysing{depth, lines} | done{depth, lines} | unavailable | terminal`), with tests.
  - `useEngineSuggestions(fen, enabled)` calls `engine.analyse({ fen, limit: { depth: SUGGESTION_DEPTH }, priority: "interactive", multiPv: SUGGESTION_LINES, onProgress })`. It cancels on a position change, when toggled off and on unmount, and ignores `EngineJobCancelledError`.
  - A `useEngineToggle` preference, backed by `localStorage` inside try/catch and defaulting to on.
  - Presentational `EnginePanel`: the toggle, depth as text, lines with score and SAN, an Add button for a first move not yet in the repertoire (an "In repertoire" badge otherwise), unavailable with Retry, and a "no legal moves" state.
  - Presentational `EvalBar`, plus stories, registry entries and SSR tests.
  - From the T1+T2 review: R3-multipv-nan and R3-stopping-lines-unproved, in their own `fix(web)` commit.
- [x] **T4 — Builder wiring** [T lib, O UI]: Branch `feat/engine-suggestions4`. Route: delegated `react-staff`.
  - Mount the eval bar beside the board and the panel in the builder view. The best-move arrow is merged with the idea-note arrows.
  - Add a suggested move through the existing `playMove` and `addMove` flow.
  - Update builder view stories and tests, and the engine section of `docs/architecture/web-app.md`.
  - Manual check in the local dev app (web on port 4000): lines deepen, the arrow follows line 1, Add works, the toggle is remembered, and game analysis resumes afterwards. This session has no browser automation, so the writer runs `pnpm --filter web build` and confirms the worker is not in the main bundle. The in-browser check goes to the user.
  - From T3: pass `maxDepth: SUGGESTION_DEPTH` and `maxPlies: SUGGESTION_PV_PLIES` into `toEngineView` from the container. The constants come from `@/features/engine` in the container, not in a `lib/` module.

- [ ] **T5 — Review follow-ups (hook, toggle and bar tests)** [T]: Branch `feat/engine-suggestions5`. Route: delegated `react-staff`. Added after the T3+T4 review at the user's request; it is reviewed alone. Forecast is about 250 lines.
  - R3-suggestion-hook-unproved: move the search logic of `useEngineSuggestions` into a pure controller in `lib/` with injected engine and frame functions, the same pattern as `createAnalysisRun` and `useGameAnalysis`. Test cancel on a FEN change, toggle-off and close; the ignored `EngineJobCancelledError`; other errors leading to `failed`; one dispatch per frame; and the pending frame dropped on finish or close. The hook becomes a thin binding.
  - R3-toggle-fallback-unproved: move the toggle store (snapshot, subscribe, fallback, notify) into a testable unit with an injected storage. Test that the choice is kept when writes fail and that subscribers are notified.
  - R3-evalbar-nonfinite: guard `clampPercent` with `Number.isFinite`, falling back to 50, and test it.

## Acceptance criteria

- On a builder position with the panel on, up to 3 lines appear and deepen to depth 18, with White-side scores and SAN. The eval bar and the best-move arrow follow line 1.
- Add on a suggested first move adds it to the repertoire and moves to the new position. A first move already in the repertoire is marked instead.
- Turning the panel off stops the search, hides the bar and the arrow, and is remembered after a reload.
- When the engine is unavailable, the panel says so and offers Retry; the rest of the builder works.
- Game analysis commands are unchanged apart from the explicit `MultiPV 1`. Background analysis still completes.
- All standard checks pass.

## Checks

- **Focused:**
  - T1: `bun test apps/web/src/features/engine`
  - T2: `bun test apps/web/src/features/repertoire/lib apps/web/src/features/engine`
  - T3 and T4: `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`
- **Standard:** `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check`, `bun test`. Run `pnpm db:test:prepare` first for the DB suites.

## Progress

- 2026-10-24: Feature document created after exploration and one user decision (engine panel only). Next: T1.
- 2026-10-24 T1 done (route: delegated writer, 7 files, all inside `features/engine`).
  - RED: `bun test apps/web/src/features/engine` -> `SyntaxError: Export named 'buildMultiPvOption' not found` (85 pass, 12 fail, 1 error).
  - GREEN: 119 pass, 0 fail (parent re-ran: 119 pass).
  - `pnpm check`, `pnpm --filter web check-types` and `pnpm check-types` exit 0. The first type check failed on `EngineResult` fixtures missing `lines`; they were fixed before the commit. After `pnpm db:test:prepare`, the full `bun test` gives 2016 pass, 0 fail.
  - `buildMultiPvOption(multiPv)` in `uci.ts` floors the value and keeps it at least 1. The queue sends it after the strength options and before `position` and `go` on every job.
  - `EngineLine` is `{multipv, depth, score, pv}`. `lines` holds the latest line per index, sorted; line 1 alone drives `depth`, `score` and `pv`.
  - `onProgress` fires on every accepted line once line 1 exists. A pre-emption clears the lines.
  - `EngineInfo` and `EngineLine` are exported from `@/features/engine`.
  - Commit `9fa6983` (224 authored lines). Review: pending with T2. Next: T2.
- 2026-10-24 T2 done (route: delegated `react-staff`, 4 files).
  - RED: `bun test apps/web/src/features/repertoire/lib/engine-view.test.ts` -> `error: Cannot find module './engine-view'` (0 pass, 1 fail, 1 error).
  - GREEN: 36 new tests. The focused run gives 236 pass, 0 fail (parent re-ran: 236 pass).
  - `pnpm check`, `pnpm --filter web check-types` and `pnpm check-types` exit 0. After `pnpm db:test:prepare`, the full `bun test` gives 2049 pass, 0 fail.
  - The engine config gets `SUGGESTION_LINES` (3), `SUGGESTION_DEPTH` (18) and `SUGGESTION_PV_PLIES` (8), exported from the public API.
  - `lib/engine-view.ts`:
    - `WhiteScore` and `toWhiteScore`. Mate 0 means the side to move is mated.
    - `formatScore`; mate 0 is `#0`, never `#-0`.
    - `describeScore`, for example "White is better by 0.34 pawns", "Even position", "Black mates in 2" or "Checkmate".
    - `winPercent` on the Lichess curve, with cp clamped to ±1000.
    - `pvToSan` returns `{sans, text}`. A bad fullmove field counts as 1.
    - `bestMoveArrow`.
    - `toSuggestionLines` returns `SuggestionLine` (`multipv`, `depth`, `white`, `scoreText`, `scoreLabel`, `firstMove`, `moveText`, `inRepertoire`) and drops lines whose first move is illegal.
  - Commit `fbd2814` (424 authored lines, about 290 of them tests). Next: the T1+T2 review.
- 2026-10-24 Review T1+T2 (`0a7c9bf` to `366ba95`, lineage `review-a20d596a65961bfa`), medium risk, auto-consent granted, 1 lens (reliability): APPROVED and acknowledged. Next review boundary: `366ba95`.
  - Accepted into T3 as technical fixes, with no user-visible scope change:
    - R3-multipv-nan (WARNING): `buildMultiPvOption` lets `NaN` and `Infinity` through, because `Math.max(1, NaN)` is `NaN`. Guard with `Number.isFinite`, fall back to 1, and test it.
    - R3-stopping-lines-unproved (SUGGESTION): the "lines from a stopping search are ignored" test only checks the rejection. Prove that no `onProgress` call and no stale line follow a stop, through the pre-empt path.
- 2026-10-24 T3 done (route: delegated `react-staff`, 17 files).
  - Fixes, commit `1cb5fda` (46 lines):
    - RED for R3-multipv-nan: `Expected: "setoption name MultiPV value 1"`, `Received: "...value NaN"` (23 pass, 1 fail). GREEN: 56 pass.
    - The new pre-empt test for R3-stopping-lines-unproved passed against the current code. With the `stopReason !== null` guard temporarily removed, it failed (31 pass, 1 fail), so it is meaningful. The guard was then restored.
  - Lib TDD:
    - RED: `Cannot find module './suggestion-state'`. GREEN: 21 tests.
    - Deviation: `engine-preference.ts` was written together with its 4 tests, so there is no separate RED.
  - The focused run gives 354 pass, 0 fail (parent re-ran: 354 pass). `pnpm check`, `pnpm --filter web check-types` and `pnpm check-types` exit 0. After `pnpm db:test:prepare`, the full `bun test` gives 2091 pass, 0 fail.
  - `lib/suggestion-state.ts`:
    - The states are `off | starting | analysing | done | unavailable | terminal`, each carrying `{job, fen}`.
    - The reducer accepts progress, finished and failed events only for the current `job`.
    - `toEngineView({state, fen, enabled, childMoves, maxDepth, maxPlies})` returns `{panel, whitePercent, arrow}`. A state for another FEN counts as starting.
    - The limits are inputs: importing the constants from `@/features/engine` under `bun test` loads `orpc` and fails on `VITE_SERVER_URL`.
  - `useEngineSuggestions(fen, enabled)` returns `{state, retry}`. Progress is coalesced to one update per animation frame, and the hook has no automated test.
  - `useEngineToggle()` uses `useSyncExternalStore`: the key is `chess-lab:repertoire:engine-suggestions` (`on`/`off`), the default is on, and the server snapshot is `true`.
  - `EnginePanel`:
    - A Base UI `Switch` inside a native label, "Stockfish".
    - Score text is `aria-hidden`, with the sr-only `scoreLabel` beside it.
    - "Add <san>" is disabled while `addPending`; a first move already in the repertoire gets an "In repertoire" badge instead.
    - One polite status announces only "Analysis finished at depth N." or "The engine is unavailable."
  - `EvalBar` is `aria-hidden`, `w-4` and `h-full`, and follows the orientation; null gives 50%.
  - Size and slicing (`auto-chain`):
    - The writer's single commit `dbfdc08` held 1,027 lines: about 400 tests, 200 stories and fixtures, and 400 source. The parent split it by tree, and the final tree is identical (`7497011`).
    - Part A `ba90624` on `p3` holds the state, the preference and the hooks: 591 lines, about 300 of them tests. With the UI files set aside, `pnpm --filter web check-types` exits 0 and the focused run gives 339 pass. Recommend `size:exception` for that PR, since its test share is over half.
    - Part B `39118de` on `p3b` holds the panel, the bar, stories, fixtures and the registry: 436 lines.
  - Review: pending with T4. Next: T4.
- 2026-10-24 T4 done (route: delegated `react-staff`, 9 files).
  - TDD for the new `lib/board-arrows.ts` (`mergeBoardArrows`): RED was `Cannot find module './board-arrows'` (0 pass, 1 fail, 1 error); GREEN is 6 pass.
  - The focused run gives 364 pass, 0 fail (parent re-ran: 364 pass). One SSR test was changed to assert the board label text, because SSR markup carries no arrows.
  - `pnpm check`, `pnpm --filter web check-types` and `pnpm check-types` exit 0. After `pnpm db:test:prepare`, the full `bun test` gives 2101 pass, 0 fail.
  - `pnpm --filter web build` succeeds. `dist/engine/` holds the unmodified worker files. Outside them, "stockfish" appears only as the panel's UI text and in the existing lazy engine-client chunk (UCI, queue, `new Worker`), with no engine code in the main bundle.
  - Container: the toggle and suggestion hooks run before the early returns. The search is enabled only when the panel is on and the position's FEN is known. The empty FEN is never sent. `toEngineView` gets `SUGGESTION_DEPTH` and `SUGGESTION_PV_PLIES`. Add reuses `playMove`, and `addPending` is `isSaving`.
  - View:
    - An `EvalBar` (`w-4`) sits beside the board in a flex row. It is hidden when the panel is off and neutral while starting.
    - The `EnginePanel` card is at the top of the side column, above "Current line" and the explorer.
    - The engine arrow uses the new `boardTheme.engineArrow` (`#4da3ff`), is drawn last, and is also described in the board label ("Engine best move: e2 to e4.").
  - New stories: `EngineOff`, `EngineAnalysing`, `EngineUnavailable` and `EngineWithIdeaNote`. The default args have the engine on.
  - `docs/architecture/web-app.md`: the engine section now covers the builder suggestions.
  - Commit `86e9db0` (234 authored lines).
  - Pending (user): the in-browser check, because this session has no browser automation. It covers deepening lines, the arrow following line 1, Add, the toggle surviving a reload, game analysis resuming, and the layout at 375 px.
  - Review: T3+T4 next.
- 2026-10-24 Review T3+T4 (`366ba95` to `d44caa6`, lineage `review-7176f5d405f3066e`), medium risk, 1,364 changed lines, auto-consent granted, 1 lens (reliability): APPROVED and acknowledged. Next review boundary: `d44caa6`.
  - Advisory findings, all non-blocking and not yet accepted:
    - R3-suggestion-hook-unproved (WARNING): `useEngineSuggestions` has no automated test. Unproved behaviour:
      - it cancels on a FEN change, on toggle-off and on unmount;
      - it ignores `EngineJobCancelledError`;
      - other errors make it `unavailable`;
      - progress is coalesced to one dispatch per frame, and a pending frame is dropped on finish or close.
    - R3-toggle-fallback-unproved (SUGGESTION): the toggle's in-memory fallback when storage refuses writes, and the subscriber notification on `setEnabled`, are untested.
    - R3-evalbar-nonfinite (SUGGESTION): `clampPercent` passes `NaN` through as `height: NaN%`. Guard it with `Number.isFinite`, falling back to 50.
  - Asked the user whether to fix these now as T5.
  - User, 2026-10-24: "Fix now as T5".
