# Feature: Rank repertoire continuations by engine evaluation

- **Source:** user request 2026-10-25: "I want to know the order which are the best continuation move". On 2026-10-25 the user chose **engine evaluation** as the ranking measure, over explorer results.
- **Branch:** `feat/repertoire-base-line`. This continues the chain after the base line feature, which is not pushed yet. It starts at `65490c6`.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached). The forecast is about 450–650 authored changed lines.
- **TDD:** source `openspec/config.yaml` (`strict_tdd: false`; TDD for pure logic). Pure `lib/` helpers are written test-first; components get ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Group: T1+T2. First boundary: `65490c6`.

## Objective

Where the repertoire has two or more continuations from a position, show which one the engine thinks is best. Number them best first, show each score, and list them in that order.

## Problem / why

Study lines and alternatives appear in the order they were added. The Engine tab ranks the engine's own top moves, not the user's repertoire moves. A repertoire move outside the engine's top N gets no score at all, so the user cannot tell which of their own continuations is strongest.

## Scope

- **T1: Restricted engine search (engine lib).** An engine request takes an optional `searchMoves: string[]` (UCI). The `go` command appends `searchmoves …`, so Stockfish ranks exactly those moves, using MultiPV equal to their count. Pure UCI helpers are TDD.
- **T2: Continuation ranking in the builder (repertoire web).**
  - When the shown position has two or more stored continuations, run one restricted search on those moves. If a study-line root (base or start) is shown, that root's moves are the ones ranked.
  - The search goes through the shared engine queue, respects the engine on/off toggle, and does not starve the Engine tab's suggestions.
  - Scores are cached per FEN for the session, so forks visited earlier stay ranked.
  - Pure `lib/` helper: `rankContinuations(moves, lines)` returns `{ moveId → rank, scoreLabel }` from the mover's point of view, with tie handling.
  - The tree:
    - Study-line groups and alternative lists are sorted best first wherever scores are known.
    - Each ranked move shows a small "#1 +0.4" badge, and its accessible label says so.
    - The move that continues a line stays where it is, but still shows its rank.
    - Unranked positions keep the stored order.
  - Nothing is saved to the database.

Out of scope:

- Batch-analysing every fork of the repertoire.
- Persisting scores.
- Explorer-based ranking.
- Reordering moves on the server.

## Constraints

- Keep the container/presentational split. Pure logic goes in `lib/` with tests.
- The engine stays the single shared worker. Respect the hidden-tab and pause policies already in `features/engine/lib`.
- Accessibility: rank is never conveyed by colour alone; targets are at least 44px; no horizontal scroll at 375px.
- Update stories for changed components.

## Tasks

- [x] **T1: `searchMoves` in engine requests** [T lib]. Route: delegated `react-staff` together with T2 (same writer, separate commit).
- [x] **T3: Clear stale ranks when a fork's moves change** [T lib, O UI]. Accepted from review R3-stale-ranks-during-research; also strengthen the alternative-sort test (R3-weak-alternative-sort-test). Route: delegated `react-staff`.
- [x] **T2: Rank continuations in the tree** [T lib, O UI]. Route: delegated `react-staff` (hook, lib, tree components; 2+ non-trivial files).

## Acceptance criteria

- With the base set at 3... exd4 and the study lines `4. c3` and `4. Bc4` stored, both groups show a rank and score, the better one listed first.
- At a deeper fork, the alternatives are ranked and sorted the same way.
- Turning the engine off shows no ranks and the stored order.
- All checks below pass.

## Checks

- `pnpm check-types`
- `pnpm check`
- `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`

## Progress

- Feature document created (`ddffa2f`).
- **T1 done** (`a489271`, delegated to `react-staff`; 4 files, +111/-4).
  - `sanitizeSearchMoves` validates the UCI moves and drops duplicates.
  - `buildGo(limit, searchMoves)` appends `searchmoves`. The queue sets MultiPV to the number of moves kept, unless a value is given explicitly. If every move is invalid, the search runs unrestricted.
  - RED: `Export named 'sanitizeSearchMoves' not found`, plus `go depth 12` was sent without `searchmoves`. GREEN: 64 pass.
