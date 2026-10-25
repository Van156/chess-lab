# Feature: Tree editing shortcuts (no Engine tab, arrow navigation, undoable delete)

- **Source:** user request 2026-10-25, a follow-up to the Tree-tab engine block (`6c008c8`):
  - "the tab for engine is not necessary";
  - "the arrows can move between the positions";
  - "not add dialog to delete a line, include control + z … to go back if [it] was a mistake".
- **Branch:** `feat/tree-editing-shortcuts`, from `feat/tree-engine-moves` at `6c008c8`.
- **Delivery:** `auto-chain`, `feature-branch-chain`, reused from the previous feature. The forecast is about 700 authored changed lines, so it is chained by review group.
- **TDD:** the source is `openspec/config.yaml` (`strict_tdd: false`; TDD applies to pure logic). The pure key mapping and the snapshot/restore logic are test-first. The UI gets ordinary checks. Runner: `bun test`.
- **Review (RDD):** on (global). User policy: review every two tasks, with auto-consent. Groups: T1+T2, then T3+T4. First boundary: `6c008c8`.

## Objective

Build the repertoire from the Tree tab alone:

- the engine lines, switch and retry live there;
- the arrow keys walk the positions;
- deleting a line is instant, and Ctrl/Cmd+Z undoes it.

## Problem / why

- **The Engine tab duplicates the Tree block.** It is still the only home of the Stockfish switch, the Retry button and the live announcement.
- **Arrow keys only step through an engine-line preview.** They do not move between positions.
- **Delete opens a ConfirmDialog.** On the server it is a hard delete in one transaction that cascades to unreachable positions, their idea notes and line names, and clears the base. There is no restore. Undo by replaying `addMove` would lose ids, names, notes and the base, and would not be atomic.

## Decisions

- **Engine:** remove the Engine tab. The Tree-tab block gains the Stockfish switch, Retry when unavailable, the terminal message and the sr-only announcement. There is one engine component, not two.
- **Arrow keys:**
  - Left goes to the parent (the previous ply).
  - Right goes to the first child: the main-line or base child first, otherwise the first stored child.
  - Home goes to the start position.
  - End follows the first child to the leaf.
  - Keys are ignored when they come from inputs, textareas, contenteditable, tabs, sliders or radios, or when a modifier is held.
  - The engine-line preview keeps its own arrows while it is open.
- **Delete:**
  - There is no dialog.
  - The server `deleteMove` returns a snapshot of everything it removed: the move rows (with names), the position rows, the idea notes, and the previous `basePositionId` when it was cleared.
  - A new `restoreDeleted` endpoint re-inserts that snapshot with the original ids, in one transaction under `lockRepertoire`.
  - Restore is rejected when the snapshot no longer fits: the parent position is gone, an edge `(fromPositionId, uci)` now exists, or the repertoire is not the user's. A position row that exists again (a transposition re-added) is reused, not duplicated.
- **Undo:**
  - The client keeps a stack of deletion snapshots for the current page (it is cleared on navigation away).
  - Ctrl+Z, or Cmd+Z on macOS, restores the latest one, and after the restore the board goes back to the restored move.
  - The deletion toast also shows an "Undo" action.
  - Undo is ignored in text fields, so it does not hijack the native undo while typing an idea note or a name.
  - There is no redo.

## Scope

- **T1: Remove the Engine tab** [O].
  - The Tree block owns the switch, retry, terminal message and announcement.
  - Remove `EnginePanel`, or fold it into the Tree block, with its story, test and registry entries.
  - Update the view tests and stories.
- **T2: Arrow-key position navigation** [T].
  - A pure `lib/` key-to-target mapping, test-first.
  - A hook that binds it on the builder page, with `aria-keyshortcuts` hints.
  - It coexists with the preview's arrows.
- **T3: Deletion snapshot and restore (API)** [T].
  - `deleteMove` returns the snapshot.
  - Add the `restoreDeleted` route and service, with validation, ownership and a single transaction.
  - Service and router tests.
- **T4: Delete without a dialog, with undo** [O].
  - Remove the ConfirmDialog from the delete flow.
  - Add the undo stack, the Ctrl/Cmd+Z hook and the toast Undo action.
  - Tests and stories.

## Constraints

- Container/presentational split. Every presentational component has a story and a registry entry.
- One shared engine worker. Respect the hidden-tab and pause policies.
- Targets are at least 44 px. No horizontal scroll at 375 px. Rank is never conveyed by colour alone.
- Authorization: restore only into the caller's own repertoire, the same as `deleteMove`.
- About 400 authored lines per task is a planning heuristic only, not a cap.

## Tasks

- [ ] **T1: Remove the Engine tab**. Route: delegated `react-staff` (React, 2+ non-trivial files).
- [ ] **T2: Arrow-key navigation**. Route: delegated `react-staff`, the same writer as T1.
- [ ] **T3: Deletion snapshot and restore (API)**. Route: delegated general writer (API and DB, 2+ files).
- [ ] **T4: Delete without a dialog, with undo**. Route: delegated `react-staff`.

## Acceptance criteria

- There is no Engine tab. From the Tree tab you can turn Stockfish on and off, see its lines, preview, Add, and Retry.
- Left, Right, Home and End move the board through the tree. Typing in a note or name field never moves the board.
- Clicking delete on a move removes it at once, without a dialog.
- Ctrl/Cmd+Z, or the toast's Undo, brings back the same moves, positions, line names, idea notes and base.
- Undoing several deletes in a row restores them newest first.

## Checks

- `bun test apps/web/src/features/repertoire`
- `bun test packages/api`
- `bun run check-types` (apps/web)
- `bunx oxlint` on the touched paths

## Progress

- Nothing started yet.
