# Feature: Midnight app screens prototype

- **Source:** user request 2026-10-04 — "I like variant A, build the other view using that one". Follows `odd/tasks/today-home-prototype.md` (verdict: Variant A "Midnight"). PRD: https://claude.ai/code/artifact/fca06e5f-854e-4a3d-b5fe-bee21cf74bb1
- **Branch:** `prototype/midnight-screens` from `prototype/today-home` (`e4af9fc`). Throwaway per the `prototype` skill.
- **Assumption:** the other views are clickable Prototype Lab screens with in-memory mock data (no backend yet), not production routes.
- **Delivery:** strategy `ask-on-risk`; forecast ~1,100–1,400 authored changed lines over 3 tasks.
- **TDD:** off — project convention (TDD only for server/auth/API) + prototype skill. Runner for ordinary checks: `bun test`.
- **Review (RDD):** user policy: review every two tasks, auto-consent. Groups: T1+T2, then T3 alone. First boundary: `e4af9fc`.

## Objective

One prototype at `/prototype/midnight` that shows every main view of Chess Lab in the Midnight look (dark navy + mint, left sidebar, 16px radius), so the user can click through the whole app before the real build starts.

## Design base (from Variant A)

- Palette: `--bg #0b1220`, `--surface #131c2e`, `--line #243350`, `--fg #e6edf7`, `--muted #a3b3cb`, `--accent #3ee6b0`, `--accent-fg #04231a`; board light `#8fa3c4`, dark `#3d5278`, last move `rgba(62,230,176,.45)`.
- Shell: left sidebar (top strip on mobile) with nav Today, Review, Repertoire, Mistakes, Blindfold, Progress; header with page title, streak chip, sync status, account button.
- Radius 16px on cards/buttons; lucide icons; monospace for move notation.

## Screens (one `?variant=` key each, so the lab switcher and sidebar list them)

| Key | Screen         | Content (PRD reference)                                                                                                                                                                                                                    |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Today          | Variant A's Today screen inside the shared shell.                                                                                                                                                                                          |
| B   | Review session | Daily queue drill (FR-04, FR-14, FR-17): progress "3 of 18", card type badge, board, prompt, move input + "Show answer", grading buttons Again / Hard / Good / Easy (FSRS), mini queue list.                                               |
| C   | Repertoire     | Repertoire tree for White/Black (FR-02), line list with explorer stats at your level (FR-05), selected line on the board with visual idea notes: arrows, highlighted squares, one-line plan (FR-03).                                       |
| D   | Mistakes       | Imported-game mistakes (FR-12–FR-16): filters by opening / phase / time pressure, list of mistakes with eval loss and "left repertoire" flag, selected mistake on the board with played vs best move, "Add to review" action, sync status. |
| E   | Blindfold      | Drills (FR-07–FR-11): mode picker (coordinates, square color, replay game, play engine), level selector, hidden board with "Peek" (counts peeks), notation feed, typed SAN input + voice button (FR-10).                                   |
| F   | Progress       | Dashboard (FR-18): streak, accuracy by pillar, repeat-mistake rate trend, weakest openings, blindfold best depth, review heatmap of last weeks.                                                                                            |

## Constraints

- Follow the lab conventions (`apps/web/src/routes/prototype/README.md`, `-registry.ts`, switcher, `?variant=`).
- Reuse `-today-home-board.tsx` and `-today-home-mock-data.ts` where possible; new mock data next to the prototype. No backend, no persistence; in-memory React state only for cheap interactions (peek toggle, show answer, selected line/mistake, filters).
- Sidebar nav links switch screens via `?variant=` (shareable URL).
- Accessible: real buttons/links, labels, contrast ≥ 4.5:1, targets ≥ 44px, usable at ~375px.
- Leave the `today-home` prototype untouched.

## Tasks

- [ ] **T1 — Shell + Today + Review session**: shared Midnight shell component, `/prototype/midnight` route + registry entry (6 screens), screens A and B. Route: delegated (react-staff, 2+ non-trivial files).
- [ ] **T2 — Repertoire + Mistakes**: screens C and D with their mock data. Route: delegated (same writer).
- [ ] **T3 — Blindfold + Progress**: screens E and F with their mock data. Route: delegated (same writer).

## Acceptance criteria

- `/prototype/midnight` is listed in the lab; `?variant=A`…`F` render the six screens in one consistent Midnight look; sidebar links and ←/→ move between them.
- `pnpm --filter web check-types` and `pnpm check` pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`

## Progress

- Created 2026-10-04.
- Next: T1.
