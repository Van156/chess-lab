# Feature: Repertoire builder layout (Board + rail)

- **Source:** user verdict 2026-10-24 on the layout prototype — "implement the A". Prototype and its record: branch `prototype/repertoire-builder-layout` (primary source, never merged), `odd/tasks/repertoire-builder-layout-prototype.md` on that branch.
- **Branch:** T1 on `feat/repertoire-builder-layout`, branched from `feat/engine-suggestions5` at `98edb96` (the engine suggestions are not on `main` yet). T1 is split across `feat/repertoire-builder-layout` (tree model) and `feat/repertoire-builder-layout1b` (board lines, preferences, MultiPV). Each later task Tn gets `feat/repertoire-builder-layout<n>`, branched from the previous task's last commit.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from P2-b, P2-d and engine suggestions), one branch per task, split at commit boundaries when a task runs well over about 400 lines. Forecast was about 1,000–1,200 authored changed lines (T1 about 350, T2 about 450, T3 about 150–400); T1 alone came in at about 1,075, so the running forecast is now about 1,700–1,900.
- **Slices:** `feat/repertoire-builder-layout` = `d2f7521`, `61db3f2` (≈300 lines); `feat/repertoire-builder-layout1b` = `3d4513b` plus the T1 record (≈775 lines, one commit, not split further).
- **TDD:** source is `openspec/config.yaml` (`strict_tdd: false`; TDD for server/API and pure logic). T1 is TDD (pure `lib/`); T2 and T3 use TDD for pure `lib/` helpers and ordinary checks for components. Runner: `bun test`.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Groups: T1+T2, then T3 alone. First boundary: `98edb96`.

## Objective

Rebuild the repertoire builder page (`/repertoire/$id`) as the prototype's variant A, "Board + rail", as production code with tests, replacing the current layout.

## Problem / why

The current builder caps the board at a 420px column inside `max-w-5xl`, shows the repertoire only as the current line plus "Next moves" buttons (no tree), draws a single engine arrow, and shows the opening name only inside the explorer card. The prototype compared three layouts in the real app; the user picked A.

## Scope

- **Board column:** the board sized from the viewport (fits the screen height; about 572px at 1440×900 in the prototype, 319px at 375px), the eval bar beside it at full board height, a toolbar above it with the lines control (1–5) and the repertoire-arrows toggle, the line navigator and the move input below it. The opening name sits above the toolbar (T3).
- **Right rail:** tabs Tree · Engine · Explorer · Notes, reusing the existing engine panel, explorer panel and idea-note editor.
- **Variation tree (outline):** the whole repertoire graph from the start position. Only-child chains stay at one indent level; a fork indents its alternatives and makes them visibly distinct from the continuation (prototype review R3-flattened-chain-sibling-ambiguity). Current path highlighted; click any node to jump; collapse at forks; transpositions shown once and marked; delete per node; ≥44px targets. It must not re-render on every engine frame (prototype review R4-per-frame-tree-rerender).
- **Lines on board:** the count (1–5) sets the engine MultiPV and draws that many engine lines as arrows, best line strongest. Repertoire moves from the current position get their own arrow colour, with a toggle. Arrows sharing from/to collapse into one, repertoire colour on top (prototype defect 3; review R3-unique-arrows-untested). The board's accessible label lists engine lines and repertoire moves. The chosen count and the toggle persist like the engine toggle.
- **Opening name (T3):** ECO + name above the board; when the current position has none, the last known name along the current path. Source pending the user's decision.

Out of scope: the prototype switcher and `?variant=`; layouts B and C; changes to data fetching, mutations or the API.

## Constraints

- Keep the container/presentational split: `repertoire-builder-page.tsx` owns data and mutations, `repertoire-builder-view.tsx` renders. Pure logic goes in `lib/` with tests.
- Rewrite, do not copy, the prototype code (written under prototype rules). Read it with `git show prototype/repertoire-builder-layout:<path>` for reference.
- Use Tailwind and `@b2c-template/ui` components; accessible (real buttons, labels, ≥44px targets); no horizontal scroll at 375px.
- Keep the existing stories and fixtures working and add or update stories for the changed view.

## Tasks

