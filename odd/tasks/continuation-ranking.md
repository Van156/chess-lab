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

- [ ] **T1: `searchMoves` in engine requests** [T lib]. Route: delegated `react-staff` together with T2 (same writer, separate commit).
- [ ] **T2: Rank continuations in the tree** [T lib, O UI]. Route: delegated `react-staff` (hook, lib, tree components; 2+ non-trivial files).

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

- Feature document created; next: T1 and T2 by one writer.
