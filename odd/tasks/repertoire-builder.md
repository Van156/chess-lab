# Feature: Repertoire router and builder UI (chess-lab-v1 P2-b)

- **Source:** user request 2026-10-23 — "yes and then continue with the next one". Slice P2-b of `openspec/changes/chess-lab-v1/tasks.md` (line 308); design `openspec/changes/chess-lab-v1/design.md` (router table lines 480-494, board contract 405-440, flags 443); spec `openspec/changes/chess-lab-v1/specs/repertoire/spec.md` ("Navigate and edit the tree" L53-67, "Idea notes" L69+, "Accessible builder" L165-173); `specs/app-shell/spec.md` L11-17, 28. Builds on P2-a (`odd/tasks/repertoire-schema-graph.md`).
- **Branch:** `feat/chess-lab-v1-p2b` from `feat/chess-lab-v1-p2a2` (`ff30453`). T2 on `feat/chess-lab-v1-p2b2`, T3 on `feat/chess-lab-v1-p2b3`, each from the previous task's commit.
- **Delivery:** `auto-chain`, `feature-branch-chain`. Forecast about 1,300 authored changed lines (T1 about 450, T2 about 400, T3 about 450), one PR per task: PR 20 = T1, PR 20b = T2, PR 20c = T3.
- **TDD:** source `openspec/config.yaml` (`strict_tdd: false`, TDD for server/auth/API and pure logic). T1 on; T2 and T3 on for pure `lib/` helpers, ordinary checks for components. Runner: `bun test`.
- **Review (RDD):** user policy, groups of two, auto-consent. Groups: T1+T2 (base `e983e23`, includes the test fix `ff30453`), then T3 alone, then T4+T5 (base `d7e01f0`).
- **Follow-up (2026-10-24):** user chose to fix the P2-b review warnings before the next slice ("Fix P2-b warnings"). T4 on `feat/chess-lab-v1-p2b4` from `ea35169` (PR 20d), T5 on `feat/chess-lab-v1-p2b5` from T4 (PR 20e). Forecast about 500 authored changed lines (T4 about 150, T5 about 350), so `auto-chain` slices one PR per task.

## Objective

Let a user create, rename and delete repertoires per colour, build them move by move (typed SAN or board), navigate and prune the tree, and attach one idea note per position (arrows, highlighted squares, one-line plan), behind the `repertoire` pillar flag. No cards (P2-c), explorer (P2-d) or export (P2-e).

## Decisions

- **Delete semantics (assumption, reversible):** `deleteMove` removes the chosen edge, then deletes every position no longer reachable from the start position (their moves, idea notes and future cards go by cascade). Positions still reachable through another move order survive. The start position is never deleted. This reads the spec's "node and descendants removed" for a graph with transpositions.
- **Idea note shape:** `arrows: { from: Square; to: Square }[]`, `highlights: Square[]`, `plan: string` (trimmed, single line, max 140, rejected over 140). Square = `^[a-h][1-8]$`. Array caps 32 each (no limit in the design; prevents unbounded jsonb). Saving an empty note (no arrows, no highlights, empty plan) deletes the row ("clearing removes the note").
- **Concurrency:** writes lock the `repertoire` row `FOR UPDATE` inside the transaction, so the cycle check and inserts see a stable graph.
- **Errors:** illegal move and cycle → `BAD_REQUEST` with distinct messages; unknown repertoire, position or move → `NOT_FOUND`; duplicate move → idempotent success returning the existing move.

## Scope

- In: `packages/api/src/services/repertoire-service.ts`, `packages/api/src/routers/repertoire.ts` (list, create, rename, delete, get, addMove, deleteMove, setIdeaNote) registered in `routers/index.ts`; `apps/web/src/features/repertoire/**`, `routes/_auth/repertoire/{route,index,$id}.tsx`, navigation entry (`pillarEnabled("repertoire")`), stories, registry entries, tests.
- Out: `explorer`, `addLineFromGame`, repertoire cards, export.

## Constraints

- Router conventions: `featureProcedure("repertoire")`; every query combines input ids with `context.session.user.id` in the WHERE clause; zod 4 style; `ORPCError`.
- `create` inserts the start position row (`START_FEN`) in the same transaction; `get` returns the graph built for `@b2c-template/chess` (`isUserMove` derived, not stored).
- Web: container/presentational split like `features/mistakes`; every presentational component has a story and an entry in `tests/lib/app-story-registry.ts`; keyboard use never needs drag; 375 px layout; text alternative for arrows and highlights; `SanInput` beside the board; feature-local tree navigator (`MoveList` is linear).
- About 400 authored lines per task is a planning heuristic only, not a cap.

## Tasks

