# Proposal: Chess Lab v1

## Intent

Club players (Lichess 1200 to 2000) repeat the same opening mistakes because the tools that show a mistake, teach a line and train board vision never talk to each other, and nothing brings the material back at the right time. Chess Lab v1 turns the user's own Lichess games, a self-built visual repertoire and blindfold drills into one daily FSRS review session of 10 to 20 minutes.

The repository today is a generic B2C template (better-auth email/password, admin, audit log) plus a throwaway Midnight prototype under `apps/web/src/routes/prototype/*`. There is no chess code, no chess dependency and no spec in `openspec/specs/`. This change delivers the whole PRD (`docs/prd.md`, FR-01 to FR-19, NFR-01 to NFR-08) across its four release phases. Implementation is sliced into chained PRs within the 400-line review budget.

Success means the PRD outcomes are measurable: every engine-flagged mistake becomes a card, repertoire positions become cards, blindfold drills record depth, and one queue schedules everything with grades that are never lost.

## Scope

### In Scope

- **Phase 1, mistake loop:** Lichess sign-in (OAuth 2.0 + PKCE through better-auth `generic-oauth`), encrypted Lichess token storage, streamed game import (first window, then incremental syncs), in-browser Stockfish analysis, mistake classification and mistake cards, FSRS daily queue with a new-card limit, review session, PGN/JSON export, account deletion. Also the Midnight app shell (sidebar, Today home) and the shared board foundation.
- **Phase 2, repertoire:** White/Black repertoire trees built on the board with branches and FEN-normalized transpositions, idea notes (arrows, highlighted squares, one-line plan), Lichess opening explorer stats, repertoire cards, and the "left your repertoire" flag on imported games.
- **Phase 3, blindfold:** coordinates, square colour, replay (peek counting) and engine-blindfold drills; voice move input through the Web Speech API with typed SAN always available.
- **Phase 4, insight:** progress dashboard (streak, accuracy per pillar, repeat-mistake trend, weakest openings, blindfold best depth, heatmap) and mistake filters (opening, game phase, time pressure).
- **Cross-cutting:** Stockfish licence and source page; per-phase feature flags so an unfinished pillar can be hidden; one template-cleanup slice (prototype routes, unused admin/template UI from the navigation).

### Out of Scope

- Playing games against other people, Lichess studies or puzzle import, Chess.com import, a paid tier, native mobile apps (PRD non-goals).
- Multi-thread Stockfish (needs `SharedArrayBuffer` and cross-origin isolation headers); v1 uses the single-thread lite build.
- Server-side engine analysis (violates NFR-01).
- Stripping the template before delivering value (exploration Approach B) and custom OAuth outside better-auth (Approach C).
- Deciding the PRD open questions listed below; this proposal only sets reversible defaults where safe.
- Legal advice on GPL-3.0. The Stockfish arrangement is flagged as a launch gate that needs confirmation.

## Capabilities

`openspec/specs/` is empty, so every capability is new. Capabilities are listed in release-phase order; each becomes `openspec/changes/chess-lab-v1/specs/<name>/spec.md`.

### New Capabilities

