# Exploration: chess-lab-v1

> Written by the orchestrator from the sdd-explore result (Engram `sdd/chess-lab-v1/explore`, obs 101); the explorer had no write tool. Input: `docs/prd.md`. CodeGraph was not indexed; the explorer used Read/Grep/Glob.

## Current state

- Template base: pnpm 12 + vite-plus, TypeScript 6, `bun test`.
- `apps/server`: Hono on a Bun process (tsdown / `bun build --compile`), not Workers, so long streamed Lichess imports are fine server-side. `packages/infra` (alchemy) deploys only the web app as a Cloudflare Vite site.
- `packages/auth`: better-auth 1.7.5, Drizzle adapter, `admin` + `account-security` plugins, email + password with required verification, optional Google, audit hooks, `deleteUser` with an emailed confirmation link, `accountLinking.trustedProviders: []`.
- `packages/db`: drizzle 1.0 rc.4 on Postgres; schema `auth.ts`, `audit.ts`; `user.email` is NOT NULL UNIQUE (verified); `account` has `accessToken` / `refreshToken` (plaintext unless `encryptOAuthTokens`).
- `packages/api`: oRPC with `publicProcedure`, `protectedProcedure`, `platformProcedure`; routers `platform`, `audit`, plus `healthCheck`, `privateData`.
- `apps/web`: TanStack Router (Vite SPA, no SSR); features `access-control`, `account`, `admin`, `audit-log`, `auth`; routes `_auth/*`, `_public-auth/*`, `prototype/*` (Midnight prototype, throwaway). No chess dependencies installed.
- Boundary lint (`.oxlintrc.json`, tested by `tests/lint-boundaries.test.ts`): features only via `@/features/<name>`; `shared/` cannot import features/routes; `packages/ui` cannot import the app. No rules for `packages/*`.
- `openspec/specs` is empty; `strict_tdd: false`, TDD scoped to server, auth, API and pure logic.

## Lichess OAuth via better-auth

The installed `generic-oauth` plugin (verified present in 1.7.5) supports `authorizationUrl`, `tokenUrl`, `userInfoUrl`, `clientId` without a secret, `scopes`, `pkce` (default true), `getUserInfo`, `mapProfileToUser`, `accountSubject`, `disableSignUp`, `overrideUserInfo`, `accessTokenExpiresIn`.

Lichess (OpenAPI spec): authorize `https://lichess.org/oauth`, token `https://lichess.org/api/token`, PKCE S256 only, unregistered public clients allowed, tokens last about a year, no refresh tokens, email only with `email:read`. Own-game export needs no scope.

Design gaps:

1. **Synthetic email**: `mapProfileToUser` must create a collision-free, non-deliverable address (for example `<lichessId>@lichess.invalid`, `emailVerified: true`).
2. **Identity**: no OIDC `sub`; use `getUserInfo` on `/api/account` and `accountSubject` = immutable Lichess id; refresh the username on each sign-in.
3. **Deletion**: the emailed delete link cannot reach Lichess-only users; needs a fresh-session re-auth or typed-username confirmation.
4. **Token encryption**: enable `account.encryptOAuthTokens` (NFR-05). Coverage of generic-oauth accounts is documented but not verified in installed code; `BETTER_AUTH_SECRET` rotation affects it.
5. **Scopes**: the token may only matter for rate-limit identification; decide the scope set in the proposal.

Not verified: games-export parameters, throttle and 429 rules, whether the explorer needs a token.

## Recommended boundaries

