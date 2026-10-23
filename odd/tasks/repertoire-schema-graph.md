# Feature: Repertoire schema and graph (chess-lab-v1 P2-a)

- **Source:** user request 2026-10-23 — "continue with the next one", then "I want to use ODD". Slice P2-a of `openspec/changes/chess-lab-v1/tasks.md`; design `openspec/changes/chess-lab-v1/design.md` (ADR-03, ADR-04, Phase 2 tables at lines 148-153, glossary position key at line 45); spec `openspec/changes/chess-lab-v1/specs/repertoire/spec.md` ("Repertoire trees per colour", "Transpositions").
- **Branch:** `feat/chess-lab-v1-p2a` from `feat/chess-lab-v1-s12` (`0f82312`). T2 continues on `feat/chess-lab-v1-p2a2` from T1's commit.
- **Delivery:** `auto-chain`, `feature-branch-chain` (cached from the chess-lab-v1 plan). Forecast about 600 authored changed lines (T1 about 250, T2 about 350; generated migration snapshot excluded), so one PR per task: PR 19 = T1, PR 19b = T2.
- **TDD:** on for both tasks (pure logic and DB schema), source `openspec/config.yaml` (`strict_tdd: false`, TDD scoped to server/auth/API and pure logic). Runner: `bun test`.
- **Review (RDD):** user policy: one review for the group T1+T2, auto-consent. Boundary: `0f82312`.

## Objective

Store repertoires per colour as a position graph (positions keyed by normalized FEN, moves as edges) and give `packages/chess` a pure graph module that adds moves, merges transpositions and rejects cycles. No router or UI (that is P2-b).

## Scope

- In: `packages/chess/src/repertoire-graph.ts`; `packages/db/src/schema/repertoire.ts` (`repertoire`, `repertoire_position`, `repertoire_move`, `idea_note`); `card.repertoire_position_id` plus the widened `card_exactly_one_source` CHECK; generated migration; relations; `card-pillar.ts` widened to a `repertoire` pillar; tests.
- Out: router, UI, repertoire cards and the left-repertoire flag (P2-c, blocked on a design refresh), explorer (P2-d), export of repertoire data (P2-e).

## Constraints

