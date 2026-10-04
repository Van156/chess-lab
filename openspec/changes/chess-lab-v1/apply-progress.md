# Apply progress: chess-lab-v1

## S0 (PR 1, branch feat/chess-lab-v1-s0)

- Done, commit d53b019. S0.6 manual 375px check pending with the user.

## S1a (PR 2, branch feat/chess-lab-v1-s1a)

- [x] S1a.1 package `@b2c-template/chess` created and registered; `chess.js` moved to the pnpm catalog (web uses `catalog:`).
- [x] S1a.2 RED observed: `Cannot find module './position'` (0 pass, 1 error).
- [x] S1a.3 GREEN: 15 pass. Note: chess.js 1.4 already omits non-capturable en-passant in FEN, so the test uses a raw FEN.
- [x] S1a.4 RED observed: pgn module missing (0 pass, 1 error).
- [x] S1a.5 GREEN: 6 pass.
- [x] S1a.6 `GLOSSARY.md` created from the design glossary.

## Review S0 + S1a (base e28dd17 to cfca8a5)

- Medium risk, reliability lens: APPROVED and acknowledged. Follow-up commits on this branch: f1d86bc (glossary stray row removed), 37e3508 (engine copy explicit in dev/start/build scripts because `vp run` skips npm pre-hooks). Next review boundary: cfca8a5.
- Review follow-up R3-castling-digit-untested: added `parseMove` castling test (`O-O`, `0-0`, UCI `e1g1`, and the queenside forms resolve to the same move). It passed immediately; no bug.

## S1b (PR 3, branch feat/chess-lab-v1-s1b)

- [x] S1b.1 `packages/chess/src/config.ts` (thresholds, CARD_SEVERITIES, MATE_CP, EVAL_CLAMP_CP, OPENING_PLY_LIMIT, ENDGAME_MATERIAL, TIME_PRESSURE_RATIO).
- [x] S1b.2 RED observed: `Cannot find module './classify'` (0 pass, 1 error).
- [x] S1b.3 GREEN: `classify.ts` (`screenCandidates`, `classifyGame`, plus `gamePhase`, `isTimePressure`, `toLossCp`). After fixing three faulty test fixtures (illegal best moves, wrong eval series) and `-0` normalization: 29 classify tests pass.
- [x] S1b.4 idempotence test (same input twice, identical output).
- [x] S1b.5 exports added to `index.ts`.
- Interpretation notes: `PlyEval` is side-to-move relative (UCI) and `evals[i]` is the position after `i` plies. Endgame = non-pawn material at most 13 for EACH side. Plies with a missing/null eval, or without a legal best move, are skipped. `ClassifiedMistake` gained `clockInitialMs` (ADR-05 stores `clock_initial_ms`; not in the design interface).
- Verification: `bun test packages/chess` 51 pass; `bun test` 876 pass, 47 skip, 1 known env failure (requireTestDatabaseOrSkip); `pnpm check-types` and `pnpm --filter web check-types` clean; `pnpm check` changed no tracked files beyond the slice.
- Work Unit Evidence: focused `bun test packages/chess/src/classify.test.ts` 29 pass; runtime harness `bun -e classifyGame(...)` returned one mistake (ply 1, bestSan d4, opening) for a 150 cp loss; rollback boundary `classify.ts`, `config.ts`, `classify.test.ts`, index exports.

- S1b committed as 62ec7f4 (~419 authored lines, slightly over the advisory budget; tests not trimmed).

## S2 (PR 4, branch feat/chess-lab-v1-s2)

- [x] S2.1 conventions confirmed (`db:generate`, audit.ts pattern); `db:generate` needs `DATABASE_URL` set (any value).
- [x] S2.2 RED observed: `bun test packages/db/src/schema/chess-schema.test.ts` 0 pass, 7 fail (tables missing).
- [x] S2.3 GREEN: `lichess.ts`, `settings.ts`, `games.ts`, `cards.ts`. First run had 3 failures caused by the test (Drizzle builders are thenables, `rejects` needs a real promise); fixed with a `run()` wrapper, then 7 pass.
- [x] S2.4 `schema/chess-relations.ts` (`chessRelations` via `defineRelationsPart`), exported from `schema/index.ts` and spread in `relations.ts`.
- [x] S2.5 migration `20261004170342_medical_terrax` (add-only). Drizzle expressed the CHECK `num_nonnulls("mistake_id") = 1` natively, no hand edit.
- [x] S2.6 RED observed: `bun test tests/lint-boundaries.test.ts` 7 pass, 15 fail; fixtures under `tests/lint-boundaries/fixtures/{packages/chess,study,lichess,apps/web/src/app,shared/lib}`.
- [x] S2.7 GREEN: 22 pass. Three overrides added in `.oxlintrc.json`, new web patterns repeated in the `shared/**` override.
- Exact web rule: group `[@b2c-template/lichess(/**), @b2c-template/db(/**), @b2c-template/auth, @b2c-template/auth/**, !@b2c-template/auth/permissions]`. `apps/web/src/app/auth-client.ts` legitimately imports `@b2c-template/auth/permissions` (client-safe), so it is negated; fixture proves permissions stays allowed and `auth` / `auth/audit` fail.
- Verification: `bun test packages/db tests/lint-boundaries.test.ts` 98 pass; `pnpm check-types` clean; `pnpm --filter web check-types` clean; `pnpm check` clean (no warnings; changed only slice files); `bun test` 1016 pass, 1 skip, 0 fail.
- Work Unit Evidence: focused command above; runtime harness = real Postgres test DB with migration applied via `db:test:prepare`; rollback boundary = schema/{lichess,settings,games,cards,chess-relations,chess-schema.test}.ts, index/relations edits, migration dir, `.oxlintrc.json`, lint test and fixtures.

## S2 split (auto-chain)

S2 came in at about 684 authored lines, so it was split at the task boundary (auto-chain): S2a schema (S2.1 to S2.5) on `feat/chess-lab-v1-s2` (PR 4) and S2b package lint rules (S2.6, S2.7) on `feat/chess-lab-v1-s2b` (PR 5, base PR 4). Every later PR number in the tasks forecast shifts by one.
