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

- [ ] **T1 — Per-line engine colours** [T lib, O UI]: Route: delegated `react-staff` (board-lines lib, engine panel, view; 2+ non-trivial files).
- [ ] **T2 — Engine line preview (click and step)** [T lib, O UI]: Route: delegated `react-staff` (preview state lib, engine panel, view, container; 2+ non-trivial files).

## Acceptance criteria

- With Lines = 3 the three engine arrows have three distinct colours, and each Engine tab line shows the same colour and its number.
- Clicking an Engine tab line previews its PV on the board; ←/→ step; "Back to branch start" returns to the original position; the repertoire is unchanged.
- All checks below pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`
- `bun test apps/web/src/features/repertoire apps/web/src/features/engine tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts apps/web/scripts`

## Progress

- Feature document created; T1 next.