- **T2 done** (`b65e5e2`, delegated to `react-staff`; 14 files, +531/-7).
  - `lib/continuation-ranking.ts`:
    - `rankContinuations` uses competition ranking for ties, and mates rank first.
    - `sortByRank` keeps unranked moves in stored order.
    - The LRU cache holds 200 entries, keyed by FEN plus the set of UCI moves.
  - `hooks/use-continuation-ranking.ts`:
    - Runs an interactive depth-12 search (`RANKING_DEPTH`), queued after the Engine tab's search.
    - The search is cancelled when the position changes or the engine is turned off.
    - Only a finished result is published.
  - Tree:
    - Study-line groups and alternatives are sorted best first.
    - The move that continues a line keeps its place.
    - Badges read `#1 +0.30`, and the aria-label says "ranked 1 of 2 by the engine".
  - RED: `Cannot find module './continuation-ranking'`. GREEN: 14 pass.
  - Checks:
    - `pnpm check-types`: exit 0.
    - `pnpm check`: clean.
    - Required `bun test`: 638 pass, 0 fail.
  - Parent checks:
    - lib tests: 43 pass.
    - Real Stockfish 19 (`stockfish-19-lite-single.js`, Scotch position after 3... exd4, `go depth 12 searchmoves c2c3 f1c4`, MultiPV 2) analysed only those two moves: c3 -4cp ahead of Bc4 -22cp.
  - Unverified:
    - No browser run, including the 375px badge wrap.
    - Hidden-tab policy is not wired in, the same as for engine suggestions.
    - No direct test for the hook.
- **Review T1+T2.**
  - Range: base `65490c6` through `2b4f636`. Consent granted (standing). One lens (reliability).
  - **Approved** and acknowledged (lineage `review-8dd4f2e2a5a15bb7`, authority burned).
  - Findings:
    - R3-stale-ranks-during-research (WARNING): when a fork's set of moves changes but still has two or more moves, the old ranks, order and "of N" stay until the new search finishes, and forever if that search is cancelled. **Accepted as T3** (user-visible bug).
    - R3-hook-untested (WARNING): the hook has no test. Partly addressed in T3 through pure-logic extraction; otherwise a follow-up.
    - R3-weak-alternative-sort-test (SUGGESTION): the fork fixture has only one alternative. **Accepted into T3.**
  - Next boundary: `2b4f636`.
- **T3 done** (`52df69a`; delegated `react-staff`; 4 files +226/-26).
  - Pure `rankingReducer`, `selectRanks` and `emptyRankingState` in `lib/continuation-ranking.ts`:
    - Ranks are valid only for the exact key (UCI set plus move ids).
    - A changed key drops the old ranks at once.
    - Late or cancelled results are ignored.
    - The merged map keeps the same reference when nothing changed.
  - The hook now uses `useReducer` with the reducer.
  - The alternative-sort test now uses three reverse-ranked alternatives. It fails when `sortByRank` is removed: 27 pass, 1 fail, then restored.
  - RED: `Export named 'emptyRankingState' not found`. GREEN: 52 pass.
  - Checks:
    - `pnpm check-types`: exit 0.
    - `pnpm check`: exit 0.
    - Required `bun test`: 649 pass, 0 fail.
  - Unverified:
    - The hook's effect wiring has no direct test.
    - No browser run.
- **Review T3.**
  - Range: base `2b4f636` through `6cfb28a`. Consent was granted under the standing consent. One lens (reliability).
  - **Approved** and acknowledged (lineage `review-ef2afa77c636d141`, authority burned).
  - Non-blocking follow-ups, none accepted yet:
    - R3-hook-key-wiring-untested (WARNING): the hook's key and dispatch wiring has no test.
    - R3-duplicate-cancel-test (SUGGESTION): one test in the reducer suite duplicates another.
    - R3-offscreen-position-stale (SUGGESTION): a fork that is not on screen can keep old ranks until it is visited again. Most likely trigger: deleting moves while viewing another position, or while the engine is off.
- **Status:** all tasks are done and every review is acknowledged. Still pending: a browser run. Push and PR are the user's decision.