| Capability         | Covers                                                                                                                                                                                                                                                                                                                 | Phase | Depends on                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| `app-shell`        | Midnight theme (navy + mint, left sidebar, 16 px radius), navigation pruned to Chess Lab pillars, Today home, per-phase feature flags, NFR-02 Today load, NFR-03 375 px layout                                                                                                                                         | 1     | none                                                       |
| `chess-board`      | Client-only board wrapper (react-chessboard v5 + chess.js): touch, arrows, square highlights, empty piece set for blindfold, accessible move list, typed SAN input validated against legal moves (FR-10 typed part, NFR-03, NFR-04)                                                                                    | 1     | board spike at 375 px                                      |
| `lichess-account`  | Sign in with Lichess (FR-01): immutable Lichess id as account subject, username refreshed each sign-in, synthetic non-deliverable email, token encrypted at rest and never sent to the browser (NFR-05)                                                                                                                | 1     | template auth                                              |
| `game-import`      | First import and incremental syncs (FR-12): NDJSON streaming, one request at a time per user, HTTP 429 backoff (NFR-06), resumable without duplicates (NFR-07)                                                                                                                                                         | 1     | `lichess-account`                                          |
| `engine-runtime`   | Stockfish as a separate, unmodified single-thread lite Web Worker file, lazy-loaded, job queue, shallow-then-deep analysis, per-move eval persistence for resume (NFR-01), licence and source offered (NFR-08)                                                                                                         | 1     | none (asset only)                                          |
| `mistake-analysis` | Classify inaccuracies, mistakes and blunders by eval loss (FR-13); store normalized FEN, played move, best move, phase, clock left, ECO; turn mistakes into cards (FR-14)                                                                                                                                              | 1     | `game-import`, `engine-runtime`, `review-queue`            |
| `review-queue`     | One card table with a single source (mistake, repertoire node, drill); FSRS via ts-fsrs; daily queue with new-card limit (FR-04); review session with prompt, move input, Show answer, Again/Hard/Good/Easy (FR-17); next card under 200 ms (NFR-02); grades never lost via client outbox + idempotent submit (NFR-07) | 1     | `chess-board`                                              |
| `data-control`     | Export all personal data as PGN and JSON; delete the account and all its data (FR-19), working for Lichess-only users                                                                                                                                                                                                  | 1     | all Phase 1 tables; later phases extend export coverage    |
| `repertoire`       | Repertoire trees with branches and transpositions (FR-02), idea notes (FR-03), repertoire cards for user-to-move positions (FR-06), left-repertoire flag with "add this line" (FR-16)                                                                                                                                  | 2     | `review-queue`, `chess-board`; FR-16 also `game-import`    |
| `opening-explorer` | Lichess explorer stats (games, W/D/L) beside each candidate move for a rating band (FR-05)                                                                                                                                                                                                                             | 2     | `repertoire`, Lichess client                               |
| `blindfold-drills` | Coordinates (FR-07), square colour (FR-08), replay with peek counting (FR-09), engine blindfold with peek-depth levels (FR-11); DrillSession records; drill results feed cards                                                                                                                                         | 3     | `review-queue`, `chess-board`; FR-11 also `engine-runtime` |
| `voice-move-input` | Speech-to-SAN validated against legal moves, feature-detected, typed SAN always offered (FR-10 voice part)                                                                                                                                                                                                             | 3     | `chess-board`                                              |
| `mistake-filters`  | Filter mistakes by opening, game phase and time pressure (clock under 10% of start time) (FR-15)                                                                                                                                                                                                                       | 4     | `mistake-analysis`                                         |
| `progress`         | Dashboard: streak, accuracy per pillar, repeat-mistake rate trend, weakest openings, blindfold best depth, review heatmap (FR-18)                                                                                                                                                                                      | 4     | ReviewLog, Mistake, DrillSession data                      |

### Modified Capabilities

None. No specs exist yet. Template auth behaviour (email/password, emailed delete link) changes for Lichess users; that is captured inside `lichess-account` and `data-control` rather than as delta specs.

## Approach

Exploration **Approach A: evolve the template in place.** Reuse better-auth sessions, Drizzle, oRPC procedures and the feature-boundary lint. Change navigation only; defer template pruning to one cleanup slice.

- **Deep pure modules first (TDD with `bun test`):**
  - `packages/chess`: chess.js wrappers, PGN/SAN, FEN normalization, mistake classification (eval loss, phase, clock under 10%), repertoire tree operations with transpositions, spoken-move to SAN, ECO helpers.
  - `packages/study`: ts-fsrs wrapper, card row to FSRS state, grading, queue selection with the daily new-card limit.
  - Both expose small interfaces and stay isomorphic, so web and server share one implementation.
