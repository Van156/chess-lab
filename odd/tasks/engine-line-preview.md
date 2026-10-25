# Feature: Engine line colours and line preview

- **Source:** user request 2026-10-25 — "add different color for each variation and also show a possible continuation for that line like previsualization that line there where I can just go back to the initial of that branch" (screenshot: builder board with Lines = 3, all engine arrows the same blue). Preview UX decided by the user 2026-10-25: **click and step**.
- **Branch:** `feat/engine-line-preview`, branched from `feat/repertoire-builder-layout7` at `56bdc4c` (the builder layout is not on `main` yet).
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from the builder layout feature). Forecast about 500–700 authored changed lines (T1 about 200, T2 about 400).
- **TDD:** source is `openspec/config.yaml` (`strict_tdd: false`; TDD for pure logic). Pure `lib/` helpers are TDD; components get ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Group: T1+T2. First boundary: `56bdc4c`.

## Objective

Give each engine line (Lines 1–5) its own colour on the board and in the Engine tab, and let the user preview a line's continuation on the board, stepping through it, then return to where the line started.

## Problem / why

All engine arrows are drawn in the same blue (fading by rank), so with several lines the user cannot tell which arrow belongs to which line. The engine's principal variation is only listed as text; there is no way to see it played out on the board without adding moves to the repertoire.

## Scope

- **T1 — Per-line colours:** a fixed palette of 5 distinct colours, one per engine line rank, used for the board arrows and as a swatch/accent on the matching line in the Engine tab. Repertoire arrows keep their own colour (amber) and stay on top when from/to collide. The board's accessible description names each line's colour or number consistently.
- **T2 — Line preview (click and step):** clicking a line in the Engine tab enters preview mode for that line's PV from the current position. The board shows the PV position at the preview cursor (start at the first move); ←/→ (and on-screen buttons) step through it; a "Back to branch start" button (and Escape) exits to the position the line started from. Nothing is written to the repertoire tree; the engine does not re-analyse preview positions; moves played on the board are disabled or exit preview. Preview state is pure `lib/` logic with tests.

Out of scope: saving a previewed line to the repertoire; hover ghost arrows; changing MultiPV or engine behaviour.

## Constraints

- Keep the container/presentational split (`repertoire-builder-page.tsx` data, `repertoire-builder-view.tsx` render). Pure logic in `lib/` with tests.
- Tailwind and `@b2c-template/ui`; accessible (real buttons, labels, ≥44px targets, colour never the only cue — show the line number too); no horizontal scroll at 375px.
- Update stories for changed components.

## Tasks

- [x] **T1 — Per-line engine colours** [T lib, O UI]: Route: delegated `react-staff` (board-lines lib, engine panel, view; 2+ non-trivial files).
- [x] **T2 — Engine line preview (click and step)** [T lib, O UI]: Route: delegated `react-staff` (preview state lib, engine panel, view, container; 2+ non-trivial files).

## Acceptance criteria

- With Lines = 3 the three engine arrows have three distinct colours, and each Engine tab line shows the same colour and its number.
- Clicking an Engine tab line previews its PV on the board; ←/→ step; "Back to branch start" returns to the original position; the repertoire is unchanged.
- All checks below pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`
- `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts apps/web/scripts`

## Progress

- Feature document created.
- **T1 done** (`92722f4`, delegated `react-staff`, 8 files, +138/-33). New `lib/line-colours.ts` (5-colour palette, best line keeps the engine blue; names travel with colours). Board arrows use the rank colour with a mild fade (best strongest); a line keeps its rank colour when an earlier line is undrawable. Board description now reads "1 e4 (blue), 2 d4 (violet)". Engine tab lines carry a swatch and their number. RED: `bun test line-colours.test.ts` failed with "Cannot find module './line-colours'"; board-lines tests failed 8 (colour and description). GREEN: lib tests 269 pass. Checks: `pnpm --filter web check-types` exit 0; `pnpm check` clean; `bun test` (required set) 511 pass, 0 fail.
- **T2 done** (`fdb0af6`, delegated `react-staff`, 17 files, +782/-47). Pure `lib/line-preview.ts` (reducer start/next/previous/exit, cursor 1..n, steps replayed from base FEN and truncated at the first illegal or malformed move, `previewView`, `previewKeyAction`); `hooks/use-line-preview.ts` (reducer plus window key handler); `components/line-preview-bar.tsx`; Engine tab lines are buttons (`aria-pressed`) that preview; `SuggestionLine.pv` carries the full UCI PV. The view swaps the toolbar for the bar, shows the previewed position with the next PV move arrow in the line colour, takes no board moves and hides the typed-move field; `go` in the container exits the preview, and the preview hides itself if the FEN differs. RED: `line-preview.test.ts` failed with a missing module, and again with "Export named 'previewKeyAction' not found". GREEN: 18 lib tests pass. Checks: `pnpm --filter web check-types` no errors; `pnpm check` clean; `bun test` (required set) 541 pass, 0 fail.
- Unproven: no browser run (keyboard handling, 375px layout, visual colour contrast verified by reading only). Eval bar still shows the base position's score while previewing.
