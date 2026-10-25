# Feature: Grade repertoire moves against the engine

- **Source:** user request 2026-10-25, with a screenshot of the study line card "Unnamed line 4. c3", which shows no ranking: "should show in order the best move … for the variant that I am studying". The user chose **Grade my move**, not "list the engine's next moves".
- **Branch:** `feat/grade-repertoire-moves`, from `feat/repertoire-base-line` at `40236b7` (the continuation-ranking tip). It is independent of `feat/repertoire-drill`.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached). The forecast is about 450 authored changed lines.
- **TDD:** the source is `openspec/config.yaml` (`strict_tdd: false`; TDD applies to pure logic). The pure `lib/` logic is written test-first. The hook and UI get ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Group: T1+T2. Boundary: `40236b7`.

## Objective

Every stored repertoire move is graded against the engine's best moves, even when it is the only continuation, for example "c3 · #2 · +0.1 · best Bc4 +0.4".

## Problem / why

Continuation ranking (`continuation-ranking.md`) only runs when a position has two or more stored continuations. It also only compares stored moves with each other. A single stored move, like `4. c3` in the screenshot, gets no grade. A set of weak moves can be ranked #1 among themselves while the engine prefers a move the repertoire does not contain.

## Decisions

- **Two searches per graded position, through the shared queue:**
  - the existing restricted search on the stored moves (`searchMoves`);
  - an unrestricted MultiPV 3 search for the engine's top moves.
  - Both run at `RANKING_DEPTH`, and both are cached per FEN.
- **Grade:** each stored move's competition rank within the union of the engine's top 3 and the stored moves, ordered by score from the mover's point of view. A move in both lists is counted once, and its restricted-search score wins.
- **"Best" hint:** when the #1 move of the union is not stored, show it (SAN and score) at that position, as "Engine best: Bc4 +0.4".
- **Trigger:** positions with one or more stored continuations, where the tree already shows ranks today (study-line groups, alternatives, and the study-line root).
- **The engine is off:** no grades, and the stored order, same as today.
- Nothing is persisted.

## Scope

- **T1: Grade logic (web `lib/`, TDD).** Extend or add to `lib/continuation-ranking.ts`:
  - a pure merge, `gradeContinuations(storedMoves, restrictedLines, topLines)`, which returns per move `{ rank, scoreLabel }` and the optional `engineBest { san, scoreLabel }`;
  - ties, mates, overlap between the two lists, a missing top search, and a missing restricted search;
  - cache keys for both searches.
- **T2: Hook and UI.**
  - `use-continuation-ranking` runs for one or more stored moves, issues both searches, and is cancelled on position change or engine off, as today.
  - The tree shows a rank badge on single moves too, and the "Engine best" hint when the engine's best move is not stored. Accessible labels include both.
  - Stories, the registry and SSR tests are updated.

## Constraints

- Container/presentational split. Every presentational component has a story and a registry entry.
- One shared engine worker. Do not starve the Engine tab, and respect the hidden-tab and pause policies.
- Rank is never conveyed by colour alone. Targets are at least 44 px. No horizontal scroll at 375 px.
- About 400 authored lines per task is a planning heuristic only, not a cap.

## Tasks

- [ ] **T1: Grade logic** [T]. Route: delegated `react-staff` (one writer for T1+T2, separate commits).
- [ ] **T2: Hook and UI** [O]. Route: delegated `react-staff` (React, 2+ non-trivial files).

## Acceptance criteria

- With the base at 3... exd4 and only `4. c3` stored, the card shows c3's rank and score, and "Engine best" when c3 is not the engine's best move.
- With two stored moves, both are graded within the union, and the order is best first.
- When the engine is off, there are no grades and the stored order is kept.

## Checks

- `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`
- `pnpm check-types`
- `pnpm check`

## Progress

- 2026-10-25: feature document created. Next step: T1.