- **Server-only `packages/lichess`:** profile fetch, streamed game export, explorer client, per-user single-flight queue with 429 backoff. `fetch` is injected as the test seam.
- **Auth:** better-auth `generic-oauth` provider for Lichess with PKCE S256 and no client secret. `getUserInfo` reads `/api/account`; `accountSubject` is the immutable Lichess id; `mapProfileToUser` sets `<lichessId>@lichess.invalid` with `emailVerified: true` (the verified constraint is `user.email` NOT NULL UNIQUE). Turn on `account.encryptOAuthTokens`.
  - **Default scope set:** no scopes. Own-game export needs none, and the token serves only rate-limit identification. `email:read` is not requested.
- **Deletion that works without email:** the emailed delete link cannot reach Lichess-only users. Delete requires a fresh session (recent sign-in, otherwise re-auth through Lichess) plus the user typing their Lichess username. This works whatever is decided about email sign-in.
- **Data:** add schema files `lichess`, `games`, `repertoire`, `cards`, `drills` to `packages/db`. Every table gets an FK to `user.id ON DELETE CASCADE`. `card` is one table with nullable per-source FKs and a CHECK that exactly one is set. Games are unique on (user, Lichess game id).
- **API:** `protectedProcedure` oRPC routers for lichess, games, mistakes, review, repertoire, drills and progress. Export is a streamed Hono route.
- **Engine:** the Stockfish worker is served as a separate static asset and is never bundled. A typed `analyse(...)` wrapper lives in a web feature. Evals computed by the client go to the server through oRPC; they only affect the user's own data.
- **Web:** feature folders `lichess-account`, `games`, `mistakes`, `review`, `repertoire`, `blindfold`, `progress`, `data-control`, each with an `index.ts`. The board lives in `shared/components/board`. The Midnight look is ported from the prototype into the real shell.
- **Safe configurable defaults (constants, not product decisions):**
  - `IMPORT_WINDOW_MONTHS = 3` for the first import.
  - Eval-loss thresholds as constants. Default: inaccuracy 50 cp, mistake 100 cp, blunder 200 cp. Default carding: mistakes and blunders only.
  - Explorer rating band from one `ratingBandFor(user)` function, defaulting to the user's own band.
  - Email/password sign-up UI hidden behind a flag (default off) while the backend stays intact, pending the email sign-in decision.
- **Delivery:** `auto-chain` with a 400-line budget per PR. Each slice has a clear start and finish, its tests travel with it, and it can be reverted on its own. Phase 1 starts with S0, a dependency and spike slice: board at 375 px touch, checking the Lichess API docs, and checking token encryption coverage for generic-oauth.

## Size Forecast

Authored changed lines (additions + deletions), excluding generated migrations and lockfiles.

| Phase                                     | Estimate            | Approx. PR slices                                                                                                                                                                                                                                              | 400-line risk        |
| ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1, mistake loop (+ shell, board, cleanup) | 3,500 to 4,500      | 10 to 12 (S0 spike, S1 `packages/chess`, S2 DB schema, S3 Lichess auth, S4 Lichess client + import, S5 `packages/study` + review router, S6 board + review UI, S7 engine + mistake pipeline, S8 Today + mistakes UI, S9 export + delete, S10 template cleanup) | High, chain required |
| 2, repertoire                             | 1,800 to 2,400      | 5 to 6                                                                                                                                                                                                                                                         | High                 |
| 3, blindfold                              | 1,500 to 2,000      | 4 to 5                                                                                                                                                                                                                                                         | High                 |
| 4, insight                                | 900 to 1,300        | 3                                                                                                                                                                                                                                                              | Medium               |
| **Total**                                 | **7,700 to 10,200** | **22 to 26**                                                                                                                                                                                                                                                   | Chained PRs required |

## Affected Areas

