# Feature: Today home screen prototype

- **Source:** user request 2026-10-04 — "prototype of the first screen with 5 variations… different color palettes, composition and size for radius", built in the repo's Prototype Lab. PRD: https://claude.ai/code/artifact/fca06e5f-854e-4a3d-b5fe-bee21cf74bb1
- **Branch:** `prototype/today-home` from `main` (`6700a8a`). Throwaway per the `prototype` skill; never merged to main as-is.
- **Delivery:** strategy `ask-on-risk`; forecast ~700–900 authored changed lines (5 variant files dominate).
- **TDD:** off — source: project convention (TDD on only for server/auth/API) + prototype skill ("no tests"). Runner for ordinary checks: `bun test`.
- **Review (RDD):** user policy: review every two tasks, auto-consent. Group: T1+T2. First boundary: `6700a8a`.

## Objective

Five structurally different variants of the Chess Lab "Today" home screen (the first screen after sign-in) in the Prototype Lab at `/prototype/today-home?variant=A..E`, so the user can pick a direction for palette, composition and corner radius.

## Screen content (same data in every variant, in-memory mock)

- Greeting + date; Lichess sync status ("synced 2 min ago"); account button.
- Today's review queue: 18 cards (7 mistakes, 8 opening lines, 3 blindfold drills), ~15 min, primary "Start review" action.
- Next-up card: a chessboard with the position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nd4 (FEN `r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4`), last move c6→d4 highlighted, prompt "You played 4.Nxe5? Find a better move.", context "Italian Game · vs [OPPONENT] · blitz, 3 days ago".
- Pillar summaries: Mistakes (23 new from 9 games this week), Repertoire (80 lines: 42 White · 38 Black), Blindfold (24 moves best replay, no peeks).
- Streak: 12 days.
- Nav: Today, Repertoire, Mistakes, Blindfold, Progress.

## Variants

| Key | Name     | Composition                                                                                             | Palette                                           | Radius |
| --- | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| A   | Midnight | Left sidebar nav; queue card + pillar row left, board card right                                        | Dark navy, mint accent                            | 16px   |
| B   | Club     | Top nav; editorial hero (big numbers in a row, rules not cards) + board right; pillars as ruled columns | Warm light, deep green, classic green/cream board | 4px    |
| C   | Bento    | Floating pill nav; bento tile grid, board tile spans 2×2                                                | Bright white/cool grey, electric blue             | 24px   |
| D   | Focus    | Minimal top line; single centered column: big board, prompt, full-width CTA, counts below               | Charcoal, amber                                   | 0px    |
| E   | Playful  | Rounded pill nav; greeting card with progress ring + CTA, board card, tinted pillar cards               | Soft lavender, violet + coral                     | 32px   |

## Constraints

- Follow the existing lab conventions (`apps/web/src/routes/prototype/README.md`, `-registry.ts`, `-example-*` files, `PrototypeSwitcher`, `shared/prototype/variants.ts`).
- No backend, no auth, no persistence; mock data next to the prototype.
- Variants must differ in structure, not only colour. Palettes scoped per variant (no global theme changes).
- Accessible as drawn: real buttons/links, text contrast ≥ 4.5:1, touch targets ≥ 44px; works at phone width.

## Tasks

- [x] **T1 — Route, mock data, registry + variants A–C**: `/prototype/today-home` route, `-today-home-mock-data.ts` (incl. board squares from FEN), registry entry, Variants A, B, C. Route: delegated (react-staff, 2+ non-trivial files).
- [x] **T2 — Variants D–E**: Variants D and E wired into the route and registry. Route: delegated (same writer).

## Acceptance criteria

- `pnpm dev:web` → `/prototype/today-home` loads and appears in the lab index and sidebar.
- `?variant=A`…`E` render five structurally different screens; ←/→ cycles all five.
- `pnpm --filter web check-types` and `pnpm check` pass.

## Checks

- `pnpm --filter web check-types`
- `pnpm check`

## Progress

- Created 2026-10-04. An earlier attempt as a Claude Design canvas (https://claude.ai/artifact/2B5A2jxWctHuLMQV82WNXo, variant A only) was abandoned on user request in favour of the in-repo lab.
- T1 done — commit `988ea85` (delegated, react-staff). Checks: `pnpm --filter web check-types` pass; `pnpm check` pass.
- T2 done — commit `e864594` (delegated, same writer). Same checks pass; parent spot check `pnpm check` pass.
- Deviations: variants use plain elements + Tailwind (no `@b2c-template/ui` components) so per-variant radius/palette stay free; E's ring shows queue composition (7/8/3), not completion.
- Review T1+T2 (base `6700a8a`, through `e864594`, medium risk): consent granted (standing), 1 lens (reliability), **approved**, acknowledged (authority burned). Non-blocking suggestions: R3-fen-parser-unchecked, R3-queue-total-not-derived, R3-ring-cap-overlap, R3-task-status-stale (fixed by this update). Next boundary: `e864594`.
- Not verified: browser run of the five variants.
- **Verdict (2026-10-04): Variant A "Midnight" wins** — dark navy + mint, left sidebar, 16px radius. The user chose it as the visual base for every other view; continued in `odd/tasks/midnight-screens-prototype.md` on branch `prototype/midnight-screens`.
- Dev setup note: `apps/web/.env` (gitignored) needs `VITE_SERVER_URL=http://localhost:3000` or the app crashes at `orpc.ts`.