- [x] **T1 — Repertoire service and router** [T]: service + router + registration + integration tests (flag off → `NOT_FOUND`; ownership isolation; create inserts start; rename/delete; addMove added/duplicate/illegal/cycle/transposition; deleteMove prune keeps transposed positions; setIdeaNote create/edit/clear, plan > 140 rejected, bad square rejected). Branch `feat/chess-lab-v1-p2b`. Route: delegated writer (API, 3+ non-trivial files).
- [x] **T2 — Repertoire list and feature foundation** [T lib, O UI]: `lib/repertoire-tree.ts` (children of a key, path to key, line SANs, subtree-to-be-removed count mirroring the server prune), `lib/idea-note.ts` (plan validation, text alternative, square toggle) with tests; hooks; repertoires list page (create with colour, rename, delete with confirmation); routes with `requireFeature`; navigation entry; stories and registry. Branch `feat/chess-lab-v1-p2b2`. Route: delegated `react-staff`.
- [x] **T3 — Repertoire builder** [O UI, T lib if any]: builder page (board with note arrows/highlights, `SanInput`, board moves, line navigator with child-move buttons and delete-with-confirmation, idea note editor with keyboard-accessible arrow and highlight controls and a 140-char plan counter), stories, SSR tests. Branch `feat/chess-lab-v1-p2b3`. Route: delegated `react-staff`.
- [x] **T4 — Server review fixes** [T]: (a) R4/R3-get-delete-race-500: `get` reads the repertoire, graph and notes in one read transaction and returns `NOT_FOUND` (never a 500) when the repertoire or its start position is gone; (b) R2-name-limit-magic-number: a pure shared module `packages/api/src/lib/repertoire-limits.ts` (name 80, plan 140, note items 32, like `lib/platform-list-config.ts`) used by the router. Branch `feat/chess-lab-v1-p2b4`. Route: delegated writer (API; 3 non-trivial files with tests).
- [ ] **T5 — Builder review fixes** [T lib, O UI]: (a) R4/R3-save-note-clears-newer-draft: after a save, the draft is cleared only when it still equals what was saved, for the same position; (b) R4-delete-discards-surviving-draft: a delete keeps the draft when the current position survives the prune; (c) R2-highlight-cap-split-validation: one place enforces the highlight cap, with one behaviour; (d) R2-name-limit-magic-number (web side): `lib/repertoire-name.ts` and `lib/idea-note.ts` use the shared limits from T4; (e) R3-container-flows-unproved: tests for the builder's add, save, clear and delete flows (flow decisions as pure helpers with tests). Branch `feat/chess-lab-v1-p2b5`. Route: delegated `react-staff`.

## Acceptance criteria

- Spec scenarios for "Navigate and edit the tree", "Idea notes" and "Accessible builder" are covered by tests (server and pure helpers) or by components with stories.
- With the flag off, the router returns `NOT_FOUND`, the route is unreachable and the nav item is hidden.
- All standard checks pass.

## Checks

- Focused: `bun test packages/api/src/routers/repertoire.test.ts packages/api/src/services/repertoire-service.test.ts` (T1); `bun test apps/web/src/features/repertoire tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts apps/web/src/app/navigation.test.ts` (T2, T3).
- Standard: `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check`, `bun test`.

## Progress