| Area                                              | Impact       | Description                                                                            |
| ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `packages/chess`                                  | New          | Pure chess domain logic (TDD)                                                          |
| `packages/study`                                  | New          | FSRS scheduling and queue selection (TDD)                                              |
| `packages/lichess`                                | New          | Server-only Lichess client, streaming, throttling                                      |
| `packages/auth`                                   | Modified     | generic-oauth Lichess provider, token encryption, deletion flow for Lichess-only users |
| `packages/db/src/schema/*`                        | New/Modified | `lichess`, `games`, `repertoire`, `cards`, `drills` schemas; new migrations            |
| `packages/api`                                    | Modified     | New protected routers; remove `privateData` demo in cleanup                            |
| `apps/server`                                     | Modified     | Streamed export route, import job wiring                                               |
| `apps/web/src/features/*`                         | New          | Chess Lab feature folders listed above                                                 |
| `apps/web/src/shared/components/board`            | New          | Board wrapper                                                                          |
| `apps/web/src/routes/*`                           | Modified     | Midnight shell and pillar routes; `prototype/*` removed in cleanup                     |
| `apps/web/public` (worker asset)                  | New          | Unmodified Stockfish worker, licence and source link                                   |
| `packages/ui`                                     | Modified     | Midnight theme tokens                                                                  |
| `tests/lint-boundaries.test.ts`, `.oxlintrc.json` | Modified     | Boundary rules for new features/packages if needed                                     |
| `package.json` files / lockfile                   | Modified     | react-chessboard, chess.js, ts-fsrs, stockfish (asset only)                            |

## Risks

| Risk                                                                                                                   | Likelihood | Mitigation                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stockfish GPL-3.0 creates licence duties for the app                                                                   | Med        | Ship it as a separate, unmodified worker file; show the licence and link the source; no GPL code in the bundle. **Launch gate:** this reading must be confirmed before the public launch (not legal advice). |
| Lichess export parameters, throttle rules and explorer auth not verified                                               | Med        | S0 checks the current API docs before S4; injected `fetch` and contract tests; 429 backoff.                                                                                                                  |
| `encryptOAuthTokens` coverage for generic-oauth not verified; enabling it may break existing plaintext tokens (Google) | Med        | Verify in installed code during S0/S3; migrate or invalidate existing tokens; document how `BETTER_AUTH_SECRET` rotation works.                                                                              |
| Email-based template flows (delete, change email, set password) break for Lichess-only users                           | High       | Delete through fresh session + typed username; hide email-dependent account UI for Lichess-only users.                                                                                                       |
| react-chessboard touch at 375 px is weak                                                                               | Med        | S0 spike; keep the board behind one wrapper interface so cm-chessboard can replace it.                                                                                                                       |
| In-browser analysis is slow on phones                                                                                  | High       | Shallow pass first, deepen in the background, persist per-move evals, resume across sessions.                                                                                                                |
| NFR-02 budgets missed (Today under 2 s, next card under 200 ms)                                                        | Med        | Lazy-load the worker and board; prefetch the queue; measure in the shell slice.                                                                                                                              |
| Web Speech API support varies                                                                                          | High       | Feature-detect it; typed SAN always present.                                                                                                                                                                 |
| Server hosting: `packages/infra` deploys only the web app                                                              | Med        | Design phase decides where the Bun server runs before the first tester release.                                                                                                                              |
| Scope size (~22 to 26 PRs) causes reviewer fatigue                                                                     | Med        | auto-chain, 400-line slices, phase feature flags.                                                                                                                                                            |

## Rollback Plan

- **Per slice:** every chained PR is one work unit that can be reverted on its own with `git revert`. Later slices depend only on merged earlier slices.
- **Per pillar:** per-phase feature flags in `app-shell` hide a pillar's routes and navigation without a code revert.
- **Database:** migrations only add tables and columns; existing auth tables are not dropped or narrowed. Rolling back means the app stops reading the new tables. Dropping them, when needed, is a separate reviewed down-migration, because user data cascades from `user.id`.
- **Auth:** the Lichess provider is additive. If token encryption is the cause, reverting it needs the re-encryption or invalidation plan from S3 so stored tokens stay readable.
- **Engine:** the worker is a static asset. Removing it disables analysis, and the rest of the app keeps working.
- **Cleanup slice:** isolated so it can be reverted without touching features.

