# Feature: Repertoire base line, study lines and move-pair tree

- **Source:** user request 2026-10-25: "Add to have something like a base position for the repertory and group line of study. And also a movement should be 1 for one move for white and black just separete when is variation". The screenshot shows the Scotch gambit builder. The Tree tab lists one row per ply ("1. e4 you", "1... e5 reply", ...). On 2026-10-25 the user chose the **saved base line** option: each repertoire stores a base line, the tree shows it as one header, the board opens there, and each branch after it becomes a study line that can be named.
- **Branch:** `feat/repertoire-base-line`, branched from `feat/engine-line-preview` at `d9f2331` (the earlier features are not on `main` yet).
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from earlier features). The forecast is about 900–1200 authored changed lines across T1–T5, so it will be sliced per task group.
- **TDD:** the source is `openspec/config.yaml` (`strict_tdd: false`; TDD applies to pure logic). Pure `lib/` and service helpers are written test-first; components and DB-backed routers get ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Groups: T1+T2, T3+T4, then T5. First boundary: `d9f2331`; after T1+T2: `a4e4fe6`.

## Objective

1. Show the variation tree as full moves: White and Black on one row (`1. e4 e5`), with a new row only where a variation branches.
2. Let each repertoire save a **base line**, the position the study starts from.
   - The tree shows the moves up to it as one header.
   - The board opens there.
   - Every branch after the base is a **study line** with an optional name.

## Problem / why

- One row per ply doubles the tree's height and reads unlike chess notation.
- A repertoire such as "Scotch gambit" always starts with the same moves. Today they are mixed into the tree, every visit starts at the initial position, and nothing groups or names the lines being studied.

## Scope

- **T1: Move-pair rows (web).** `lib/variation-tree.ts` (or a new pure helper) groups consecutive plies into full-move rows.
  - A row is `N. white black`.
  - A row breaks early when White's move has alternatives, or when a line or alternative starts with Black. That case renders as `N... black`.
  - Each half-move stays its own button: select, current/on-path state, and side tag kept as an accessible label.
  - Fork toggle and delete stay per half-move.
  - Alternatives render below the row that holds the move they are alternatives to.
- **T2: Base position storage (db + api).**
  - New nullable `repertoire.base_position_id`, with a composite FK to `repertoire_position(id, repertoire_id, user_id)` and `on delete set null`. Migration generated with `pnpm db:generate --name repertoire_base_line`.
  - `get` returns `basePositionId`, which is null when no base is set.
  - New procedure `setBase{repertoireId, positionId|null}`. It validates ownership and that the position belongs to the repertoire.
  - `deleteMove` pruning may remove the base position, in which case the FK clears it. Tested.
- **T3: Study line names (db + api).**
  - New nullable `repertoire_move.name`, with a ≤80 limit in `lib/repertoire-limits.ts`.
  - `get` returns `name` on moves.
  - New procedure `renameLine{repertoireId, moveId, name|null}`, with ownership checks. Blank clears the name.
- **T4: Base line UI (web).**
  - The tree header shows "Base: 1. e4 e5 2. Nf3 Nc6 3. d4 exd4" (or "Start position" when no base is set). A "Set as base" action uses the current position, and "Clear base" removes it.
  - The tree under the header starts at the base position.
  - The board and builder open at the base position on load.
  - The line navigator starts its strip at the base.
  - The path to the base is the shortest route (`pathTo`).
- **T5: Study line grouping UI (web).**
  - Each move leaving the base position starts a study-line group in the tree, with its name (or an "Unnamed line" placeholder) and inline rename.
  - Groups use move-pair rows from T1.

Out of scope:

- Multiple base lines per repertoire.
- Reordering lines.
- Study/drill scheduling changes.
- Names on moves deeper than the first move after the base.

## Constraints

- Keep the container/presentational split (`repertoire-builder-page.tsx` holds data, `repertoire-builder-view.tsx` renders). Pure logic lives in `lib/` with tests.
- Use Tailwind and `@b2c-template/ui`.
- Accessibility:
  - Real buttons and labels.
  - Targets of at least 44px.
  - No horizontal scroll at 375px.
- DB:
  - Always filter by `userId` and `repertoireId`.
  - Use `lockRepertoire` for writes.
  - Use composite FKs, as in the existing tables.
- Update stories for changed components.

## Tasks

