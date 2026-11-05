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

- [x] **T1: `drill_session` schema and migration** [T]. Done: `d2bfbb2` and `8da2b5e` (migration). Route: delegated (preparation and writer triggers). Schema test first. The generated migration goes in its own commit.
- [x] **T2: `blindfold` router** [T]. Done: `1a17e74`. Route: delegated, together with T1. `recordSession` and `stats`, behind the flag, user-scoped, with integration tests.
- [x] **T3: Drill logic `lib/`** [T]. Done: `2d434ba`. Route: delegated (react-staff, together with T4). Square colour, coordinate parsing, diagonal squares, knight distance (BFS), and seeded question generators.
- [x] **T4: Route, nav and guide** [O]. Done: `2ec7c9b`. Add `/blindfold` (behind the flag), the nav item, and the guide view (accordion sections and a training plan), with stories and a render test.
- [x] **T5: Drill player and progress** [O]. Done: `b0d030f` and `f0edc29`. Route: delegated (react-staff). A drill picker, a timed 20-question player for each drill, a results screen that saves through `recordSession`, and a stats panel from `stats`. Render tests and stories.
  - It also takes in the T3+T4 suggestions listed under Progress.

## Acceptance criteria

- With `blindfold` enabled, the sidebar shows Blindfold, and `/blindfold` shows the guide and the four drills.
- Finishing a drill saves the session, and the stats panel shows the updated best accuracy and recent sessions.
- With the flag off, the route and the API answer as not found or hidden.
- One user cannot read or write another user's sessions.

## Checks

- `bun test` (the affected projects), `bun run check-types`, and `bun run check` (oxlint and oxfmt).

## Progress

- T1 and T2 are done.
  - RED was observed first: the schema test failed (missing table) and the router test failed (missing module). Then GREEN: the schema test passes 9/9 and the router test passes 7/7.
  - `check-types` and `check` are clean. The parent re-ran the router test: 7/7 pass.
- **Review T1+T2:** lineage `review-9662f09c39752ce4`, range `dd6e198..cacc504`. One lens (reliability) approved it with no correction. The approval is acknowledged and its authority burned. The next boundary is `cacc504`.
- **Environment:** the shell needs `PATH=$HOME/.local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/v24.18.1/bin:$PATH` for bun, node (lefthook) and claude (the review capture).
- T3 and T4 are done.
  - RED was observed first: the `./squares` module was missing. Then GREEN: 38/38 pass under `features/blindfold`, and 67/67 pass for nav and `tests/`. `check-types` and `check` are clean. The parent re-ran the feature tests: 38/38 pass.
  - **Correction:** the brief said b1→c2 takes 3 knight moves. BFS shows 2 (b1→a3→c2). A diagonal neighbour is 2 moves, an orthogonal neighbour is 3, and a1→b2 in the corner is 4.
  - `routeTree.gen.ts` is gitignored, so nothing to commit there.
- **Review T3+T4:** lineage `review-d64524f25355d12d`, from tree `cacc504` (commit `c054702`) to `2ec7c9b`. Four lenses approved it with no blockers. The approval is acknowledged and its authority burned. The next boundary is the commit that records this review.
- **Non-blocking suggestions folded into T5:**
  - assert that the web `DRILL_KINDS` stays in sync with the API enum;
  - validate `count` and `level` in `generateQuestions`;
  - name the difficulty literals;
  - fix the "Drill picker" doc comment;
  - make the view test assert the drills content.
- T5 is done.
  - RED was observed first for `drill-session`, `question-text`, `format`, `drill-stats` and the `generateQuestions` validation. Then GREEN: 74/74 pass under `features/blindfold`, and 95/95 pass for `app` and `tests/`. `check-types`, `check` and the web `build` succeed. The parent re-ran the feature tests: 74/74 pass.
  - `ChessBoard` gained an optional `coordinates` prop (default true).
  - Enum sync is asserted by matching literal lists in the web and db tests, because web does not depend on db.
  - Not checked: a manual browser run (keyboard L/D and typed input).
- **Review T5:** lineage `review-6917806d14bb646a`, range `cb3a570..f0edc29`. One lens approved it. The approval is acknowledged and its authority burned.
- **Feature complete.** Next: try it in the browser with `blindfold` in `CHESSLAB_FEATURES`. Push and PR are the user's decision.

## v2: more drills and a redesign (2026-11-05)

- **Source:** user request 2026-11-05: "continue the feature, improve it and add more sessions; follow the best design that fits the app; review it until it looks high quality; use 8 subagents and commit".
- **Interpretation:** "more sessions" = more drill kinds. Four were added (8 in total), and every screen was redesigned in the Midnight identity.
- **Delivery:** a shared contract commit first (`94a879b`: `lib/drills/types.ts`, a `DrillModule` interface, stubs, catalog categories, answer and stimulus slots). Then eight agents worked in parallel on disjoint files. The coordinator committed each agent's slice as it landed, then integrated and reviewed.

### New drills

| Kind              | Label           | Category        | What it asks                                                                    |
| ----------------- | --------------- | --------------- | ------------------------------------------------------------------------------- |
| `same_diagonal`   | Shared diagonal | Board geometry  | Are two squares on one diagonal (yes/no, near misses from level 2)              |
| `check_detection` | Check spotter   | Piece vision    | Is the king in check, from a piece list (blockers at level 2, pawns at level 3) |
| `position_recall` | Move memory     | Position memory | After an opening's moves, what stands on a square (34 validated lines)          |
| `mate_in_one`     | Mate in one     | Position memory | Find mate from a piece list (42 curated positions; any legal mate accepted)     |

### Commits

- `ff75b08`: DB migration widening the drill CHECK; `blindfold.stats` gains `lastPlayedAt`; new `blindfold.summary` (totals, UTC streak, 28-day practice days).
- `5109ea0`: the user data export now includes `drill_session`. It was missing in v1, and the export meta-test caught it.
- `8767f4c`, `3f76f36`: logic for the four drills (TDD).
- `2f0aa93`: answer controls and reveals for the new drills.
- `da5845c`: hub with a practice hero (suggested drill, streak, totals, 28-day strip), and the drill picker grouped by category with glyphs and level hints.
- `b44243f`: player with a 20-pip track, streak chip, square chips, explanation boards, keyboard shortcuts, auto-advance on speed drills and a quit confirmation.
- `5d56904`: results screen (accuracy ring, verdict, personal best, question review) and progress table (sparklines, last played).
- `58f157d`: guide with a sticky contents list, takeaways, SVG diagrams, three new sections and a six-week plan.
- `6d66107`, `15dacf5`, and the commit that adds this section: integration and review fixes.
  - Results get the review and the previous best.
  - Guide "Practise with" chips start a drill.
  - Every reveal board uses one SVG board.
  - A line name tripped the opening-book precache guard; it was renamed "Scotch Opening".

### Checks

- `bun test src/features/blindfold`: 245 pass.
- `src/app`: 47 pass.
- `packages/db` drill schema: 17 pass, against a local PG16.
- `packages/api` blindfold router and export: 22 pass, against a local PG16.
- `tsc --noEmit`, `vp build` and `check-precache`: OK.
- oxlint and oxfmt: clean.
- Visual review: Storybook screenshots at 1280 and 375 for the hub, player (all kinds), reveals, results, progress and guide.

### Known limits

- Mate in one has 12 to 16 positions per level, so a 20-question session repeats some.
- Practice days are counted in UTC, so near midnight the strip can be a day off from local time.
