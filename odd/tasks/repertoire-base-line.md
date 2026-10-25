# Feature: Repertoire base line, study lines and move-pair tree

- **Source:** user request 2026-10-25: "Add to have something like a base position for the repertory and group line of study. And also a movement should be 1 for one move for white and black just separete when is variation". The screenshot shows the Scotch gambit builder. The Tree tab lists one row per ply ("1. e4 you", "1... e5 reply", ...). On 2026-10-25 the user chose the **saved base line** option: each repertoire stores a base line, the tree shows it as one header, the board opens there, and each branch after it becomes a study line that can be named.
- **Branch:** `feat/repertoire-base-line`, branched from `feat/engine-line-preview` at `d9f2331` (the earlier features are not on `main` yet).
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from earlier features). The forecast is about 900–1200 authored changed lines across T1–T5, so it will be sliced per task group.
- **TDD:** the source is `openspec/config.yaml` (`strict_tdd: false`; TDD applies to pure logic). Pure `lib/` and service helpers are written test-first; components and DB-backed routers get ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Groups: T1+T2, T3+T4, then T5. First boundary: `d9f2331`; after T1+T2: `a4e4fe6`; after T3+T4: `0afe2ac`.

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
- [x] **T3: Study line names and `renameLine`** [O db/api]. Route: delegated writer.
- [x] **T4: Base line UI** [T lib, O UI]. Route: delegated `react-staff`.
- [x] **T5: Study line grouping UI** [T lib, O UI]. Route: delegated `react-staff`.

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
- **T3 done** (`99be9e2`; delegated writer; +196/-2 authored, plus a generated `snapshot.json` of 3440 lines).
  - Schema and migration:
    - `repertoire_move.name`: nullable, with check `repertoire_move_name_check` (non-blank, ≤80).
    - `MAX_LINE_NAME_LENGTH = 80` in `repertoire-limits.ts`.
    - Migration `20261025115717_repertoire_line_name`.
  - API:
    - `get` returns `name` on moves.
    - `renameLine{repertoireId, moveId, name|null}`: trims the name; blank or null clears it; locks the repertoire. NOT_FOUND for a foreign move or another user's repertoire; BAD_REQUEST when over 80.
  - Accepted R3-remove-with-base: router tests now delete a repertoire, and a user, whose base is set. Both pass.
  - No RED: no new pure logic (normalisation is zod in the router), and the tests were written after the code.
  - Checks:
    - `pnpm check-types`: 0 errors.
    - `pnpm check`: clean.
    - Required `bun test`: 928 pass, 0 fail.
    - DB-backed tests: 62 pass, 0 skipped.
  - Parent spot check: router tests pass.
  - Unverified: names with emoji (zod counts UTF-16 code units, the DB counts characters; the API is only stricter).
- **T4 done** (`b5ad8bc`; delegated to `react-staff`; 21 files, about +614/-50, tests and stories included).
  - Pure `lib/base-line.ts`:
    - `baseLine` takes the shortest `pathTo` route. It is empty for no base, the start, or a missing position.
    - `baseHeading`, `canSetBase`, `basePly`.
  - `buildVariationTree(graph, path, base)` roots the tree at the base. Routes stay complete from the start.
  - `resolvePosition`, when no position is given, uses the base, and the start otherwise.
  - New `BaseLineHeader`:
    - The heading reads "Base: 1. e4 e5 …" or "Start position".
    - Buttons: "Set as base" and "Clear base".
  - Moves before the base sit in a closed "All lines from the start position" fold.
  - Line navigator: `Start`, `Base`, then the moves after the base.
  - `useRepertoire.setBase` reloads on settle and reports failures as a toast.
  - RED: `Cannot find module './base-line'`, plus 8 rooted-tree and resolve failures. GREEN: lib 317 pass.
  - Checks:
    - `pnpm check-types`: exit 0.
    - `pnpm check`: clean.
    - Required `bun test`: 460 pass, 0 fail.
  - Parent spot check: base-line lib and header tests pass.
  - Unverified:
    - no browser run (375px, 44px, a real `setBase` from the page);
    - no container-level test;
    - duplicate accessible labels when the full-tree fold is open.
- **Review T3+T4.**
  - Range: base `a4e4fe6` through `0afe2ac`, committed-only, `.codegraph/` excluded.
  - Consent granted (standing). One lens (reliability). **Approved** and acknowledged (lineage `review-22036e8426faa6f1`, authority burned).
  - Findings (non-blocking):
    - R3-full-tree-fold-duplicate-current (WARNING): with the full-tree fold open, moves after the base on the shown line render twice with `aria-current`, and both trees share the collapsed set. No test renders the fold open. **Accepted into T5**, which reworks the same tree.
    - R3-resolve-orphan-base (SUGGESTION): `resolvePosition` uses a base that is held but unreachable, while the header treats it as no base. **Accepted into T5**: use the same reachability rule in both.
    - R3-changebase-wiring-untested (SUGGESTION): the container's `changeBase` (pin, toast, disabling) has no container test. Follow-up.
  - Next review boundary: `0afe2ac`.
- **T5 done** (`ff88523`, delegated to `react-staff`; 19 files, +656/-40).
  - Pure `lib/study-lines.ts`:
    - `studyLines(tree)` builds one group per move leaving the base or start.
    - The root fork is not nested.
    - `lineNameEdit` trims the name and skips saves that change nothing.
  - `TreeNode.name` comes from the graph.
  - New `StudyLineName` handles inline rename: Enter or blur saves, Escape cancels, `maxLength` 80, 44px edit button.
  - The current group is marked.
  - `useRepertoire.renameLine` reloads on settle and reports a failure as a toast.
  - Accepted R3-full-tree-fold-duplicate-current:
    - The fold is a separate `FullTreeFold` with its own collapsed state.
    - Pure `clearPath` strips `onPath` and `isCurrent`, so there is no duplicate `aria-current`.
    - Tested with the fold open; reverting `clearPath` makes the test fail.
  - Accepted R3-resolve-orphan-base: `resolvePosition` uses the base only when `baseLine` is non-empty. Tested.
  - RED: `Cannot find module './study-lines'`, `clearPath` not found, and the orphan case returned "orphan". GREEN: lib 336 pass.
  - Checks:
    - `pnpm check-types`: exit 0.
    - `pnpm check`: clean.
    - Required `bun test`: 487 pass, 0 fail.
  - Parent spot check: web repertoire tests pass.
  - Unverified:
    - No browser run.
    - Rename edit interactions have no DOM test, since no DOM test library is installed.
    - No container test for `renameLineById`.
- Next: review T5 alone.
