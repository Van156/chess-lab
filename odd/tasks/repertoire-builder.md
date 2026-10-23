# Feature: Repertoire router and builder UI (chess-lab-v1 P2-b)

- **Source:** user request 2026-10-23 — "yes and then continue with the next one". Slice P2-b of `openspec/changes/chess-lab-v1/tasks.md` (line 308); design `openspec/changes/chess-lab-v1/design.md` (router table lines 480-494, board contract 405-440, flags 443); spec `openspec/changes/chess-lab-v1/specs/repertoire/spec.md` ("Navigate and edit the tree" L53-67, "Idea notes" L69+, "Accessible builder" L165-173); `specs/app-shell/spec.md` L11-17, 28. Builds on P2-a (`odd/tasks/repertoire-schema-graph.md`).
- **Branch:** `feat/chess-lab-v1-p2b` from `feat/chess-lab-v1-p2a2` (`ff30453`). T2 on `feat/chess-lab-v1-p2b2`, T3 on `feat/chess-lab-v1-p2b3`, each from the previous task's commit.
- **Delivery:** `auto-chain`, `feature-branch-chain`. Forecast about 1,300 authored changed lines (T1 about 450, T2 about 400, T3 about 450), one PR per task: PR 20 = T1, PR 20b = T2, PR 20c = T3.
- **TDD:** source `openspec/config.yaml` (`strict_tdd: false`, TDD for server/auth/API and pure logic). T1 on; T2 and T3 on for pure `lib/` helpers, ordinary checks for components. Runner: `bun test`.
- **Review (RDD):** user policy, groups of two, auto-consent. Groups: T1+T2 (base `e983e23`, includes the test fix `ff30453`), then T3 alone.

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
- [ ] **T3 — Repertoire builder** [O UI, T lib if any]: builder page (board with note arrows/highlights, `SanInput`, board moves, line navigator with child-move buttons and delete-with-confirmation, idea note editor with keyboard-accessible arrow and highlight controls and a 140-char plan counter), stories, SSR tests. Branch `feat/chess-lab-v1-p2b3`. Route: delegated `react-staff`.

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