- `packages/chess` stays pure and isomorphic (lint boundaries): plain data in and out, no db types. Reuse `positionKey`, `parseMove` from `position.ts`.
- Schema conventions (ADR-03): `text("id")` UUID default, snake_case, `created_at`/`updated_at`, named indexes, every user-owned table has `user_id ... references user(id) on delete cascade`. `repertoire.color` reuses the existing `user_color` enum if it fits.
- Migration is generated with `pnpm --filter @b2c-template/db db:generate` (or the repo's script); the generated SQL must drop and re-add `card_exactly_one_source` as `num_nonnulls(mistake_id, repertoire_position_id) = 1`.
- Export meta-test: the new tables go in the test's `EXCLUDED_TABLES` with the reason "exported in P2-e". Accepted because no router writes these tables before P2-b and the tracker branch only merges to main after Phase 2 export lands; P2-e removes the exclusion.
- About 400 authored lines per task is a planning heuristic only, not a cap.

## Tasks

- [x] **T1 — Pure repertoire graph** [T]: `packages/chess/src/repertoire-graph.ts` and test, exported from `index.ts`. Covers the spec scenarios: add moves in a chain (first move marked as the user's move for that colour), branch, illegal move stored nowhere, duplicate move adds nothing, transposition merges into one position (also when only clocks differ), and a move that would close a cycle is rejected. Route: delegated (writer trigger: module plus test, 2 non-trivial files).
- [x] **T2 — Repertoire schema and card source** [T]: `schema/repertoire.ts`, barrel, relations, `card.repertoirePositionId` plus widened CHECK, generated migration, `card-pillar.ts` (+ test) widened, schema integration tests (unique `(repertoire_id, position_key)`, unique `(from_position_id, uci)`, CHECK with zero and two sources, user-delete cascade), export meta-test exclusion, deletion test seeds a repertoire graph. Route: delegated (writer trigger: 5+ non-trivial files).
- [x] **T3 — Repertoire ownership integrity** [T] (user decision 2026-10-23: "fix that" for the three review warnings): composite foreign keys so a position belongs to its repertoire's user, a move's from/to positions belong to the move's repertoire and user, an idea note and a repertoire card belong to the position's user; CHECK `side_to_move in ('w','b')`; correct the `repertoireMove` comment (DB enforces same-repertoire edges, `packages/chess` rejects cycles). Generated migration plus RED-first schema tests. Branch `feat/chess-lab-v1-p2a2`. Route: delegated (writer trigger: schema, migration, tests). Review: alone (odd last task), base `b2a74c6`.

## Acceptance criteria

- Spec scenarios for "Repertoire trees per colour" and "Transpositions" are covered by T1 tests.
- DB enforces one position per `(repertoire_id, position_key)`, one move per `(from_position_id, uci)`, exactly one card source, and cascades on user delete.
- All standard checks pass.

## Checks

- Focused: `bun test packages/chess` (T1); `pnpm db:test:prepare` then `bun test packages/db packages/api/src/services/export-service.test.ts packages/auth/src/lichess-account.integration.test.ts` (T2).
- Standard: `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check`, `bun test`.

## Progress

- 2026-10-23: feature document created; mapping done (design and spec references above).
- 2026-10-23 T1 done (route: delegated writer). RED: `bun test packages/chess/src/repertoire-graph.test.ts` -> `error: Cannot find module './repertoire-graph' from '.../repertoire-graph.test.ts'` (0 pass, 1 fail). GREEN: `bun test packages/chess` 62 pass, 0 fail; `bun test tests/lint-boundaries.test.ts` 22 pass. Interface: `createGraph(color)`, `addMove(graph, fromKey, input)` -> added | duplicate | illegal | cycle | unknown-position (immutable). Commit `841e211` on `feat/chess-lab-v1-p2a`.
- 2026-10-23 T2 done (route: delegated writer). RED: `bun test packages/db/src/card-pillar.test.ts` -> `(fail) cardPillar > a card with a repertoire position source is a Repertoire card`; `bun test packages/db/src/schema/repertoire-schema.test.ts` (before migrating the test DB) -> `error: relation "repertoire" does not exist` on all 6 tests. GREEN after `pnpm db:test:prepare`: `bun test packages/db packages/api/src/services/export-service.test.ts packages/auth/src/lichess-account.integration.test.ts` 112 pass, 0 fail; `pnpm check-types`, `pnpm --filter web check-types` clean; `bun test` 1751 pass, 0 fail.
- Deviations: migration `20261023222549_repertoire_graph` generated by drizzle-kit (needs `DATABASE_URL` set to run `generate`); it drops and re-adds `card_exactly_one_source` itself, no hand edit. `repertoire.color` reuses `user_color`. The 140-char `plan` limit has no CHECK (no precedent in the schema besides the card source CHECK); P2-b router must validate it. `review-service.hydrate` passes `repertoirePositionId: null` to `cardPillar` because it only joins mistake cards; repertoire card hydration is P2-c.
- 2026-10-23 Review T1+T2 (0f82312 to b2a74c6), 4 lenses: APPROVED and acknowledged. Next review boundary: b2a74c6.
- Non-blocking findings (pending, need a decision before P2-b writes these tables):
  - R3-cross-repertoire-edge / R1-owner-consistency (WARNING): no DB check that a move's from/to positions belong to its `repertoire_id`, or that `user_id` matches across repertoire, positions, moves, idea notes and cards.
  - R3-side-to-move-unchecked (WARNING): `side_to_move` is plain text; the Drizzle `enum` only narrows the TS type, no CHECK `in ('w','b')`.
  - R2-move-same-repertoire-doc (WARNING): the `repertoireMove` comment implies the DB enforces same-repertoire edges and no cycles; it does not.
  - R2-stale-relations-doc: `chess-relations.ts` comment still says Phase 1 only.
  - R2-hydrate-hardcoded-null: a repertoire card reaching `hydrate` before P2-c throws a misleading "invariant broken" error.
  - R3-cascade-test-masks-fk-path: no test deletes a repertoire or position on its own.
  - R3-immutability-unasserted: no test that `addMove` leaves the input unchanged on `added`, or asserts `createdPosition`.
- 2026-10-23 T3 done (route: delegated writer). RED: `bun test packages/db/src/schema/repertoire-schema.test.ts` -> 6 fail (`Expected promise that rejects / Received promise that resolved`) for: position user != repertoire user, move linking another repertoire's position, move user != repertoire user, idea note user != position user, repertoire card user != position user, `side_to_move = 'x'`; happy path and repertoire-delete cascade passed. GREEN after `pnpm db:test:prepare`: schema test 14 pass; `bun test packages/db packages/api/src/services/export-service.test.ts packages/auth/src/lichess-account.integration.test.ts` 120 pass, 0 fail; `pnpm check-types`, `pnpm --filter web check-types`, `pnpm check` exit 0. Full `bun test`: 1758 pass, 1 to 3 fail in `import-service.test.ts` (timing flake, fails identically on the pre-T3 base, unrelated to repertoire tables). Migration `20261023225153_repertoire_ownership`, generated by drizzle-kit with `--hints` (all six FKs as `create`), no hand edit. Deviation: the six single-column FKs to repertoire and repertoire_position were dropped as fully redundant (same cascade); the `user` FKs stay. Resolves R3-cross-repertoire-edge, R1-owner-consistency, R3-side-to-move-unchecked, R2-move-same-repertoire-doc; partly R3-cascade-test-masks-fk-path (repertoire delete only).
- 2026-10-23 Review T3 (b2a74c6 to 4e36f62), 1 lens: APPROVED and acknowledged. Next review boundary: 4e36f62.
  - Pending (non-blocking): R3-position-delete-cascade-unproved (WARNING): no test deletes a single position, so the composite from/to move FKs, idea note and card cascades are not run on their own; R3-rejection-reason-unasserted: negative tests use bare `rejects.toThrow()` without checking which constraint fired.
- Pre-existing failure (parent check 2026-10-23 23:06 UTC): `bun test packages/api/src/services/import-service.test.ts` fails 4 on `0f82312` (before P2-a) and 3 on `4e36f62` (first import cap 5 s timeout, aborted import lease, status without Lichess profile, simultaneous triggers). It passed earlier the same day, so it looks time or environment dependent. Not caused by this feature. Resolved by `ff30453` (test-only: load-sensitive `batchSize: 2` in the cap test and a non-overlapping "simultaneous" trigger; host load average was about 36 to 40). Production code unchanged.
- Next: P2-b (router and builder UI); router must apply `addMove` cycle rejection before inserting.