## Dependencies

- Runtime libraries: react-chessboard v5 (MIT), chess.js 1.4 (BSD-2), ts-fsrs (MIT), Stockfish lite single-thread WASM build (GPL-3.0, separate asset only). cm-chessboard (MIT) as fallback.
- Lichess OAuth (public PKCE client, no secret), game export API and opening explorer API; current docs to be checked in S0.
- better-auth 1.7.5 `generic-oauth` plugin (verified present).
- A hosting target for `apps/server` (design decision).
- Before launch: confirmation of the Stockfish licensing reading.

## Open Questions (returned to orchestrator; not decided here)

| Question                                                                    | Proposed default                                        | Design impact                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email sign-in beside Lichess?                                               | Hide email sign-up UI behind a flag (off); keep backend | Decides whether template email flows (verify, reset, change email, emailed delete) stay; whether `email:read` is requested; whether games/mistakes UI must handle users with no Lichess account. Deletion design works either way. |
| Explorer rating band: own band or one step above?                           | `ratingBandFor(user)` returns the user's own band       | One function and possibly a user setting; affects explorer request parameters and caching.                                                                                                                                         |
| Eval loss that counts as a carded mistake                                   | Constants: 50 / 100 / 200 cp; card mistakes + blunders  | Card volume, repeat-mistake metric baseline; whether inaccuracies become cards. Win-percentage-based thresholds are an alternative that changes `packages/chess` classification.                                                   |
| First import window: 3 months or whole history?                             | `IMPORT_WINDOW_MONTHS = 3`                              | Import duration, analysis backlog on phones, initial card flood (interacts with daily new-card limit).                                                                                                                             |
| Chain strategy for auto-chain: `stacked-to-main` or `feature-branch-chain`? | None. auto-chain asks once                              | Branch/PR targeting for all ~22 to 26 slices; must be cached before the first apply.                                                                                                                                               |
| Tester gating per phase (PRD: "small group of testers first")               | Separate deployment environment + phase flags           | Whether a per-user allowlist is needed (adds a settings/admin surface).                                                                                                                                                            |

## Success Criteria

- [ ] A new user signs in with Lichess only; no email is required; the Lichess token is encrypted at rest and never reaches the browser.
- [ ] The first import brings in the configured window, and incremental syncs add only new games; an interrupted import resumes with zero duplicate games.
- [ ] Imported games are analysed in the browser; mistakes and blunders above the configured threshold each produce exactly one card, stored with normalized FEN and best move.
- [ ] The Today queue mixes due cards from every active pillar, respects the daily new-card limit, shows the next card in under 200 ms, and keeps grades across a dropped connection (idempotent resubmit).
- [ ] Repertoire positions where the user is to move become cards; idea notes render as arrows and highlights; explorer stats show beside candidate moves; games that leave the repertoire are flagged.
- [ ] All four blindfold drills run; voice input is feature-detected and typed SAN works everywhere; peeks and best depth are recorded.
- [ ] The dashboard shows streak, accuracy per pillar, repeat-mistake trend, weakest openings, best blindfold depth and heatmap; mistakes filter by opening, phase and time pressure.
- [ ] Export produces PGN + JSON of all personal data; a Lichess-only user can delete their account and all rows cascade away.
- [ ] Every screen works at 375 px with tap targets of at least 44 px; WCAG 2.2 AA contrast and full keyboard use, with a text move input beside every board.
- [ ] The app bundle contains only MIT/BSD/Apache dependencies; the Stockfish worker is a separate unmodified file with licence and source offered; the licensing reading is confirmed before launch.
- [ ] Every PR stays within 400 authored changed lines (or has a recorded `size:exception`); `bun test`, `pnpm check-types` and `pnpm check` pass on every slice.