- 2026-10-23: feature document created after server and UI mapping. Next: T1.
- 2026-10-23 T1 done (route: delegated writer, 3+ non-trivial files). RED: `bun test packages/api/src/routers/repertoire.test.ts` -> `error: Cannot find module './repertoire'` (0 pass, 1 fail, 1 error). GREEN: router test 18 pass, `repertoire-rows.test.ts` 3 pass; `pnpm db:test:prepare`, `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` exit 0; full `bun test` 1780 pass, 0 fail. Decisions: name trimmed 1..80 (no precedent in the codebase); `addMove` input `move` is SAN or UCI (trimmed, 1..16); `get` returns `{ repertoire, startPositionId, positions[{id,key,fen,sideToMove}], moves[{id,fromPositionId,toPositionId,san,uci,isUserMove}], notes: Record<positionId,{arrows,highlights,plan}> }`; `addMove` returns `{ status: "added"|"duplicate", createdPosition, move }`; `deleteMove` returns `{ removedMoves, removedPositions }`; pure helpers `rowsToGraph` and `reachablePositionIds` live in `services/repertoire-rows.ts` (`packages/chess` unchanged). Commit: see git log (docs(odd) T1).
- 2026-10-23 T2 done (route: delegated react-staff; 20+ non-trivial files). TDD on `lib/` only. RED: `bun test apps/web/src/features/repertoire` -> `error: Cannot find module './repertoire-tree'` (0 pass, 2 fail, 2 errors); same RED for `repertoire-query` and `repertoire-name`. GREEN: 33 lib tests pass (one test expectation was wrong first, `removalPreview` of a transposed branch also removes the outgoing move of the pruned position; fixed the test, matching the server's `removedMoves` count). Components: 4 presentational files with stories and registry entries, SSR tests 8; `pnpm check`, `pnpm check-types`, `pnpm --filter web check-types` exit 0; focused run 105 pass; full `bun test` 1823 pass, 0 fail. Deviations: added `lib/repertoire-name.ts` and `lib/repertoire-query.ts` (`isNotFound`, `shouldRetryRepertoire`, copied pattern from mistakes because features cannot import each other); `lib/idea-note.ts` also exports `toggleArrow`, `MAX_NOTE_ITEMS`, `MAX_PLAN_LENGTH`; `$id.tsx` is a heading plus back link placeholder for T3. Decision gaps: none. Commit: see git log (feat(web) T2).
- 2026-10-23 Review T1+T2 plus `ff30453` (e983e23 to adb2432), 4 lenses: APPROVED and acknowledged. Next review boundary: adb2432.
  - Pending (non-blocking):
    - R4/R3-get-delete-race-500 (WARNING): `get` checks the repertoire outside the read transaction and reads notes outside it too; a delete in between makes `positions.find(...)!` throw, so the client gets a 500 instead of `NOT_FOUND` (and retries).
    - R2-name-limit-magic-number (WARNING): router hardcodes the 80-char name limit; web keeps its own `MAX_NAME_LENGTH` copy with nothing linking them.
    - R2-toggle-square-aliases-input: `toggleSquare` returns the input array at the cap.
    - R2-keyById-misnamed: `keyById` maps id to the whole row.
    - R3-flag-off-partial: flag-off test covers list, create and get only.
    - R3-form-failure-path-unproved: no behaviour test for create and rename submit paths.
    - R3-note-duplicates-selfarrow: server accepts duplicate squares, duplicate arrows and self-arrows.
- 2026-10-23 T3 done (route: delegated react-staff; 12+ non-trivial files). TDD on `lib/` only. RED: `bun test apps/web/src/features/repertoire/lib/builder-state.test.ts` -> `error: Cannot find module './builder-state'` (0 pass, 1 fail, 1 error); `notesEqual` RED: 2 fail (not exported) before implementation. GREEN: lib 46 pass. Components: `repertoire-builder-page` (container), `repertoire-builder-view`, `line-navigator`, `idea-note-editor` with stories, registry entries and SSR tests; `$id.tsx` replaced. Checks: focused run 133 pass; `pnpm check`, `pnpm check-types`, `pnpm --filter web check-types` exit 0; full `bun test` 1851 pass, 0 fail. Decisions: current position and route are component state, not `?at=` in the URL (an id is meaningless after a delete or another tab's edit; `resolvePosition` falls back to the start); board moves call `addMove` and return false, so the board jumps only once the tree holds the move; the note draft is lifted to the container (keyed by position) so the board shows it live; new lib `builder-state.ts` (`parseSquareInput`, `parseArrowInput`, `resolvePosition`, `positionAfterRemoval`, `describeChildMove`) and `notesEqual` in `idea-note.ts`. Deviations: no click-a-square highlight on the board (typed square only). Decision gaps: none. 375 px, touch and keyboard checked structurally only (no browser). Commit: see git log (feat(web) T3).
- Next: review T3 alone (base adb2432).
- 2026-10-23 Review T3 (adb2432 to d7e01f0), 4 lenses: APPROVED and acknowledged. Next review boundary: d7e01f0. Feature P2-b complete.
  - Pending warnings:
    - R4-save-note-clears-newer-draft / R3-save-note-clears-unrelated-draft: `saveNote` clears the draft after the await even if the user kept typing or moved to another position, so newer edits are lost.
    - R4-delete-discards-surviving-draft: a delete always clears the draft, even when the current position survives the prune.
    - R2-highlight-cap-split-validation: the highlight cap is checked in three places with different behaviour.
    - R3-container-flows-unproved: the builder container's add, save, clear and delete flows have no tests.
  - Pending suggestions: R2-describeChildMove-misnamed, R2-square-parse-duplicated, R2-hardcoded-heading-id, R2-fixture-move-param-names, R3-duplicate-stored-note-items (duplicate React keys if the server stores duplicates), R3-editor-interactions-unproved.
- Not verified (needs a browser): 375 px layout, touch, keyboard and focus, board drag and tap, toasts, dialog flow.
- 2026-10-24: the user chose to fix the P2-b warnings first. Added T4 (server) and T5 (builder). Suggestions stay pending. Next: T4.
- 2026-10-24 T4 done (route: delegated writer, 3 non-trivial API files). RED: new router test `get is NOT_FOUND, never a server error, when the start position row is gone` -> `Expected: "NOT_FOUND" Received: "OTHER"` (18 pass, 1 fail). GREEN: router + rows tests 22 pass (parent re-ran: 22 pass). `pnpm db:test:prepare`, `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` exit 0; full `bun test` 1852 pass, 0 fail. `get` reads repertoire, graph and notes in one repeatable-read read-only transaction; missing repertoire or start position -> `NOT_FOUND`; non-null assertions removed. Shared limits: `packages/api/src/lib/repertoire-limits.ts` (`REPERTOIRE_NAME_MAX_LENGTH`, `IDEA_NOTE_PLAN_MAX_LENGTH`, `IDEA_NOTE_MAX_ITEMS`). No true concurrent-race test (deterministic missing-start test instead; get-after-delete already covered). Commit `6501e5d` (~100 authored lines). Review: pending with T5 (group T4+T5). Next: T5.
