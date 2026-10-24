# Feature: Repertoire builder layout (Board + rail)

- **Source:** user verdict 2026-10-24 on the layout prototype — "implement the A". Prototype and its record: branch `prototype/repertoire-builder-layout` (primary source, never merged), `odd/tasks/repertoire-builder-layout-prototype.md` on that branch.
- **Branch:** T1 on `feat/repertoire-builder-layout`, branched from `feat/engine-suggestions5` at `98edb96` (the engine suggestions are not on `main` yet). T1 is split across `feat/repertoire-builder-layout` (tree model) and `feat/repertoire-builder-layout1b` (board lines, preferences, MultiPV); T2 across `feat/repertoire-builder-layout2` (tree outline) and `feat/repertoire-builder-layout2b` (layout and wiring); T3 across `feat/repertoire-builder-layout3` (generator, lookup, generated book) and `feat/repertoire-builder-layout3b` (view, cache, record). Each later task Tn gets `feat/repertoire-builder-layout<n>`, branched from the previous task's last commit.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from P2-b, P2-d and engine suggestions), one branch per task, split at commit boundaries when a task runs well over about 400 lines. Forecast was about 1,000–1,200 authored changed lines (T1 about 350, T2 about 450, T3 about 150–400); T1 alone came in at about 1,075, and T2 at about 1,190, so the running total is about 2,270 with T3 still to come.
- **Slices:** `feat/repertoire-builder-layout` = `d2f7521`, `61db3f2` (≈300 lines); `feat/repertoire-builder-layout1b` = `3d4513b`, `128080d` (≈775 lines, one commit, not split further); `feat/repertoire-builder-layout2` = `5c3772c` (≈470 lines); `feat/repertoire-builder-layout2b` = `6a55bb7` plus the T2 record (≈720 lines); `feat/repertoire-builder-layout3` = `4d9ffa2`, `1cc3c77` (≈330 lines), `f451060` (generated, 14,832 lines); `feat/repertoire-builder-layout3b` = `82dc57b`, `67294ae` plus the T3 record (≈150 lines).
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
- [x] **T2 — Board + rail layout** [T lib, O UI]: Branches `feat/repertoire-builder-layout2` and `feat/repertoire-builder-layout2b`. Route: delegated `react-staff` (view, tree component, container wiring, stories; 2+ non-trivial files).
- [x] **T3 — Opening name above the board (bundled opening list)** [T lib, O UI]: Branch `feat/repertoire-builder-layout3` (from `198bbd6`). Route: delegated `react-staff` (generator script, data, lookup lib, view; 2+ non-trivial files). Source decided by the user 2026-10-24: **bundled list** — `lichess-org/chess-openings` (CC0-1.0, a–e.tsv, ≈3,860 rows of ECO, name, PGN).
  - A generator script converts the upstream TSVs, pinned to one upstream commit, into a position-keyed map (normalised FEN key → ECO + name), committed as a generated file; source, commit and licence recorded next to it.
  - A pure lookup: position → name, plus the fallback "last known name along the current path"; the same key normalisation on both sides (en passant handled explicitly). Transpositions resolve by position.
  - The data loads lazily (its own chunk, only on the builder), never in the main bundle.
  - The name (ECO + name) shows above the board toolbar; nothing shows when no name is known yet along the path.
  - The dataset is listed on the licences page.
  - Not in scope: the T1+T2 review follow-ups (offered to the user, not accepted).

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
- T2 done: `5c3772c` (variation tree outline) and `6a55bb7` (board + rail layout and wiring).
  - `components/variation-tree.tsx` (memo): flat only-child chains; each alternative group is `<ul aria-label="Alternatives to 2. Nf3">` with a dashed left rule and an "alternative" tag, placed right after the move it replaces; accessible names like "1... c5, opponent reply, alternative to 1... e5"; fork chevrons with `aria-expanded` (disabled while the shown line runs through an alternative); transposition leaves with an icon and text; a delete button per row; ≥44px targets. Pure helpers in `lib/tree-outline.ts` (`toggleCollapsed`, `isForkPinned`, `isForkOpen`, `describeTreeNode`).
  - `components/board-toolbar.tsx`: lines 1–5 (`aria-pressed`, "3 lines on the board") and the repertoire-arrows switch. Board column width `lg:w-[max(26rem,calc(100dvh-19rem))]` (the prototype's formula); `EvalBar` gets `h-auto self-stretch`. Right rail: `@b2c-template/ui` `Tabs` (Tree, Engine, Explorer, Notes; `keepMounted`).
  - Container: `useLineCount`, `useRepertoireArrows`, `useEngineSuggestions(fen, enabled, lineCount)`, `buildBoardArrows`, `describeBoardLines`; `path` memoised on `[repertoire, currentId, where.route]` and the tree on `[repertoire, path]`; stable `useCallback`s; no inline lambdas into the tree (reasoned prop identity, not profiled). `lib/board-arrows.ts` and its test removed (`mergeBoardArrows` had no other users).
  - Removed: "Next moves" in `LineNavigator` (the tree and the repertoire arrows replace it) and the "Current line" card (the breadcrumbs repeat it).
  - Stories: view stories updated (`OneEngineLine`, `RepertoireArrowsOff`), new stories for `variation-tree` (fork, nested alternative, transposition) and `board-toolbar`.
  - RED: `bun test apps/web/src/features/repertoire/lib/tree-outline.test.ts` → `error: Cannot find module './tree-outline'` (0 pass, 1 fail, 1 error). GREEN: 9 pass. Component test `variation-tree.test.tsx`: 8 tests.
  - Checks (writer): `pnpm --filter web check-types` exit 0; `pnpm check` exit 0; bun tests 446 pass / 0 fail. Parent spot check: `pnpm --filter web check-types` exit 0 (re-run because the writer edited a comment after its last type-check); bun tests 446 pass / 0 fail.
  - Browser (parent, headless Chromium, test user): 1440×900 board 572 px, eval bar 572 px tall; 375 px board 319 px, eval bar 319 px, no horizontal scroll; all four tabs switch; lines 1 → `e4`, 5 → five engine lines, 5 still selected after reload; tree click jumps to `3... exd4`; a throwaway repertoire with `1. d4` (root fork) and `2. Bc4` (deep fork) shows "Alternatives to 1. e4" and "Alternatives to 2. Nf3" groups, visibly distinct; the throwaway repertoire was deleted afterwards; no duplicate-key warnings. A `TypeError: Failed to fetch` from the auth route's `beforeLoad` session fetch shows up in the console during scripted navigations (also seen on the prototype branch); not tied to this feature, most likely a request aborted by fast navigation (not confirmed).
  - Open follow-ups: `EngineView.arrow` is unused by the view now (still used by `suggestion-state.ts`, tests, fixtures); delete buttons on every row make two tab stops per row.
  - Size: ≈1,190 lines (component tests, stories and fixtures ≈340).
- Review T1+T2 (base `98edb96`, through `02ff4bb`): consent granted (standing); 1 lens (reliability); **approved**, acknowledged (lineage `review-bbee490c9fcbd6b9`, authority burned). Next boundary: `02ff4bb`. Non-blocking findings, recorded as follow-ups (not in scope until the user accepts them):
  - R3-page-wiring-unproved (WARNING): the container's composition (engine lines taken only from the analysing/done panel states, fed with the count and the repertoire toggle into `buildBoardArrows`/`describeBoardLines`) has no test, so nothing proves engine-off or unavailable yields no engine arrows or engine text on the real page. Fix shape: move that composition into a pure `lib/` function and test it.
  - R3-delete-by-id-untested (WARNING): `onDeleteNode` resolves a move id against `repertoire.moves` and silently does nothing when it is missing; untested. The MultiPV restart on a count change is also unproved (known since T1).
  - R3-description-includes-undrawn-lines (SUGGESTION): `describeBoardLines` names engine lines whose UCI is malformed although `buildBoardArrows` drops them, so the label and the drawing can diverge.
- T3 started 2026-10-24: the user chose the bundled list.
- T3 done: `1cc3c77` (generator and lookup), `f451060` (the generated book alone), `82dc57b` (name above the board, licences entry, real-data tests), `67294ae` (parent: cache the book on first use instead of precaching it). The writer's original commits (`122bd5f`, `340755b`) were re-cut by the parent so the generated book sits in a commit of its own: the first review attempt over `02ff4bb..85bc299` stopped with `lens_context_budget_exceeded` (no authority created) because the 531 KB book cannot fit any reviewer context. The code is byte-identical to the original apart from the two real-data tests, which moved from `opening-lookup.test.ts` to `opening-book.test.ts` so `1cc3c77` passes without the data. Re-checked on the new chain: `pnpm --filter web check-types` exit 0, `pnpm check` exit 0, bun tests 473 pass / 0 fail (43 files).
  - `apps/web/scripts/build-openings.ts` (`pnpm --filter web build:openings`) downloads `lichess-org/chess-openings` pinned at `a6189a30dc273ccb21fc2536a9a2fefd5592a67a`, parses the TSVs as data, replays each PGN with `applyMove` from `@b2c-template/chess`, and writes `src/features/repertoire/data/openings.generated.ts` (531 KB, typed `OpeningBook`, header with source, SHA, CC0-1.0, counts, rule, regeneration). Pure build logic in `lib/opening-book-build.ts`. 3,865 rows → 3,865 distinct keys; duplicate rule: the longest line wins, ties keep the earlier row.
  - `lib/opening-lookup.ts`: `openingKey(fen)` wraps `positionKey` from `@b2c-template/chess` (placement, side, castling; en passant square only when a capture is legal, so `e3` and `-` after `1. e4` give one key; counters ignored); `openingFor(book, fen)` (`Object.hasOwn`); `openingAlongPath(book, fens)` falls back to the last known name earlier on the path.
  - `hooks/use-opening-name.ts`: dynamic `import()` of the book inside a TanStack Query (infinite stale/gc time, no retry); `undefined` while loading or on failure, `null` when no name is known.
  - View: `<p data-slot="opening-name" class="min-h-6 …">` above the toolbar ("C44 · Scotch Game"), empty when null; stories `OpeningNamed`, `StartPosition`. Licences page: "Opening names" section (CC0-1.0).
  - Build: the book is its own chunk `openings.generated-*.js`, 464.23 kB (62.38 kB gzip); the main `index-*.js` (282.77 kB) does not contain it. The writer flagged that the PWA precache picked it up (102 entries, 2,187 KiB); the parent added it to `globIgnores` with a `CacheFirst` runtime rule, like the engine → 101 entries, 1,734 KiB, and the hashed chunk no longer appears in `sw.js`. Offline before the builder was ever opened, the name simply does not show.
  - RED: `bun test apps/web/src/features/repertoire/lib/opening-lookup.test.ts` → `Cannot find module './opening-lookup'` (0 pass, 1 fail). GREEN: `bun test .../lib/opening` 24 pass / 0 fail (one test bug fixed on the way: a regex that matched the side-to-move field).
  - Checks (writer): `pnpm --filter web check-types` exit 0; `pnpm check` exit 0; bun tests 473 pass / 0 fail. Parent spot check: bun tests 473 / 0; after `f39aa62`: `pnpm --filter web check-types` exit 0, `pnpm check` exit 0.
  - Browser (parent): the book is requested only on the builder (not on `/today` or `/repertoire`); start position shows no name; along the Scotch line: B00 King's Pawn Game → C20 King's Pawn Game → C40 King's Knight Opening → C44 King's Knight Opening: Normal Variation → C44 Scotch Game (3. d4 and 3... exd4) → C44 Scotch Game: Scotch Gambit → C44 Scotch Game: Scotch Gambit, London Defense; the board top stays at 266 px throughout (no layout shift).
  - Size: ≈470 authored lines (≈230 tests) plus the 14,832-line generated book.
- Review plan for T3 (the budget stop makes one candidate impossible): candidate 1 = `02ff4bb..1cc3c77` (plan doc, generator, lookup); `f451060` (generated data) is not lens-reviewed — it is deterministic output of the reviewed generator, covered by the generator's unit tests, the real-data tests and the browser check; candidate 2 = `f451060..` the T3 record (view, licences, cache, real-data tests, record).