- [x] **T1 — Builder model (tree, board lines, lines preference)** [T]: Branches `feat/repertoire-builder-layout` and `feat/repertoire-builder-layout1b`. Route: delegated `react-staff` (several pure `lib/` modules plus tests and the suggestion controller; 2+ non-trivial files).
  - Fork-aware variation tree builder from the repertoire graph (chains flat, alternatives grouped and marked, transpositions once, current-path flags).
  - Board lines: engine lines (1–5) to weighted arrows, repertoire arrows, from/to de-duplication with the repertoire colour on top, and the board description text.
  - Lines count (1–5) and repertoire-arrows preferences, persisted with the same pattern as the engine toggle; the suggestion controller takes the count as its MultiPV.
- [ ] **T2 — Board + rail layout** [T lib, O UI]: Branch `feat/repertoire-builder-layout2`. Route: delegated `react-staff` (view, tree component, container wiring, stories; 2+ non-trivial files).
- [ ] **T3 — Opening name above the board** [T lib, O UI]: Branch `feat/repertoire-builder-layout3`. Route: delegated `react-staff`. Blocked on the user's choice of name source (explorer-only vs a bundled CC0 opening list, `lichess-org/chess-openings`).

## Acceptance criteria

- `/repertoire/<id>` renders the Board + rail layout; the board is at least as large as the prototype's A at 1440×900 and fits at 375px without horizontal scroll.
- The tree navigates the whole repertoire, alternatives at a fork are visually distinct from the continuation, and engine frames do not re-render it.
- The lines control changes the engine lines and arrows; repertoire arrows toggle; no duplicate arrow keys.
- The opening name shows per the chosen source (T3).
- All checks below pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`
- `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`

## Progress

- Created 2026-10-24.
- T1 done: `61db3f2` (fork-aware variation tree) and `3d4513b` (board lines, preference store, lines preferences, MultiPV count).
  - `lib/variation-tree.ts` `buildVariationTree(graph, path): TreeLine` — `TreeLine {depth, isAlternative, nodes}`; `TreeNode {moveId, san, label, side, positionId, route, ply, onPath, isCurrent, transposition, alternatives}`. Only-child chains stay flat; a fork's first stored child continues, the others become `alternatives` on the continuing move (PGN order); later arrivals at an expanded position are `transposition` leaves. Depends only on graph and path.
  - `lib/board-lines.ts` `buildBoardArrows({noteArrows, engineLines, lineCount, repertoireMoves, showRepertoire})` and `describeBoardLines(...)`; draw order note → engine (weakest to strongest; ranks 2–5 at alpha `bf`/`8c`/`66`/`4d`) → repertoire (amber `#f5a524`); one arrow per from/to, highest layer wins. `mergeBoardArrows` is still used by the current page and becomes dead in T2.
  - `lib/preference-store.ts` (generic, same failure handling as the engine toggle; `engine-preference.ts` now delegates, behaviour unchanged), `lib/lines-preference.ts` (count 1–5, default 3, clamped; repertoire arrows default on), `hooks/use-preference.ts`, `hooks/use-lines-preference.ts` (`useLineCount`, `useRepertoireArrows`).
  - `useEngineSuggestions(fen, enabled, multiPv = SUGGESTION_LINES)`; the clamped count is in the effect dependencies, so a change restarts the search. The current page is unchanged (default 3, as before).
  - RED: `bun test apps/web/src/features/repertoire/lib/variation-tree.test.ts` → `error: Cannot find module './variation-tree'` (0 pass, 1 fail, 1 error); `board-lines.test.ts` and `lines-preference.test.ts` → Cannot find module (0 pass, 1 fail, 1 error each). GREEN: 11, 21 and 20 new tests pass; `suggestion-run.test.ts` gained a MultiPV 1/5 forwarding test.
  - Checks (writer): `pnpm --filter web check-types` exit 0; `pnpm check` exit 0; `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts` 429 pass / 0 fail. Parent spot check: the bun test command re-run → 429 pass / 0 fail.
  - Not proven by a test: the search restart on a count change (no React hook-testing library in the repo; the engine index does not load under `bun test`). It rests on the effect dependency array.
  - Size: ≈1,075 lines (tests ≈550; the generic preference store and the engine-toggle refactor onto it account for the rest of the overage).
  - Review: deferred to the T1+T2 group.