- [x] **T1: Move-pair rows in the variation tree** [T lib, O UI]. Route: delegated `react-staff` (lib + component, 2+ non-trivial files).
- [x] **T2: Base position storage and `setBase`** [O db/api, T rows helpers]. Route: delegated writer (schema, migration, service, router, tests).
- [ ] **T3: Study line names and `renameLine`** [O db/api]. Route: delegated writer.
- [ ] **T4: Base line UI** [T lib, O UI]. Route: delegated `react-staff`.
- [ ] **T5: Study line grouping UI** [T lib, O UI]. Route: delegated `react-staff`.

## Acceptance criteria

- The Scotch gambit tree reads `1. e4 e5`, `2. Nf3 Nc6`, `3. d4 exd4`, `4. c3`. Rows split only where a variation branches.
- After "Set as base" at 3... exd4:
  - Reload opens the board at that position.
  - The tree shows a one-line base header, with the branches after it as study lines.
  - Each study line can be named, and the name persists.
- Deleting moves that remove the base position clears the base without errors.
- All checks below pass.

## Checks

- `pnpm check-types`
- `pnpm check`
- `bun test apps/web/src/features/repertoire packages/api packages/chess tests/ui-story-coverage.test.ts tests/lint-boundaries.test.ts`
- DB-backed API tests need Postgres (`pnpm db:start`, `pnpm db:test:prepare`). Without a database they skip; report that as a skip, not as a pass.

## Progress

- Feature document created (`d6fd304`).
- **T1 done** (`a2aed80`, delegated to `react-staff`; 4 files, +247/-38).
  - New pure `lib/move-rows.ts`: `toMoveRows(line)` returns rows of the form `{moveNumber, white?, black?, fork?}`.
    - A row closes after any half-move that has alternatives.
    - A Black move that cannot pair opens an `N... black` row.
  - `variation-tree.tsx` renders one row per full move. Each half-move is its own button (select, fork chevron, delete).
    - The visible you/reply tags are dropped; accessible labels keep them.
    - The alternative and transposition markers are kept.
  - RED: `bun test lib/move-rows.test.ts` failed with "Cannot find module './move-rows'". GREEN: 7 pass.
  - Checks:
    - `pnpm check-types`: OK.
    - `pnpm check`: clean.
    - `bun test` (web repertoire + story coverage + lint boundaries): 421 pass, 0 fail.
  - Parent spot check: move-rows + variation-tree tests 17 pass.
  - Unproven: no browser run (375px fit, 44px targets).
- **T2 done** (`3c6dcb5`; delegated writer; about 217 authored lines plus a generated `snapshot.json` of 3420 lines).
  - Migration: `repertoire.base_position_id` gets a composite FK to `repertoire_position(id, repertoire_id, user_id)` with `ON DELETE SET NULL ("base_position_id")` (Postgres 18).
    - The SQL was hand-edited to add the column list, because drizzle cannot express it. Without it, a plain SET NULL would null the repertoire's `id`/`user_id`.
    - The constraint was confirmed in the test DB via `pg_get_constraintdef`.
  - `setBase{repertoireId, positionId|null}`:
    - locks the repertoire;
    - checks ownership, membership and reachability (NOT_FOUND otherwise);
    - stores the start position as null.
  - `get` returns `basePositionId`. `deleteMove` needed no code change: the FK clears the base when pruning removes it.
  - No RED recorded. There is no new pure logic, and the DB-backed tests were written after the code.
  - Checks:
    - `pnpm check-types`: 0 errors.
    - `pnpm check`: clean.
    - Required `bun test`: 920 pass, 0 fail.
    - DB tests ran against Postgres on :5437: 61 pass, 0 skipped.
  - Parent spot check: router tests 38 pass.
  - Unverified: the migration was not run on a DB with existing repertoires (the column is nullable, so no backfill is needed).
- **Review T1+T2.**
  - Range: base `d9f2331` through `a4e4fe6`, committed-only, untracked `.codegraph/` excluded.
  - Consent granted (standing). One lens (reliability). **Approved** and acknowledged (lineage `review-b7a909f48b9f762e`, authority burned).
  - Non-blocking findings:
    - R3-remove-with-base-untested (WARNING): no test deletes a repertoire or user whose base is set. There is an FK cycle, with cascade from repertoire to position and SET NULL back. **Accepted into T3** as a router test.
    - R3-unreachable-base-branch-untested (SUGGESTION): the `setBase` guard against an orphan, unreachable position has no test. Left as a follow-up.
  - Next review boundary: `a4e4fe6`.
- Next: T3.
