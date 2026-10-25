# Feature: Blindfold training section (guide, drills, saved progress)

- **Source:** user request 2026-10-25: "Create a section for practice blindfold chess with ideas to memorise and techniques to improve that one". Scope chosen by the user: guide + interactive drills + saved progress.
- **Branch:** `feat/blindfold-training`, from `feat/tree-editing-shortcuts` at `dd6e198`. It is stacked because the unmerged chain adds DB migrations; a migration branched from `main` would conflict with them.
- **Delivery:** `auto-chain`, `feature-branch-chain`, reused from the previous features. The forecast is about 1,500 authored changed lines, excluding the generated migration and `routeTree.gen.ts`.
- **TDD:** the source is `openspec/config.yaml` (`strict_tdd: false`; TDD applies to server/API and pure logic). The schema, the API and the drill `lib/` are test-first. The UI gets ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Groups: T1+T2, T3+T4, then T5. First boundary: `dd6e198`.
- **PRD link:** `docs/prd.md` FR-07 (coordinates) and FR-08 (square colour), plus the `DrillSession` entity. Out of scope: FR-09 (replay), FR-10 (voice) and FR-11 (engine), and drill cards in the FSRS queue.

## Objective

Add a Blindfold section. It holds:

- a guide: ideas to memorise and techniques to improve, with a progressive training plan;
- short timed drills that build board vision;
- saved session results, so the user sees their best score and recent trend for each drill.

## Problem / why

- The `blindfold` pillar flag (`packages/api/src/features.ts`) and `user_settings.blindfoldLevel` already exist, but there is no route, API or table behind them.
- Blindfold skill is built from a few memorisable anchors and repeated visualisation drills. The app has neither.

## Decisions

- **Gating:** the route uses `requireFeature("blindfold")`, the API uses `featureProcedure("blindfold")`, and the nav item uses `pillarEnabled("blindfold")`. Turn it on locally with `CHESSLAB_FEATURES=...,blindfold`.
- **Table:** `drill_session` holds:
  - `id`, `user_id` (cascade);
  - `drill` (text, CHECK in `square_colour | coordinates | diagonals | knight_distance`);
  - `level` (smallint, at least 1);
  - `correct` and `total` (smallint, CHECK `0 <= correct <= total`, `total >= 1`);
  - `duration_ms` (int, at least 0);
  - `created_at`;
  - an index on `(user_id, drill, created_at)`.
- **API:** `blindfold.recordSession` (input is the drill, level, correct, total and durationMs; it returns the row) and `blindfold.stats` (for each drill: sessions, best accuracy, last 10 sessions). Every query is scoped to `context.session.user.id`.
- **Drills (pure `lib/`, seeded RNG so tests are deterministic):**
  - Square colour: "Is f6 light or dark?"
  - Coordinates (FR-07): one square is highlighted on an empty, coordinate-free board, and the user types its name.
  - Diagonals: "Which squares lie on the a1–h8 diagonal through c3?" The user picks squares.
  - Knight distance: "Fewest knight moves from b1 to f7?"
  - A session is 20 questions and is timed.
- **Guide content (static, in the feature `lib/`):** sections for:
  - square colour rules (a1 is dark; file and rank parity);
  - the long diagonals and key diagonals (a1–h8, h1–a8, b1–h7…);
  - knight patterns (the colour flip; distances);
  - landmark squares and opening anchors;
  - mating patterns to visualise;
  - techniques (say moves aloud, piece lists, check the position every N moves, replay known games, play against an engine without a board);
  - a weekly plan.

## Scope

- [ ] **T1: `drill_session` schema and migration** [T]. Schema test first. The generated migration goes in its own commit.
- [ ] **T2: `blindfold` router** [T]. `recordSession` and `stats`, behind the flag, user-scoped, with integration tests.
- [ ] **T3: Drill logic `lib/`** [T]. Square colour, coordinate parsing, diagonal squares, knight distance (BFS), and seeded question generators.
- [ ] **T4: Route, nav and guide** [O]. Add `/blindfold` (behind the flag), the nav item, and the guide view (accordion sections and a training plan), with stories and a render test.
- [ ] **T5: Drill player and progress** [O]. A drill picker, a timed 20-question player for each drill, a results screen that saves through `recordSession`, and a stats panel from `stats`. Render tests and stories.

## Acceptance criteria

- With `blindfold` enabled, the sidebar shows Blindfold, and `/blindfold` shows the guide and the four drills.
- Finishing a drill saves the session, and the stats panel shows the updated best accuracy and recent sessions.
- With the flag off, the route and the API answer as not found or hidden.
- One user cannot read or write another user's sessions.

## Checks

- `bun test` (the affected projects), `bun run check-types`, and `bun run check` (oxlint and oxfmt).

## Progress

- Branch created. T1 is next.