- `packages/chess` (pure, isomorphic, TDD): chess.js wrappers, PGN/SAN, mistake classification (eval loss, phase, clock under 10%), repertoire tree ops with FEN-normalized transpositions, spoken move to SAN, ECO helpers.
- `packages/study` (pure, TDD): ts-fsrs wrapper, Card row to FSRS state, grading, queue selection with the daily new-card limit.
- `packages/lichess` (server-only): profile fetch, NDJSON game-export streaming, 429 backoff with one request at a time per user, explorer client; injected `fetch` as the test seam.
- Engine: `apps/web` feature; standalone Stockfish Web Worker served as a separate static asset, lazy-loaded, typed `analyse(...)` wrapper, job queue, per-move evals persisted for resume; licence and source page. Server receives results via oRPC.
- Web features (each with `index.ts`): `lichess-account`, `games`, `mistakes`, `review`, `repertoire`, `blindfold`, `progress`, `data-control`. Board wrapper in `shared/components/board` (client-only, touch, arrows, empty piece set, move list + typed input).
- DB: new schema files `lichess`, `games`, `repertoire`, `cards`, `drills`; every table FK `user.id ON DELETE CASCADE`. Card = one table with nullable per-source FKs plus a CHECK that exactly one is set.
- API: `protectedProcedure` routers for lichess, games, mistakes, review, repertoire, drills, progress. PGN/JSON export as a streamed Hono route.
- Import: background job (`startBackgroundJobs` pattern) or on demand; `since` cursor; unique (user, Lichess game id).
- Grade durability (NFR-07): client outbox + idempotent submit with a client-generated ReviewLog id.

## Capabilities and dependencies

| Capability             | FRs                   | Depends on                                     | Phase            |
| ---------------------- | --------------------- | ---------------------------------------------- | ---------------- |
| chess-board-foundation | NFR-03, NFR-04        | spike                                          | 1 (prerequisite) |
| review-queue           | FR-04, FR-17          | board                                          | 1                |
| account-lichess        | FR-01                 | template auth                                  | 1                |
| game-import            | FR-12, NFR-06, NFR-07 | account-lichess                                | 1                |
| mistake-analysis       | FR-13, FR-14          | game-import, board, review-queue               | 1                |
| data-control           | FR-19                 | all data tables                                | 1                |
| repertoire             | FR-02, 03, 05, 06, 16 | review-queue; FR-16 also game-import, mistakes | 2                |
| blindfold              | FR-07 to FR-11        | review-queue, chess core; FR-11 engine         | 3                |
| progress               | FR-15, FR-18          | ReviewLog, Mistake, DrillSession               | 4                |

Cross-cutting: Midnight app shell and navigation; template-pruning decision.

Phase 1 likely exceeds 2,000 authored lines. Suggested chained slices: S0 dependencies and spike decisions; S1 `packages/chess`; S2 DB schema for lichess, games, cards; S3 Lichess generic-oauth, synthetic email, token encryption; S4 Lichess client and import service; S5 `packages/study` and review router; S6 board and review session UI; S7 engine worker and mistake-to-card pipeline; S8 Today and mistakes UI; S9 export and delete.

## Approaches

| Approach                                      | Pros                                             | Cons                                  | Effort         |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------- | -------------- |
| A. Evolve the template in place (recommended) | Fastest to user value, reuses sessions and audit | Template leftovers remain             | Medium         |
| B. Strip the template first                   | Cleaner repo                                     | Large deletion PRs with no user value | Medium to High |
| C. Custom Lichess OAuth outside better-auth   | Full control                                     | Loses sessions, linking, audit        | High           |

Recommendation: A; defer pruning to one cleanup slice unless the Midnight shell forces removing `authenticated-shell`.

## Risks

- Stockfish npm builds are GPL-3.0: keep the worker a separate unmodified file with licence and source offered. Start with the single-thread lite build; multi-thread needs SharedArrayBuffer and cross-origin isolation headers.
- Lichess export parameters, throttle and explorer auth are unverified.
- Email-based template flows (delete, change email, set password) break for Lichess-only users; tied to the PRD question about email sign-in.
- Token encryption for generic-oauth is unverified.
- Template leftovers: admin plugin, platform RBAC, audit log, impersonation, data-table, admin routes. No orgs or multi-tenancy.
- SSR risk is low (SPA); 375 px touch still needs the spike, cm-chessboard as fallback.
- NFR-02 needs queue prefetch; the Stockfish worker must be lazy-loaded for the 2 s Today load.
- Phone analysis is slow and tab-bound; persist per-move evals. Client-computed evals only affect the user's own data.
- Store normalized FEN + move on Mistake from the start for the repeat-mistake metric.
- PRD open questions that change the design: email sign-in, eval-loss threshold (config constant), import window.

Ready for proposal: yes.
