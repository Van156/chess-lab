# Design: Chess Lab v1

> Inputs: `proposal.md` (required), `exploration.md`, `docs/prd.md`, `specs/*`. Requirement ids below refer to the PRD (FR-xx, NFR-xx) so the specs and design can be cross-checked. Defaults marked "reversible default" are config constants, not final product decisions. Code facts were checked against the working tree on 2026-10-04 (Read/Grep; CodeGraph is not indexed in this repo).

## Technical Approach

Evolve the template in place (proposal Approach A). Chess Lab is built as a set of **deep modules** with small interfaces, placed so that the hard logic is pure and testable with `bun test`, and all IO sits at a few explicit seams:

```
                 isomorphic, pure (TDD)                     server-only IO
        +-----------------------------------+      +------------------------------+
        | packages/chess    packages/study  |      | packages/lichess             |
        | FEN/SAN/PGN,      FSRS, queue     |      | OAuth profile, NDJSON export,|
        | classification,   selection       |      | explorer, per-user serial    |
        | repertoire graph                  |      | queue + 429 backoff          |
        +-----------------+-----------------+      +---------------+--------------+
                          |                                        | (type-only import into api;
            +-------------+---------------+                        |  runtime wired by apps/server)
            |                             |                        |
  +---------v----------+       +----------v---------+   +----------v----------+
  | apps/web           |       | packages/api       |<--+ apps/server         |
  | features/*, board, | oRPC  | routers, services  |   | Hono: auth, rpc,    |
  | engine worker host +------>+ (import, review,   |   | export stream,      |
  | grade outbox       |       |  analysis, export) |   | job wiring          |
  +---------+----------+       +----------+---------+   +----------+----------+
            |                             |                        |
            | /engine/*.js,wasm           v                        v
            | (static, GPL, unmodified)  packages/db (Drizzle, Postgres)   packages/auth (better-auth)
```

- The browser owns engine analysis (NFR-01) and submits evaluations; the server owns every write that creates mistakes, cards or FSRS state, so idempotency and ownership checks live in one place.
- The Lichess token never leaves the server (NFR-05). It is stored encrypted by better-auth in `account.access_token` and read only through `auth.api.getAccessToken` inside `apps/server` wiring.
- Phase 1 is delivered as chained PRs (auto-chain, 400-line budget). Phases 2 to 4 reuse the same seams and only add tables (add-only migrations), routers and web features.

## Glossary (design vocabulary)

Terms used consistently in specs, code and this document. A `GLOSSARY.md` should be created from this list in the first implementation slice that introduces code using these terms (domain-modeling skill; no implementation detail in that file).

| Term                    | Meaning                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lichess link**        | The pairing of a Chess Lab user with one Lichess identity (immutable Lichess id, current username, sync state). Stored as the better-auth `account` row (token) plus one `lichess_profile` row (sync state). The PRD's "LichessAccount". |
| **Game**                | One imported Lichess game owned by one user. Unique per (user, Lichess game id).                                                                                                                                                         |
| **Analysis**            | The per-ply engine evaluations of one Game plus their progress state. 1:1 with Game.                                                                                                                                                     |
| **Mistake**             | One move in a Game whose evaluation loss crossed a classification threshold. Carries the position key and played move.                                                                                                                   |
| **Position key**        | A normalized FEN (placement, side to move, castling rights, en-passant square only when an en-passant capture is legal). Two positions with the same key are the same position regardless of move order or clocks.                       |
| **Repertoire position** | A position (by position key) inside one Repertoire. The PRD's "RepertoireNode". Moves between positions form a graph, so transpositions share one position.                                                                              |
| **Card**                | One schedulable review item with exactly one source: a Mistake, a Repertoire position or a Drill.                                                                                                                                        |
| **Grade**               | Again, Hard, Good or Easy, given by the user for one Card review.                                                                                                                                                                        |
| **Review log**          | The immutable record of one Grade, identified by a client-generated id.                                                                                                                                                                  |
| **Queue**               | The ordered list of Cards due for the user's current local day, including at most the daily limit of new Cards.                                                                                                                          |
| **Pillar**              | Mistakes, Repertoire or Blindfold; also the unit of feature flags.                                                                                                                                                                       |

## Architecture Decisions

### ADR-01: Three new packages with pure cores and one IO package

**Choice**: Add `packages/chess` (`@b2c-template/chess`), `packages/study` (`@b2c-template/study`) and `packages/lichess` (`@b2c-template/lichess`). `chess` and `study` are pure and isomorphic (no `fetch`, no DB, no React, no timers); they take `now`/inputs as arguments. `lichess` is server-only and takes `fetch` and a clock as dependencies. Package scope follows the existing `@b2c-template/*` naming; renaming the scope is out of scope.

**Alternatives considered**:

- One `packages/domain` package for all chess and study logic: fewer `package.json` files, but FSRS scheduling and chess rules change for unrelated reasons and would share one test and type surface.
- Keep logic inside `packages/api` and `apps/web/src/features`: the web needs SAN validation, classification preview and optimistic FSRS for the outbox, so the logic would be duplicated across tiers.

**Rationale**: Each package is deep: `chess` hides chess.js, PGN clock parsing, FEN normalization and classification behind about ten functions; `study` hides ts-fsrs behind three. Web and server share one implementation (locality). The deletion test passes: deleting either package would scatter the same logic across at least two callers.

### ADR-02: Enforce package seams with oxlint `no-restricted-imports` overrides

**Choice**: Extend `.oxlintrc.json` with three overrides and cover each with a fixture plus a case in `tests/lint-boundaries.test.ts` (the existing pattern: fixtures mirror real paths and are linted in a temp dir):

| Files                                                              | Forbidden imports                                                                                                                                                                                                       | Message                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/chess/**`, `packages/study/**`                           | `@b2c-template/db`, `@b2c-template/db/**`, `@b2c-template/auth`, `@b2c-template/auth/**`, `@b2c-template/api`, `@b2c-template/api/**`, `@b2c-template/lichess`, `@b2c-template/lichess/**`, `react`, `react/**`, `@/**` | `packages/chess and packages/study must stay pure and isomorphic`              |
| `packages/lichess/**`                                              | `@b2c-template/db`, `@b2c-template/db/**`, `@b2c-template/api`, `@b2c-template/api/**`, `react`, `@/**`                                                                                                                 | `packages/lichess is an HTTP client only; persistence belongs to packages/api` |
| `apps/web/src/**` (merged into the existing override's `patterns`) | `@b2c-template/lichess`, `@b2c-template/lichess/**`, `@b2c-template/db`, `@b2c-template/db/**`, `@b2c-template/auth`, `@b2c-template/auth/**`                                                                           | `server-only package; the browser must never import it`                        |

Note: oxlint overrides do not merge `no-restricted-imports` options across overrides; the `apps/web/src/shared/**` override must repeat the new web patterns, because the later, more specific override replaces the earlier rule options. The fixture test must cover a `shared/` file importing `@b2c-template/lichess`.

`apps/web` importing type-only from `@b2c-template/api/routers/index` stays allowed (it is how `app/orpc.ts` types the client today).

**Alternatives considered**:

- No lint rules, rely on review: cheap now, but the "token never reaches the browser" guarantee (NFR-05) and the purity of the shared packages are exactly what drifts silently.
- TypeScript project references to forbid imports: stronger, but the repo does not use references this way and it would touch every `tsconfig`.

**Rationale**: The repo already treats import boundaries as tested rules (`openspec/config.yaml` design rule: respect boundaries enforced by `tests/lint-boundaries`). Three small overrides keep the same mechanism.

### ADR-03: Drizzle schema per pillar, user-owned rows cascade, add-only migrations

**Choice**: New schema files in `packages/db/src/schema/` exported from `schema/index.ts`: `lichess.ts`, `settings.ts`, `games.ts`, `cards.ts` (Phase 1), `repertoire.ts` (Phase 2), `drills.ts` (Phase 3). Conventions copied from `audit.ts`: `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`, snake_case column names, `created_at`/`updated_at` timestamps, named indexes. Every user-owned table has `user_id text not null references user(id) on delete cascade`, including child tables (denormalized `user_id` makes every ownership filter a single indexed predicate and makes the export enumerable per table). Relations are added with `defineRelationsPart` next to each schema, following `authRelations`, and spread into `packages/db/src/relations.ts`.

The better-auth `user` table is **not** extended (it is regenerated by `auth:generate`); per-user settings live in `user_settings`.

"Add-only" means: migrations create tables, columns, indexes and constraints, and never drop or narrow existing data-bearing columns. Replacing a CHECK constraint with a strictly wider one in the same migration (needed when Phase 2 and 3 add card sources) counts as add-only because no existing row can violate it.

**Alternatives considered**:

- Create every PRD table in Phase 1: one migration, no CHECK widening, but it designs Phase 2/3 tables before their specs are settled and inflates the S2 slice past the budget.
- A polymorphic `card(source_type, source_id)` without FKs: no CHECK widening, but loses referential integrity and cascade on source deletion (a deleted Mistake would leave an orphan Card).

**Rationale**: Real FKs give cascade on account deletion (FR-19) and on source deletion for free; the CHECK keeps the single-queue table honest.

### ADR-04: Card is one table with nullable per-source FKs and a "exactly one" CHECK

**Choice**:

```sql
-- Phase 1
card.mistake_id text null references mistake(id) on delete cascade unique
check (num_nonnulls(mistake_id) = 1)                       -- card_exactly_one_source
-- Phase 2 migration: add repertoire_position_id (unique, FK cascade), then
alter table card drop constraint card_exactly_one_source,
  add constraint card_exactly_one_source check (num_nonnulls(mistake_id, repertoire_position_id) = 1);
-- Phase 3: same pattern with drill_id
```

Drizzle: `check("card_exactly_one_source", sql\`num_nonnulls(${t.mistakeId}) = 1\`)`. The pillar of a card is derived (`mistake_id is not null`means Mistakes) in one SQL helper`cardPillarSql`and one TS function`cardPillar(row)`; no redundant `source_type` column that could disagree with the FKs. One unique index per source column guarantees one card per source (Postgres unique allows many NULLs).

FSRS state columns mirror ts-fsrs `Card`: `due timestamptz not null`, `stability real`, `difficulty real`, `elapsed_days int`, `scheduled_days int`, `learning_steps int`, `reps int`, `lapses int`, `state smallint` (0 New, 1 Learning, 2 Review, 3 Relearning), `last_review timestamptz null`. Index `(user_id, due)` for the queue and `(user_id, state)` for new-card selection.

**Alternatives considered**: a `source_type` enum plus FKs (two facts to keep in sync); one card table per pillar (breaks "one queue" and multiplies the FSRS code path).

**Rationale**: Matches the PRD data model ("Card points at one source, so the queue stays a single table") with DB-enforced integrity.

### ADR-05: Mistake stores the position key and played move from day one

**Choice**: `mistake` columns: `id`, `user_id`, `game_id` (FK cascade), `ply int`, `fen_before text` (full FEN for display), `position_key text` (normalized FEN, see Glossary), `played_san`, `played_uci`, `best_san`, `best_uci`, `eval_before_cp int`, `eval_after_cp int`, `eval_loss_cp int`, `severity` (`inaccuracy | mistake | blunder`, pgEnum), `phase` (`opening | middlegame | endgame`, pgEnum), `clock_left_ms int null`, `clock_initial_ms int null`, `eco text null`, `opening_name text null`, `created_at`. Unique `(game_id, ply)` (re-running classification is idempotent). Index `(user_id, position_key, played_uci)` for the repeat-mistake metric (PRD success metric, FR-18) and `(user_id, eco)` for FR-15 filters.

Inaccuracies are stored as Mistakes but are only carded when `CARD_SEVERITIES` includes them (default `["mistake","blunder"]`), so changing the PRD open question later does not require re-analysis.

**Alternatives considered**: computing the position key at query time from `fen_before` (no index, slow trend queries); storing only carded mistakes (loses the baseline for the repeat metric and for FR-15).

**Rationale**: The proposal and exploration both flag this: the repeat-mistake metric needs an indexed position identity from the first import.

### ADR-06: Phase 1 schema (tables and keys)

| Table             | Key columns                                                                                                                                                                                                                                                                                 | Constraints and indexes                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `lichess_profile` | `user_id` PK/FK cascade, `lichess_id` (lowercase immutable id), `username`, `rating_snapshot jsonb` (perf ratings from `/api/account`), `import_cursor_ms bigint null`, `import_state` (`idle                                                                                               | running                                                                                                      | backoff    | failed`), `import_retry_at timestamptz null`, `import_lease_until timestamptz null`, `import_error text null`, `last_synced_at timestamptz null`, `first_import_done_at timestamptz null` | unique `lichess_id`                                                                                                                                                                                                                                                            |
| `user_settings`   | `user_id` PK/FK cascade, `daily_new_card_limit int default 20`, `time_zone text default 'UTC'` (IANA, set from the browser), `board_orientation_auto bool default true`, `explorer_band_offset smallint default 0` (Phase 2), `blindfold_level smallint default 1` (Phase 3)                | row created lazily on first read (upsert)                                                                    |
| `game`            | `id`, `user_id`, `lichess_game_id`, `pgn text`, `user_color` (`white                                                                                                                                                                                                                        | black`), `speed`, `time_control_initial_s int`, `time_control_increment_s int`, `rated bool`, `result` (`1-0 | 0-1        | 1/2-1/2                                                                                                                                                                                   | *`), `eco`, `opening_name`, `played_at timestamptz`, `imported_at`                                                                                                                                                                                                             | unique `(user_id, lichess_game_id)`; index `(user_id, played_at desc)` |
| `game_analysis`   | `game_id` PK/FK cascade, `user_id`, `status` (`pending                                                                                                                                                                                                                                      | screening                                                                                                    | confirming | complete                                                                                                                                                                                  | failed`), `evals jsonb`(array indexed by ply:`{ cp?: int, mate?: int, depth: int, bestUci?: string }`or`null`), `screen_depth int`, `confirm_depth int`, `engine_id text`(worker file name and version),`next_ply int default 0`, `analysed_at timestamptz null`, `updated_at` | index `(user_id, status)`                                              |
| `mistake`         | see ADR-05                                                                                                                                                                                                                                                                                  | see ADR-05                                                                                                   |
| `card`            | see ADR-04; plus `id`, `user_id`, `created_at`, `updated_at`                                                                                                                                                                                                                                | see ADR-04                                                                                                   |
| `review_log`      | `id text` PK (client-generated UUID v4, the idempotency key), `user_id`, `card_id` FK cascade, `grade smallint` (1..4), `reviewed_at timestamptz` (client clock), `received_at timestamptz default now()`, `elapsed_ms int`, `state_before jsonb` (FSRS card snapshot), `state_after jsonb` | index `(user_id, reviewed_at)` (heatmap, streak, new cards introduced today), index `(card_id, reviewed_at)` |

Phase 2 and 3 tables (designed now so FKs and export are planned; created in their phase):

| Table                 | Key columns                                                                                                                  | Notes                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `repertoire`          | `id`, `user_id`, `color`, `name`                                                                                             | many per user                                                                               |
| `repertoire_position` | `id`, `repertoire_id` FK cascade, `user_id`, `position_key`, `fen`, `side_to_move`                                           | unique `(repertoire_id, position_key)`: transpositions collapse to one position (FR-02)     |
| `repertoire_move`     | `id`, `repertoire_id`, `user_id`, `from_position_id` FK cascade, `to_position_id` FK cascade, `san`, `uci`                   | unique `(from_position_id, uci)`; `packages/chess` rejects a move that would create a cycle |
| `idea_note`           | `repertoire_position_id` PK/FK cascade, `user_id`, `arrows jsonb`, `highlights jsonb`, `plan text` (one line, max 140 chars) | 0..1 per position (FR-03)                                                                   |
| `drill`               | `id`, `user_id`, `type` (`coordinates                                                                                        | square_color                                                                                | replay                                                                                                                            | engine`), `item_key text`, `params jsonb`, `created_at`                     | one row per **failed drill item**; the card source for drills. Unique `(user_id, type, item_key)` |
| `drill_session`       | `id`, `user_id`, `type`, `level`, `status` (`in_progress                                                                     | completed                                                                                   | abandoned`, pgEnum), `score int null`, `peeks int default 0`, `best_depth int null`, `started_at`, `finished_at timestamptz null` | many per user (PRD DrillSession); `finished_at` is null while `in_progress` |

A repertoire card exists only for positions where `side_to_move` equals the repertoire colour (FR-06); the prompt accepts any outgoing `repertoire_move` from that position.

**Drill card granularity**: a drill card is per **failed item**, not per drill type or session. An item is the smallest re-askable prompt, identified by a stable `item_key` built in `packages/chess` (for example `coord:e4`, `color:f7`, `replay:<gameId>:<ply>:<questionId>`, `engine:<positionKey>`). When a drill attempt fails an item, `drills.finish` upserts `drill` on `(user_id, type, item_key)` and inserts its card with `ON CONFLICT (drill_id) DO NOTHING`, so a repeatedly failed item keeps one card (spec: one non-duplicated card per failed item). Passed items create nothing. `drill_session` is the attempt log only and is never a card source.

**Abandoned drills (reversible default)**: `drills.start` inserts a session with `status = in_progress`. `drills.finish` sets `completed`, `finished_at`, score, peeks and best depth. A session still `in_progress` after `DRILL_ABANDON_AFTER_MS` (default 30 minutes), or explicitly closed by the client without finishing (`drills.abandon`), is **stored as `abandoned`** with `finished_at` set and its peeks kept; failed items already reported still produce cards. Abandoned sessions are excluded from best depth and accuracy in Progress. The alternative (discarding abandoned sessions) only changes the `drills.abandon` handler and the Progress filter, so it stays reversible.

**Rationale**: The position/move graph is the only representation where a transposition is one position (one idea note, one card) instead of two tree nodes that drift apart.

### ADR-07: Lichess sign-in through better-auth `generic-oauth`

**Choice**: Register a `genericOAuth({ config: [lichess] })` plugin in `createAuth` when `LICHESS_CLIENT_ID` is set (same "registered only when configured" pattern as `resolveGoogleCredentials`):

```ts
{
  providerId: "lichess",
  name: "Lichess",
  clientId: env.LICHESS_CLIENT_ID,          // public PKCE client, no secret
  authorizationUrl: "https://lichess.org/oauth",
  tokenUrl: "https://lichess.org/api/token",
  scopes: [],                                // own-game export needs no scope; no email:read
  pkce: true,                                // S256 (Lichess accepts S256 only)
  authentication: "post",                    // client_id in the body, no Basic auth
  getUserInfo: (tokens) => fetchLichessAccount(tokens.accessToken),   // GET /api/account
  accountSubject: ({ profile }) => String(profile.id),                // immutable lowercase id
  mapProfileToUser: (p) => ({
    name: String(p.username),
    email: syntheticEmail(String(p.id)),     // `${id}@lichess.invalid`
    emailVerified: true,
  }),
  overrideUserInfo: true,                    // refresh username on every sign-in
}
```

Plus `account: { ...existing, encryptOAuthTokens: true }`. A `lichess-account` better-auth plugin (new file `packages/auth/src/lichess-account.ts`) upserts `lichess_profile` (id, username, ratings) after a successful Lichess callback, using an `hooks.after` matcher on `/oauth2/callback/lichess` inside the plugin (the single top-level `hooks.after` slot stays with the audit hook, as `account-security.ts` already does).

Verified in installed better-auth 1.7.5:

- `GenericOAuthConfig` exposes `accountSubject`, `getUserInfo`, `mapProfileToUser`, `pkce`, `scopes`, `overrideUserInfo`, `authentication` (`dist/plugins/generic-oauth/types.d.mts`).
- Token encryption is applied by `setTokenUtil` in `api/routes/callback.mjs` and `oauth2/link-account.mjs`, which the generic-oauth callback uses, so generic-oauth tokens are covered.
- `decryptOAuthToken` returns a stored token unchanged when it does not look encrypted (`isLikelyEncrypted`: `$ba$` prefix or even-length hex). Existing plaintext Google tokens therefore stay readable after enabling encryption; no migration is required. Residual risk: a plaintext token that happens to be even-length hex would be wrongly decrypted (Google tokens are not hex). `BETTER_AUTH_SECRET` rotation makes encrypted tokens unreadable; Lichess users then simply sign in again (no refresh tokens exist).

Synthetic email rules (`packages/auth/src/synthetic-email.ts`): `syntheticEmail(id)`, `isSyntheticEmail(email)` (domain `lichess.invalid`, RFC 2606 reserved, never deliverable). The email sender factory wraps the real sender so any send to a synthetic address is dropped and logged (defence in depth against bounces from template flows). Account linking stays as is (`trustedProviders: []`, `requireLocalEmailVerified: true`); a synthetic address can never collide with a real one, so Lichess never auto-links to an email account.

`listEnabledSocialProviders` / `/api/public/auth-providers` gains `lichess` so the sign-in page renders the button from the same source of truth.

**Alternatives considered**:

- Custom OAuth handler outside better-auth (exploration Approach C): loses sessions, audit hooks and account plumbing.
- Requesting `email:read` to use the real email: adds consent friction and a privacy surface NFR-05 wants to avoid; the PRD open question on email sign-in can add it later without changing account identity (identity is `accountSubject`, not email).
- Nullable `user.email`: the auth schema is generated and `email` is NOT NULL UNIQUE; changing it fights the library.

**Rationale**: Reuses every template mechanism (sessions, cookies, audit) and keeps identity on the immutable Lichess id.

### ADR-08: Account deletion for Lichess-only users

**Choice**: Keep the existing emailed-link deletion for users with a real email. For users whose email is synthetic, add a better-auth plugin endpoint in `packages/auth/src/lichess-account.ts`:

`POST /api/auth/lichess/delete-account` with body `{ confirmUsername: string }`:

1. Require a session; reject impersonated sessions.
2. Require a **fresh** session: `session.createdAt` within `DELETE_FRESH_WINDOW_MS` (default 10 minutes). Otherwise respond `403 { code: "REAUTH_REQUIRED" }`; the client then calls `authClient.signIn.oauth2({ providerId: "lichess", callbackURL: "/account/danger?confirm=1" })`, which creates a new session.
3. Compare `confirmUsername` case-insensitively with `lichess_profile.username`; mismatch returns `400 { code: "USERNAME_MISMATCH" }`.
4. Call the same `events.userDeleting` seam used by `deleteUser.beforeDelete` (fail closed: an audit failure aborts the delete).
5. `ctx.context.internalAdapter.deleteSessions(userId)` and `deleteUser(userId)`, then clear the session cookie. All chess rows cascade from `user.id`.

The endpoint is better-auth's because session and identity actions belong to better-auth in this repo (`docs/architecture/web-app.md`, Impersonation). Origin/CSRF checks are those better-auth applies to all its POST endpoints.

**Alternatives considered**:

- An oRPC procedure that deletes the user row: works, but cannot clear the better-auth session cookie or reuse its session-freshness semantics, and splits identity actions across two stacks.
- Making `sendDeleteAccountVerification` conditional: better-auth checks for the option's presence, not per user; it cannot be skipped for one user class.
- Typed username only (no freshness): a stolen session cookie could delete the account.

**Rationale**: Works whatever is decided about email sign-in (PRD open question) and needs no deliverable email.

### ADR-09: Lichess HTTP client with a per-user serial queue and 429 backoff

**Choice**: `packages/lichess` exports one factory:

```ts
createLichessClient(deps: { fetch: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; baseUrl?: string; explorerUrl?: string })
  => {
    account(token): Promise<LichessAccount>;
    exportGames(args: { username: string; token: string; sinceMs: number; max?: number; signal: AbortSignal }): AsyncIterable<LichessGame>;
    explorer(args: { fen: string; ratings: number[]; speeds: string[]; token: string }): Promise<ExplorerStats>;   // Phase 2; token required (S0.7)
  }
```

Inside: a `SerialGate` keyed by user (token hash) runs at most one in-flight request per user (NFR-06); a 429 response pauses that user's gate for `RATE_LIMIT_PAUSE_MS` (60 s, Lichess guidance to wait a full minute), doubling up to 5 minutes, with `MAX_429_RETRIES = 3` before failing with a typed `LichessRateLimited` error carrying `retryAt`. `exportGames` requests `GET /api/games/user/{username}` with `Accept: application/x-ndjson` and `since`, `sort=dateAsc`, `clocks=true`, `opening=true`, `pgnInJson=true`, `moves=true`, `evals=false`, `finished=true`, and parses the body line by line with a streaming NDJSON parser (`ndjson.ts`, pure, unit tested on chunk boundaries). Non-standard variants are skipped during parsing. Export parameters, `sort=dateAsc`, the 429 guidance and PKCE S256 were verified in S0.7 (`notes/s0-verification.md`). The export sends the user's token: own-game export streams at about 60 games/s versus 20 anonymous.

**S0.7 amendment (explorer authentication)**: `explorer.lichess.org/lichess` returns 401 without a token (spec declares OAuth2, no scope; live probe 2026-10-04). The explorer call therefore always sends the requesting user's Lichess token, and only signed-in users with a stored token can request explorer stats. A 401 from Lichess (revoked or expired token; tokens last about a year and cannot be refreshed) surfaces as a typed `LichessUnauthorized` error that prompts re-authorization through Lichess sign-in. The shared cache below is unchanged: explorer data is public, so a response fetched with one user's token may serve another user.

**Opening-explorer cache (Phase 2)**: explorer responses are cached on the server, never in the browser, in an in-process LRU inside the `LichessPort` adapter in `apps/server` (`packages/lichess` stays stateless). Key: `positionKey + ratingBand + speeds` (shared across users, because explorer data is public and not user-specific). TTL `EXPLORER_CACHE_TTL_MS` (default 24 h; explorer stats move slowly), capacity `EXPLORER_CACHE_MAX_ENTRIES` (default 5000), both in `packages/lichess/src/config.ts` as reversible defaults. A cache hit does not consume the user's serial-gate slot; a miss goes through the gate like any request. Concurrent misses for the same key share one in-flight promise. On a 429 or error, a stale entry (up to `EXPLORER_STALE_MAX_MS`, default 7 days) is served with a `stale: true` flag; otherwise the UI shows "stats unavailable" and the repertoire builder keeps working. A DB-backed cache table was rejected for v1 (one instance, data is cheap to refetch); it can be added if multiple server instances are introduced.

**Alternatives considered**: a global rate limiter (does not meet "per user"); fetching full history in one non-streamed request (memory and timeouts, violates NFR-06).

**Rationale**: `fetch` injection is the one real seam (production fetch, test fake); the queue and backoff are internal and tested through the interface with a fake clock.

### ADR-10: Import job: on-demand, leased, cursor-committed per batch

**Choice**: `packages/api/src/services/import-service.ts` (persistence + orchestration; no Lichess runtime import, it receives a `GamesSource` port typed with `import type` from `@b2c-template/lichess`):

```
requestSync(userId)
  -> acquire lease: UPDATE lichess_profile SET import_lease_until = now()+LEASE, import_state='running'
     WHERE user_id=$1 AND (import_lease_until IS NULL OR import_lease_until < now())
       AND (import_retry_at IS NULL OR import_retry_at < now())
     (0 rows => already running or backing off: return current status, do nothing)
  -> sinceMs = import_cursor_ms ?? now - IMPORT_WINDOW_MONTHS
  -> for await batch of 50 games from source.exportGames(...):
        BEGIN
          INSERT game ... ON CONFLICT (user_id, lichess_game_id) DO NOTHING
          INSERT game_analysis(status='pending') ... ON CONFLICT DO NOTHING
          UPDATE lichess_profile SET import_cursor_ms = max(played_at)+1, import_lease_until = now()+LEASE
        COMMIT
  -> on end: import_state='idle', last_synced_at=now(), first_import_done_at = coalesce(...)
  -> on LichessRateLimited: import_state='backoff', import_retry_at=e.retryAt, lease cleared
  -> on other error: import_state='failed', import_error=<safe message>, lease cleared
```

- **Resume without duplicates (NFR-07)**: the cursor advances in the same transaction as the inserted games, and the unique key makes a replayed batch a no-op.
- **One request per user (NFR-06)**: the DB lease makes concurrent triggers (two tabs, a restart) safe; the in-process `SerialGate` additionally serializes explorer calls with the import.
- **Triggers**: `lichess.sync` mutation (manual "Sync now"), and the Today loader calls `lichess.status`, which enqueues a sync when `last_synced_at` is older than `AUTO_SYNC_AFTER_MS` (6 h). Runs are fire-and-forget on the server (`void runImport(...)`); the client polls `lichess.status` while `running`. No global cron in v1 (server cost; Lichess load).
- **Lifecycle**: the server keeps an `ImportRunner` with an `AbortController` per running import. `startBackgroundJobs()` in `apps/server/src/services.ts` returns a `stop` that also aborts running imports, so SIGTERM leaves the lease to expire and the next trigger resumes from the committed cursor.
- **First import cap**: `FIRST_IMPORT_MAX_GAMES = 1000` as a safety bound for very active players (the window still bounds normal users).

**Alternatives considered**: a job queue library or table-backed queue (more infrastructure than a single always-on instance needs); client-side import (exposes the token, violates NFR-05).

**Rationale**: The lease plus cursor-in-transaction is the smallest design that satisfies NFR-06 and NFR-07 and survives restarts.

### ADR-11: Engine runtime: unmodified single-thread lite worker, lazy, serial job queue

**Choice**:

- **Asset**: the npm `stockfish` package's single-thread lite build (`stockfish-*-lite-single.js` + `.wasm`, exact file names pinned in S0) is copied unmodified by `apps/web/scripts/copy-engine.ts` (run from the web `prebuild`/`predev` scripts) into `apps/web/public/engine/`, which is git-ignored. It is never imported by application code, so it never enters the bundle (NFR-08). The engine version string lives in one constant `ENGINE_ID`.
- **PWA**: `vite.config.ts` workbox `globIgnores: ["engine/**"]`, because the current `globPatterns` (`**/*.{js,...}`) would precache the multi-megabyte worker on first visit and hurt NFR-02. The worker is cached at runtime with a `CacheFirst` route after first use.
- **Web feature** `apps/web/src/features/engine/` (public API `index.ts`):
  - `lib/uci.ts`: pure UCI line parser and command builder (`info depth .. score cp|mate .. pv`, `bestmove`), unit tested.
  - `lib/engine-client.ts`: owns one `Worker` created lazily on first `analyse` call (`new Worker("/engine/<file>.js")`), handshake (`uci`, `isready`), `setoption Hash 16`, `Threads 1`.
  - `lib/engine-queue.ts`: one job at a time; priorities `interactive` (review "show engine line", Phase 3 engine drill) pre-empt `background` (game analysis) by sending `stop`; jobs are cancellable.
  - `hooks/use-game-analysis.ts`: the background analysis loop described in ADR-12.
- **Strength control (FR-11, Phase 3 engine drill)**: the engine drill sets strength through standard UCI options sent before each game: `setoption name UCI_LimitStrength value true` plus `setoption name UCI_Elo value <elo>` when the chosen level maps to an Elo inside the build's supported range, otherwise `setoption name Skill Level value <0..20>`. Levels map through `ENGINE_STRENGTH_LEVELS` (reversible default: 8 levels from Skill Level 0 up to UCI_Elo 2000, with a short `movetime` of `ENGINE_DRILL_MOVETIME_MS` = 500 ms) in `apps/web/src/features/engine/config.ts`. Analysis jobs always reset `UCI_LimitStrength false` and `Skill Level 20`, so a drill can never weaken game analysis. The supported `UCI_Elo` range of the pinned lite build is read from the `uci` handshake (`option name UCI_Elo ... min .. max`) and clamped; S0 records it.
- **Licence and source (NFR-08)**: a public route `/licenses` (outside `_auth`) shows the Stockfish GPL-3.0 text (copied with the asset as `public/engine/Copying.txt`), the exact upstream source URL for the pinned version, and direct links to the served files. Linked from the shell footer and the analysis status UI. Ships in the same slice as the worker.

**Alternatives considered**: multi-thread build (needs `SharedArrayBuffer` and COOP/COEP headers on the Cloudflare site; out of scope); committing the binaries to git (large binary churn; the copy script keeps the npm tarball as the single unmodified source); server-side analysis (violates NFR-01).

**Rationale**: Separate unmodified file plus lazy creation satisfies both the licensing reading and the Today load budget. The licensing reading itself remains a launch gate (not legal advice).

### ADR-12: Analysis pipeline: shallow screen, deep confirm, server classifies

**Choice**:

1. The client asks `analysis.next` for the user's oldest game with `status != complete` and its stored `evals`/`next_ply` (resume point).
2. **Screen**: evaluate every ply from `next_ply` at `SCREEN_DEPTH` (default 10). Every `SUBMIT_EVERY_PLIES` (10) plies, or on `visibilitychange`/`pagehide`, call `analysis.submitEvals({ gameId, fromPly, evals, phase: "screen" })`. The server merges by ply index (idempotent: re-sending the same plies overwrites with the deeper-or-equal result) and advances `next_ply`.
3. **Confirm**: only plies whose screened eval loss reaches the inaccuracy threshold are re-evaluated at `CONFIRM_DEPTH` (default 18) for the position before and after the move, collecting the best move. Submitted the same way with `phase: "confirm"`.
4. When confirm is complete, `analysis.complete({ gameId })` runs on the server: `classifyGame(pgn, evals, thresholds)` from `packages/chess`, then in one transaction upserts `mistake` rows (`ON CONFLICT (game_id, ply) DO UPDATE`) and creates a `card` (state New, `due = now`) for each mistake whose severity is in `CARD_SEVERITIES` (`ON CONFLICT (mistake_id) DO NOTHING`), and sets `status = complete`.
5. Analysis pauses while a review session is open (the queue gives interactive jobs priority) and stops when the tab is hidden for longer than `PAUSE_HIDDEN_MS`.

Server-side validation of submitted evals: the game must belong to the session user, plies must be within the game's ply count, depth and cp values are bounded. Client-computed evals can only affect the submitting user's own mistakes and cards.

**Alternatives considered**: full deep pass on every ply (too slow on phones: proposal risk High); classify after the screen pass and revise later (creates and then deletes cards, which corrupts FSRS history); classify in the browser and submit mistakes (spreads idempotency and card creation across tiers).

**Rationale**: Deep search only where it matters keeps phone analysis practical, and card creation happens once, server-side, idempotently.

Classification rules (`packages/chess/src/classify.ts`, pure):

- Scores are from the mover's perspective, mate scores mapped to `±MATE_CP` (1000) and evaluations clamped to `±EVAL_CLAMP_CP` (1000) before computing loss = `before - after`.
- Thresholds (`DEFAULT_THRESHOLDS`): inaccuracy 50, mistake 100, blunder 200 cp (proposal defaults; PRD open question).
- Only the user's own moves are classified (`game.user_color`).
- Phase: `opening` while ply < `OPENING_PLY_LIMIT` (20) and not yet endgame; `endgame` when the non-pawn material of each side is at most `ENDGAME_MATERIAL` (13 points, queen 9, rook 5, minor 3); otherwise `middlegame`.
- Time pressure (FR-15, Phase 4 filter, stored now): `clock_left_ms < 0.1 * clock_initial_ms`, clocks from PGN `%clk` comments.

### ADR-13: FSRS and queue in `packages/study`; server is authoritative

**Choice**: `packages/study` wraps ts-fsrs:

```ts
export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export type CardState = {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  lastReview: Date | null;
};
export function newCardState(now: Date): CardState;
export function grade(
  card: CardState,
  g: Grade,
  reviewedAt: Date,
  params?: StudyParams,
): { next: CardState; log: ReviewLogEntry };
export function selectQueue(input: {
  due: QueueCandidate[];
  fresh: QueueCandidate[];
  introducedToday: number;
  dailyNewLimit: number;
  now: Date;
  limit: number;
}): QueueCandidate[];
export function localDayBounds(now: Date, timeZone: string): { start: Date; end: Date };
export const DEFAULT_STUDY_PARAMS: StudyParams; // desiredRetention 0.9, maximumInterval 365, enableFuzz true
export const DEFAULT_DAILY_NEW_CARDS = 20;
```

Queue order: learning and relearning cards due now first (oldest due first), then review cards due today, interleaving at most `dailyNewLimit - introducedToday` new cards evenly, then round-robin across pillars so one pillar cannot starve the others (FR-04). "Introduced today" = review logs in the user's local day whose `state_before.state = 0`.

`review` router:

- `review.queue({ limit = 50 })` returns fully hydrated `QueueItem`s (prompt FEN, orientation, expected answer moves, pillar-specific context such as the played move and game link), so the client needs no per-card fetch.
- `review.grade({ reviewLogId, cardId, grade, reviewedAt, elapsedMs })`: in one transaction, `INSERT review_log ... ON CONFLICT (id) DO NOTHING RETURNING`; if the row already existed, return the stored `state_after` (idempotent replay); otherwise load the card `FOR UPDATE`, compute `grade(...)`, update the card, store `state_before/after`. `reviewedAt` is clamped to `[last_review, now + 5 min]` so a skewed client clock cannot schedule into the past or far future.

**Alternatives considered**: client-authoritative FSRS with server sync (conflicts across devices, trust issues); SM-2 (PRD chose FSRS).

**Rationale**: One implementation runs on both sides: the server for truth, the client for optimistic UI (re-showing an "Again" card in the same session).

### ADR-14: NFR-02 next card under 200 ms: hydrated queue plus prefetch

**Choice**: The review session keeps the queue in memory (TanStack Query cache for `review.queue`), renders the next card synchronously from it on grade, and fetches the next page when fewer than `QUEUE_PREFETCH_THRESHOLD` (10) items remain. The board component is already mounted; changing card only changes props (`fen`, `orientation`, arrows). Grading never blocks advancing: the grade goes to the outbox (ADR-15) and the UI moves on immediately. The Today screen loads one aggregated `today.summary` query (due count per pillar, new-card budget left, streak, sync status) and prefetches `review.queue` on hover/focus of "Start review" (router `defaultPreload: "intent"` is already on).

**Alternatives considered**: fetching each card on demand (a network round trip per card on 4G breaks 200 ms).

**Rationale**: Rendering from memory is the only way to guarantee the budget on a flaky mobile network.

### ADR-15: Grade outbox for NFR-07

**Choice**: `apps/web/src/features/review/lib/grade-outbox.ts`: a per-user FIFO stored in `localStorage` under `chesslab.grade-outbox.v1.<userId>`. On grade: create `reviewLogId = crypto.randomUUID()`, append synchronously (survives tab close), advance the UI, then flush. Flush sends entries one by one in order with `client.review.grade`; an entry is removed only after a success response or a non-retryable error (`NOT_FOUND` card deleted, `BAD_REQUEST`), which is logged and dropped. Retries on network errors with backoff, and on `online`, `visibilitychange` (visible) and app start. Because `reviewLogId` is the primary key on the server, a replay after an ambiguous failure is a no-op. Sign-out flushes first (best effort) and keeps the per-user key otherwise.

**Alternatives considered**: IndexedDB (async writes can be lost if the tab closes immediately; extra dependency); TanStack Query offline mutations (not durable across reloads without a persister, and harder to reason about ordering).

**Rationale**: Grades are tiny; a synchronous write plus an idempotent server key is the simplest durable design.

### ADR-16: Board wrapper in `shared/components/board`

**Choice**: `apps/web/src/shared/components/board/` with a small interface that hides react-chessboard v5 and chess.js:

```ts
export type BoardProps = {
  fen: string;
  orientation: "white" | "black";
  /** Called with a legal move only; return false to reject (e.g. wrong answer handled by caller). */
  onMove?: (move: {
    from: string;
    to: string;
    promotion?: "q" | "r" | "b" | "n";
    san: string;
  }) => boolean;
  arrows?: readonly BoardArrow[];
  highlights?: readonly string[];
  lastMove?: { from: string; to: string };
  /** Blindfold: pieces are not drawn (react-chessboard `pieces` mapped to empty renderers). */
  hidden?: boolean;
  label: string; // accessible description of the position
};
export function ChessBoard(props: BoardProps): JSX.Element; // lazy-loads the library chunk
export function MoveList(props: {
  moves: readonly string[];
  currentPly: number;
  onSelect?: (ply: number) => void;
}): JSX.Element;
export function SanInput(props: {
  fen: string;
  onMove: (san: string) => void;
  label?: string;
}): JSX.Element;
```

- **Client-only**: the app is a Vite SPA, but `bun test` renders components with SSR; `ChessBoard` renders a same-size static placeholder (squares only, with the accessible label) until mounted, and loads the library with `React.lazy` so react-chessboard is not in the Today critical chunk.
- **Accessibility (NFR-04)**: `MoveList` is an ordered list with `aria-current` on the current ply; `SanInput` is a labelled text field that validates against legal moves (`packages/chess` `parseMove(fen, text)`, accepting SAN and UCI, case-tolerant) and announces errors with `aria-live`. Every screen with a board renders `SanInput` beside it. Keyboard users never need drag and drop.
- **Mobile (NFR-03)**: board width follows its container (`aspect-square`), tap-tap moves supported, controls at least 44 px.
- **Theme**: Midnight board colours from the prototype (`midnightBoard` in `routes/prototype/-midnight-shell.tsx`) move to `board-theme.ts` as CSS variables (`--board-light`, `--board-dark`, `--board-highlight`, `--board-arrow`).
- **Replaceability**: if the S0 spike finds react-chessboard touch handling inadequate at 375 px, only `chess-board-impl.tsx` changes to cm-chessboard (MIT); the interface above stays. `shared/` must not import features (existing lint rule); the board may import `@b2c-template/chess`.

**Alternatives considered**: using react-chessboard directly in features (couples every feature to one library and its prop churn); a hand-rolled board (the prototype `-today-home-board.tsx` lacks drag, touch and promotion).

**Rationale**: One deep module for every board in the app; the library choice stays reversible (PRD fallback).

### ADR-17: Feature flags per pillar, server-owned

**Choice**: Server env `CHESSLAB_FEATURES` (comma list of `mistakes,repertoire,blindfold,progress`; default `mistakes`) parsed once into a `FeatureFlags` object. Exposed to the web through the existing public routes pattern: `GET /api/public/features` (`Cache-Control: no-store`, next to `/auth-providers`). Enforced on the server with `featureProcedure(pillar)` (a `protectedProcedure.use(...)` middleware in `packages/api/src/index.ts` that throws `NOT_FOUND` when off). On the web, `NavContext` gains `features: FeatureFlags`, so sidebar items use the existing `visible` predicate (`app/navigation.ts`), and pillar route groups check the flag in `beforeLoad`. A pillar's cards are excluded from `review.queue` when its flag is off. The email sign-up UI flag (`emailSignUp`, default off) uses the same mechanism.

**Alternatives considered**: build-time `VITE_FEATURE_*` flags (needs a web rebuild to toggle; not enforced server-side); a flag service (cost, another vendor); a per-user allowlist (adds an admin surface; deferred until tester gating needs it, see Open Questions).

**Rationale**: One source of truth, enforced where data is served, toggled per deployment without rebuilding the static site.

### ADR-18: Configuration constants live next to the logic that uses them

**Choice**: Product defaults that answer PRD open questions are exported constants in the owning package, each documented with the open question it defaults:

| Constant                                                                                   | Default                                                                                                                                                                                                                   | Owner                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `IMPORT_WINDOW_MONTHS`                                                                     | 3                                                                                                                                                                                                                         | `packages/api/src/services/import-config.ts`             |
| `FIRST_IMPORT_MAX_GAMES`                                                                   | 1000                                                                                                                                                                                                                      | same                                                     |
| `AUTO_SYNC_AFTER_MS`                                                                       | 6 h                                                                                                                                                                                                                       | same                                                     |
| `RATE_LIMIT_PAUSE_MS`, `MAX_429_RETRIES`                                                   | 60 000, 3                                                                                                                                                                                                                 | `packages/lichess/src/config.ts`                         |
| `DEFAULT_THRESHOLDS` (inaccuracy/mistake/blunder cp)                                       | 50 / 100 / 200                                                                                                                                                                                                            | `packages/chess/src/config.ts`                           |
| `CARD_SEVERITIES`                                                                          | `["mistake","blunder"]`                                                                                                                                                                                                   | `packages/chess/src/config.ts`                           |
| `MATE_CP`, `EVAL_CLAMP_CP`, `OPENING_PLY_LIMIT`, `ENDGAME_MATERIAL`, `TIME_PRESSURE_RATIO` | 1000, 1000, 20, 13, 0.1                                                                                                                                                                                                   | `packages/chess/src/config.ts`                           |
| `DEFAULT_DAILY_NEW_CARDS`, `DEFAULT_STUDY_PARAMS`                                          | 20, retention 0.9                                                                                                                                                                                                         | `packages/study/src/config.ts`                           |
| `ratingBandFor(ratings, offset = 0)`                                                       | user's own band (Lichess explorer bands), from the user's highest-game-count rating among blitz, rapid and classical                                                                                                      | `packages/chess/src/explorer-band.ts` (Phase 2)          |
| `FALLBACK_EXPLORER_BAND`                                                                   | `1600` band, used when the rating is unknown (no rated games, provisional rating, or missing `rating_snapshot`)                                                                                                           | same                                                     |
| `WEAKEST_OPENINGS_RULE`                                                                    | rank openings (by ECO) by **total eval loss of the user's carded-severity mistakes over the last 90 days**, minimum `WEAKEST_OPENINGS_MIN_GAMES` = 5 games in that opening, top 5 shown; ties broken by mistakes per game | `packages/api/src/services/progress-config.ts` (Phase 4) |
| `DRILL_ABANDON_AFTER_MS`                                                                   | 30 min                                                                                                                                                                                                                    | `packages/api/src/services/drills-config.ts` (Phase 3)   |
| `EXPLORER_CACHE_TTL_MS`, `EXPLORER_CACHE_MAX_ENTRIES`, `EXPLORER_STALE_MAX_MS`             | 24 h, 5000, 7 days                                                                                                                                                                                                        | `packages/lichess/src/config.ts` (Phase 2)               |
| `ENGINE_STRENGTH_LEVELS`, `ENGINE_DRILL_MOVETIME_MS`                                       | 8 levels (Skill Level 0 to UCI_Elo 2000), 500 ms                                                                                                                                                                          | `apps/web/src/features/engine/config.ts` (Phase 3)       |

All values in this table are reversible defaults, not final product decisions; changing one changes only its owning module and tests.
| `SCREEN_DEPTH`, `CONFIRM_DEPTH`, `SUBMIT_EVERY_PLIES`, `ENGINE_ID` | 10, 18, 10, pinned | `apps/web/src/features/engine/config.ts` |
| `QUEUE_PAGE_SIZE`, `QUEUE_PREFETCH_THRESHOLD` | 50, 10 | `apps/web/src/features/review/config.ts` |
| `DELETE_FRESH_WINDOW_MS` | 10 min | `packages/auth/src/lichess-account.ts` |

**Alternatives considered**: one global `chesslab.config.ts` (a shallow module everyone imports; couples pure packages to app config); DB-stored settings (premature; only `daily_new_card_limit` and the explorer band offset are user settings).

**Rationale**: Locality: a constant changes together with the logic and tests that read it.

### ADR-19: oRPC routers and context ports

**Choice**: New routers in `packages/api/src/routers/`, all built on `protectedProcedure` (pillar routers on `featureProcedure`), registered in `routers/index.ts`:

| Router                 | Procedures (Phase 1 unless noted)                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lichess`              | `status`, `sync`                                                                                                                   |
| `today`                | `summary`                                                                                                                          |
| `games`                | `list` (cursor pagination, reuses `packages/db/src/lib/pagination.ts`), `get`                                                      |
| `analysis`             | `next`, `submitEvals`, `complete`                                                                                                  |
| `mistakes`             | `list` (Phase 4 adds opening/phase/time-pressure filters), `get`                                                                   |
| `review`               | `queue`, `grade`                                                                                                                   |
| `settings`             | `get`, `update` (daily new-card limit, time zone)                                                                                  |
| `repertoire` (Phase 2) | `list`, `create`, `rename`, `delete`, `get` (graph), `addMove`, `deleteMove`, `setIdeaNote`, `explorer`, `addLineFromGame` (FR-16) |
| `drills` (Phase 3)     | `start`, `finish` (with failed item keys), `abandon`, `history`                                                                    |
| `progress` (Phase 4)   | `dashboard`                                                                                                                        |

`Context` (`packages/api/src/context.ts`) gains two ports, type-only like `AuthorizationPort`: `lichess: LichessPort` (`status(userId)`, `requestSync(userId)`, `explorer(userId, query)`; token resolution happens behind it in `apps/server`) and `features: FeatureFlags`. `packages/api` keeps no runtime dependency on `packages/lichess` or better-auth. The demo `privateData` procedure is removed in the cleanup slice.

Every query filters by `context.session.user.id`; ids from input are always combined with `user_id` in the `WHERE` clause (no "load by id then check").

**Rationale**: Follows the existing port pattern (`AuthorizationPort`, `PlatformAdminPort`) so routers stay testable with fakes.

### ADR-20: Streamed export as a Hono route

**Choice**: `apps/server/src/export-routes.ts` mounts `GET /api/export/data.json` and `GET /api/export/games.pgn`. The route resolves the session with `auth.api.getSession`, returns 401 without one, and streams with `hono/streaming` using `packages/api/src/services/export-service.ts`:

```ts
export function exportUserJson(db: Database, userId: string): AsyncIterable<string>; // one JSON document, written incrementally
export function exportUserPgn(db: Database, userId: string): AsyncIterable<string>; // imported games, PGN separated by blank lines
```

Each table is read in keyset pages (by `id`, page size 500) to bound memory. JSON sections: `user` (id, name, Lichess username; never tokens), `settings`, `lichessProfile` (no lease fields), `games`, `analyses`, `mistakes`, `cards`, `reviewLogs`, and later `repertoires` (positions, moves, idea notes), `drills`, `drillSessions`. Headers: `Content-Disposition: attachment`, `Cache-Control: no-store`. The web triggers the download with a plain link (top-level navigation sends the `SameSite=None` session cookie).

A schema meta-test enumerates every table in `packages/db/src/schema` that has a `user_id` column and asserts it is covered by `exportUserJson`, so later phases cannot forget export coverage (FR-19).

**Alternatives considered**: an oRPC procedure returning the whole JSON (buffers everything in memory; oRPC is not the right shape for file downloads); an async "email me a zip" job (needs deliverable email, which Lichess-only users lack).

**Rationale**: Streaming keeps memory flat for large histories; the meta-test turns FR-19 coverage into a check.

### ADR-21: Midnight shell replaces the template look; template is pruned last

**Choice**: Port the Midnight palette into `packages/ui/src/styles/globals.css` by mapping the prototype values to the existing shadcn tokens in the dark scheme (`--background` `#0b1220`, `--card` `#131c2e`, `--border` `#243350`, `--foreground` `#e6edf7`, `--muted-foreground` `#a3b3cb`, `--primary` `#3ee6b0`, `--primary-foreground` `#04231a`, `--radius` 1rem), and force the dark scheme for v1 (the theme preference card is removed in cleanup). `AuthenticatedShell` keeps its structure; navigation becomes Today, Review, Mistakes, Repertoire, Blindfold, Progress plus Account, with pillar items behind feature flags. `/` redirects to `/today` (`app/home-redirect.ts`). The admin group stays reachable for superadmins but leaves the main navigation in the cleanup slice; the `prototype/*` routes are deleted in that slice.

Contrast check for WCAG AA (NFR-04): `#a3b3cb` on `#0b1220` and `#04231a` on `#3ee6b0` both need verification with a contrast tool in the shell slice; adjust the muted token if below 4.5:1.

**Alternatives considered**: a separate Midnight component set (duplicates `packages/ui`); keeping light mode (the owner chose one look).

**Rationale**: Token mapping restyles every existing `packages/ui` component at once with the smallest diff.

### ADR-22: Server hosting (DECISION NEEDED)

`packages/infra/alchemy.run.ts` deploys only the web app (Cloudflare Vite site). `apps/server` is a long-running Bun process with an existing `apps/server/Dockerfile` (Node builder, `oven/bun:1` runner, port 3000). The import runner, in-memory `SerialGate` and streamed exports assume one always-on process.

| Option                                                                                                                                         | Pros                                                                                                        | Cons                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **A. Single always-on container from the existing Dockerfile on a managed container host (for example Fly.io, Railway, Render) (recommended)** | No code change; long streams and background imports work; one instance keeps in-process serialization valid | A second vendor besides Cloudflare; deploy not yet in alchemy                                                         |
| B. Cloudflare Containers driven by alchemy                                                                                                     | One IaC tool and vendor                                                                                     | Containers sleep when idle, interrupting imports (resumable, but slower); newer platform; needs alchemy resource work |
| C. Small VPS with Docker                                                                                                                       | Lowest cost, full control                                                                                   | Operating system and TLS maintenance on the owner                                                                     |

Recommendation: A, with exactly one instance in v1, placed close to the Postgres host. Whichever option is chosen, imports stay correct because the DB lease and cursor make them resumable. Finding: the Dockerfile installs `pnpm@11` while the repo uses pnpm 12; align before the first deploy. **This decision must be taken before the first tester release; it does not block Phase 1 implementation.**

## Data Flow

### Sign-in with Lichess (FR-01)

```
Browser --signIn.oauth2(lichess)--> better-auth --302 PKCE S256--> lichess.org/oauth
lichess.org --code--> /api/auth/oauth2/callback/lichess
  better-auth: token exchange -> getUserInfo(/api/account) -> accountSubject = id
             -> create/find user (synthetic email) -> account row (token encrypted)
  lichess-account plugin (after hook): upsert lichess_profile(id, username, ratings)
  -> session cookie -> redirect /today
```

### Import (FR-12, NFR-06, NFR-07)

```
Today loader -> lichess.status --(stale > 6h)--> LichessPort.requestSync
  apps/server: token = auth.api.getAccessToken(lichess, userId)   (decrypted server-side only)
  import-service: lease -> lichess.exportGames(sinceMs) NDJSON stream
     -> batch(50): insert games ON CONFLICT DO NOTHING + game_analysis(pending) + cursor  [1 txn]
     -> 429: state=backoff, retry_at ; error: state=failed ; end: state=idle
Browser polls lichess.status while running
```

### Analysis to cards (FR-13, FR-14)

```
engine feature                          server
analysis.next  ------------------------> oldest non-complete game + evals + next_ply
Worker(stockfish lite) screen depth 10
analysis.submitEvals(screen, batch) ---> merge evals by ply, advance next_ply
Worker confirm depth 18 on candidates
analysis.submitEvals(confirm) ---------> merge
analysis.complete ----------------------> classifyGame (packages/chess)
                                          txn: upsert mistakes, insert New cards, status=complete
```

### Review session (FR-04, FR-17, NFR-02, NFR-07)

```
review.queue (50 hydrated items) -> in-memory queue -> render card (board props only)
grade -> outbox.append(localStorage, sync) -> next card from memory (<200 ms)
      -> flush: review.grade(reviewLogId, ...) -> txn: insert log ON CONFLICT (id) DO NOTHING,
                                                   FSRS via packages/study, update card
remaining < 10 -> prefetch next page
```

### Export and delete (FR-19)

```
<a href=/api/export/data.json> -> Hono route -> session -> export-service (keyset pages) -> stream
Danger zone (synthetic email) -> POST /api/auth/lichess/delete-account {confirmUsername}
   -> 403 REAUTH_REQUIRED -> signIn.oauth2(lichess, callback ?confirm=1) -> retry
   -> audit userDeleting (fail closed) -> delete sessions + user -> FK cascade -> cookie cleared
```

## File Changes

Phase 1 (concrete). Phases 2 to 4 follow the same layout and are listed in summary.

| File                                                                                                                          | Action             | Description                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/chess/{package.json,tsconfig.json}`                                                                                 | Create             | `@b2c-template/chess`; deps `chess.js`                                                                                                         |
| `packages/chess/src/index.ts`                                                                                                 | Create             | Public interface                                                                                                                               |
| `packages/chess/src/position.ts` (+ test)                                                                                     | Create             | `positionKey`, `legalMoves`, `parseMove` (SAN/UCI), `applyMove`                                                                                |
| `packages/chess/src/pgn.ts` (+ test)                                                                                          | Create             | `parseGame(pgn)` -> plies with FEN before/after, SAN, UCI, `%clk` clocks, headers                                                              |
| `packages/chess/src/classify.ts` (+ test)                                                                                     | Create             | `screenCandidates`, `classifyGame`, phase and time-pressure rules                                                                              |
| `packages/chess/src/config.ts`                                                                                                | Create             | Thresholds and constants (ADR-18)                                                                                                              |
| `packages/study/{package.json,tsconfig.json}`                                                                                 | Create             | `@b2c-template/study`; deps `ts-fsrs`                                                                                                          |
| `packages/study/src/{index,fsrs,queue,day,config}.ts` (+ tests)                                                               | Create             | ADR-13 interface                                                                                                                               |
| `packages/lichess/{package.json,tsconfig.json}`                                                                               | Create             | `@b2c-template/lichess` (server-only)                                                                                                          |
| `packages/lichess/src/{index,client,ndjson,serial-gate,types,config}.ts` (+ tests)                                            | Create             | ADR-09                                                                                                                                         |
| `packages/db/src/schema/{lichess,settings,games,cards}.ts`                                                                    | Create             | ADR-04 to ADR-06 tables and relations                                                                                                          |
| `packages/db/src/schema/index.ts`                                                                                             | Modify             | Export new schema files                                                                                                                        |
| `packages/db/src/relations.ts`                                                                                                | Modify             | Spread new relation parts                                                                                                                      |
| `packages/db/src/migrations/*`                                                                                                | Create (generated) | Add-only migration(s) via `db:generate`                                                                                                        |
| `packages/auth/src/index.ts`                                                                                                  | Modify             | Register generic-oauth Lichess, `encryptOAuthTokens`, `lichessAccount` plugin; `AuthConfig` gains `LICHESS_CLIENT_ID?`                         |
| `packages/auth/src/lichess-account.ts` (+ integration test)                                                                   | Create             | Profile upsert hook, delete-account endpoint (ADR-08)                                                                                          |
| `packages/auth/src/lichess-provider.ts` (+ test)                                                                              | Create             | Provider config builder, `fetchLichessAccount` with injected fetch                                                                             |
| `packages/auth/src/synthetic-email.ts` (+ test)                                                                               | Create             | `syntheticEmail`, `isSyntheticEmail`                                                                                                           |
| `packages/auth/src/email/factory.ts`                                                                                          | Modify             | Drop sends to synthetic addresses                                                                                                              |
| `packages/auth/src/social-providers.ts`                                                                                       | Modify             | `listEnabledSocialProviders` includes `lichess` when configured                                                                                |
| `packages/api/src/context.ts`                                                                                                 | Modify             | `lichess: LichessPort`, `features: FeatureFlags`                                                                                               |
| `packages/api/src/index.ts`                                                                                                   | Modify             | `featureProcedure(pillar)`                                                                                                                     |
| `packages/api/src/features.ts` (+ test)                                                                                       | Create             | `parseFeatureFlags(env)`, `FeatureFlags` type                                                                                                  |
| `packages/api/src/services/{import-service,import-config,analysis-service,review-service,export-service}.ts` (+ tests)        | Create             | Persistence and orchestration (ADR-10, 12, 13, 20)                                                                                             |
| `packages/api/src/routers/{lichess,today,games,analysis,mistakes,review,settings}.ts` (+ integration tests)                   | Create             | ADR-19                                                                                                                                         |
| `packages/api/src/routers/index.ts`                                                                                           | Modify             | Register routers; remove `privateData` (cleanup slice)                                                                                         |
| `apps/server/src/services.ts`                                                                                                 | Modify             | Lichess client, `LichessPort` adapter (token via `auth.api.getAccessToken`), import runner, feature flags; `startBackgroundJobs` stops imports |
| `apps/server/src/context.ts`                                                                                                  | Modify             | Pass `lichess`, `features`                                                                                                                     |
| `apps/server/src/public-routes.ts`                                                                                            | Modify             | `GET /features`                                                                                                                                |
| `apps/server/src/export-routes.ts` (+ test)                                                                                   | Create             | Streamed export (ADR-20)                                                                                                                       |
| `apps/server/src/index.ts`                                                                                                    | Modify             | Mount `/api/export`                                                                                                                            |
| `apps/server/src/env.ts`, `.env.schema`                                                                                       | Modify             | `LICHESS_CLIENT_ID`, `CHESSLAB_FEATURES`                                                                                                       |
| `apps/web/scripts/copy-engine.ts`, `apps/web/package.json`                                                                    | Create/Modify      | Copy unmodified Stockfish files; deps `react-chessboard`, `chess.js` via `@b2c-template/chess`, `stockfish` (asset source only)                |
| `apps/web/.gitignore`                                                                                                         | Modify             | Ignore `public/engine/`                                                                                                                        |
| `apps/web/vite.config.ts`                                                                                                     | Modify             | Workbox `globIgnores: ["engine/**"]` + runtime cache route                                                                                     |
| `apps/web/src/shared/components/board/{chess-board,chess-board-impl,move-list,san-input,board-theme,index}.tsx` (+ SSR tests) | Create             | ADR-16                                                                                                                                         |
| `apps/web/src/features/engine/**`                                                                                             | Create             | ADR-11                                                                                                                                         |
| `apps/web/src/features/lichess-account/**`                                                                                    | Create             | Sign-in button, sync status, synthetic-email-aware account UI                                                                                  |
| `apps/web/src/features/games/**`                                                                                              | Create             | Games list, analysis status                                                                                                                    |
| `apps/web/src/features/mistakes/**`                                                                                           | Create             | Mistake list and detail                                                                                                                        |
| `apps/web/src/features/review/**`                                                                                             | Create             | Session, queue hook, outbox (ADR-14, 15)                                                                                                       |
| `apps/web/src/features/today/**`                                                                                              | Create             | Today home                                                                                                                                     |
| `apps/web/src/features/data-control/**`                                                                                       | Create             | Export links, Lichess delete flow                                                                                                              |
| `apps/web/src/routes/_auth/{today,review,mistakes,games}*.tsx`                                                                | Create             | Pillar routes with `staticData: { appShell: true }` and flag guards                                                                            |
| `apps/web/src/routes/licenses.tsx`                                                                                            | Create             | Stockfish licence and source page                                                                                                              |
| `apps/web/src/app/navigation.ts`, `use-nav-context.ts`, `home-redirect.ts`                                                    | Modify             | Pillar nav, feature flags in `NavContext`, `/` -> `/today`                                                                                     |
| `apps/web/src/features/auth/components/sign-in-page.tsx`                                                                      | Modify             | Lichess button; email sign-up behind `emailSignUp` flag                                                                                        |
| `apps/web/src/features/account/components/{danger-page,security-page,profile-page}.tsx`                                       | Modify             | Hide email/password flows and use the Lichess delete flow for synthetic-email users                                                            |
| `packages/ui/src/styles/globals.css`                                                                                          | Modify             | Midnight tokens                                                                                                                                |
| `.oxlintrc.json`, `tests/lint-boundaries.test.ts`, `tests/lint-boundaries/fixtures/**`                                        | Modify/Create      | ADR-02                                                                                                                                         |
| `apps/web/src/routes/prototype/**`                                                                                            | Delete             | Cleanup slice                                                                                                                                  |
| `apps/web/src/routes/_auth/dashboard.tsx`, theme preference card                                                              | Delete/Modify      | Cleanup slice (dashboard replaced by Today)                                                                                                    |

Phase 2: `packages/db/src/schema/repertoire.ts`, `packages/chess/src/repertoire-graph.ts`, `packages/chess/src/explorer-band.ts`, `packages/lichess` explorer, `routers/repertoire.ts`, `features/repertoire/**`, card CHECK widening migration, export sections. Phase 3: `schema/drills.ts`, `packages/chess/src/spoken-move.ts`, `packages/chess/src/drill-items.ts` (item keys), `routers/drills.ts`, `features/blindfold/**`, `features/voice-input/**` (Web Speech, feature-detected). Phase 4: `routers/progress.ts`, `features/progress/**`, mistake filters.

**Explicitly deferred to the phase's design refresh** (only the seams are fixed now; full design happens when the phase starts, against its specs):

- **Voice move input (Phase 3)**: speech-to-SAN grammar, recogniser configuration, confidence handling and ambiguity resolution. Fixed now: it lives in `features/voice-input`, uses `packages/chess` `parseMove` for legality, is feature-detected, and typed SAN is always present.
- **Voice privacy notice (Phase 3)**: wording, placement and consent flow (browser speech services may send audio to a vendor). Fixed now: the notice must be shown before the first microphone use.
- **Left-repertoire deviation algorithm (Phase 2, FR-16)**: how a game is matched to a repertoire (colour, transpositions, first out-of-book ply, which side deviated) and how "add this line" builds moves. Fixed now: it is a pure function in `packages/chess` over the repertoire graph and parsed plies, and its result is stored per game.

## Interfaces / Contracts

```ts
// packages/chess
export type PositionKey = string & { readonly __brand: "PositionKey" };
export function positionKey(fen: string): PositionKey;
export function parseMove(
  fen: string,
  input: string,
): { san: string; uci: string; fenAfter: string } | null;
export type ParsedPly = {
  ply: number;
  fenBefore: string;
  san: string;
  uci: string;
  color: "w" | "b";
  clockMs: number | null;
};
export function parseGame(pgn: string): {
  headers: Record<string, string>;
  plies: ParsedPly[];
  initialClockMs: number | null;
};
export type PlyEval = { cp?: number; mate?: number; depth: number; bestUci?: string } | null;
export function screenCandidates(
  plies: ParsedPly[],
  evals: PlyEval[],
  userColor: "w" | "b",
  t?: Thresholds,
): number[];
export type ClassifiedMistake = {
  ply: number;
  positionKey: PositionKey;
  fenBefore: string;
  playedSan: string;
  playedUci: string;
  bestSan: string;
  bestUci: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  evalLossCp: number;
  severity: "inaccuracy" | "mistake" | "blunder";
  phase: "opening" | "middlegame" | "endgame";
  clockLeftMs: number | null;
};
export function classifyGame(
  input: { pgn: string; evals: PlyEval[]; userColor: "w" | "b" },
  t?: Thresholds,
): ClassifiedMistake[];

// packages/api ports
export type ImportStatus = {
  state: "idle" | "running" | "backoff" | "failed";
  lastSyncedAt: Date | null;
  retryAt: Date | null;
  gamesImported: number;
};
export type LichessPort = {
  status(userId: string): Promise<ImportStatus>;
  requestSync(userId: string): Promise<ImportStatus>; // never throws for "already running"
};
export type FeatureFlags = Readonly<{
  mistakes: boolean;
  repertoire: boolean;
  blindfold: boolean;
  progress: boolean;
  emailSignUp: boolean;
}>;

// review contract
export type QueueItem = {
  cardId: string;
  pillar: "mistakes" | "repertoire" | "blindfold";
  prompt: { fen: string; orientation: "white" | "black"; text: string };
  answers: { san: string; uci: string }[]; // any of these is correct
  context?: { playedSan?: string; gameId?: string; evalLossCp?: number; ideaNote?: unknown };
  state: 0 | 1 | 2 | 3;
};
// review.grade input (zod)
// { reviewLogId: z.uuid(), cardId: z.string(), grade: z.int().min(1).max(4), reviewedAt: z.iso.datetime(), elapsedMs: z.int().min(0).max(3_600_000) }
```

## Testing Strategy

TDD applies to server, auth, API and pure logic (`openspec/config.yaml`); UI uses ordinary checks plus SSR component tests where useful.

| Layer             | What to test                                                                                                                                                                                                                                                              | Approach                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Unit (TDD)        | `packages/chess`: position key (castling, en-passant only when legal), SAN/UCI parsing, PGN with clocks, screen candidates, classification (mate mapping, clamp, thresholds, user-colour only, phase, time pressure)                                                      | `bun test` with fixture PGNs and hand-made eval arrays            |
| Unit (TDD)        | `packages/study`: new card, each grade transition, clamp of `reviewedAt`, queue selection (new limit, ordering, pillar interleave), local day bounds across DST                                                                                                           | `bun test`, fixed `now`                                           |
| Unit (TDD)        | `packages/lichess`: NDJSON across chunk boundaries, serial gate (no overlap per user, parallel across users), 429 backoff schedule and `LichessRateLimited`, query parameters                                                                                             | Fake `fetch` and fake clock/sleep                                 |
| Unit              | `features/engine/lib/uci.ts`, `grade-outbox.ts` (append, ordering, drop on non-retryable, replay)                                                                                                                                                                         | `bun test` with fake storage                                      |
| Integration (TDD) | Schema: CHECK rejects zero or two sources; unique `(user_id, lichess_game_id)`; cascade from user deletes every chess row                                                                                                                                                 | `bun test` against the test DB (`db:test:prepare`)                |
| Integration (TDD) | Import service: resume after failure mid-stream yields zero duplicates; lease blocks a concurrent run; backoff state on 429                                                                                                                                               | Fake `GamesSource`, real DB                                       |
| Integration (TDD) | Analysis service: merge idempotency, ownership rejection, `complete` creates exactly one card per carded mistake on repeat                                                                                                                                                | Real DB                                                           |
| Integration (TDD) | Review service: replayed `reviewLogId` returns the same result and does not double-apply; queue respects the daily new limit in the user's time zone                                                                                                                      | Real DB                                                           |
| Integration (TDD) | Auth: Lichess callback creates user with synthetic email, encrypted `access_token` (`$ba$` or hex form), profile upsert, username refresh on second sign-in; delete endpoint: stale session -> `REAUTH_REQUIRED`, wrong username -> `USERNAME_MISMATCH`, success cascades | better-auth test utils, fake Lichess endpoints via injected fetch |
| Integration       | Export: JSON contains every section and no token; meta-test covers every `user_id` table; PGN streams all games                                                                                                                                                           | Real DB, Hono app request                                         |
| Lint              | Boundary overrides of ADR-02                                                                                                                                                                                                                                              | `tests/lint-boundaries.test.ts` fixtures                          |
| SSR component     | Board renders placeholder with label; `SanInput` accepts legal and rejects illegal moves; `MoveList` marks current ply                                                                                                                                                    | `bun test` SSR render                                             |
| Manual            | 375 px touch board spike (S0), Today under 2 s on a throttled mid-range profile, contrast check, keyboard-only review session                                                                                                                                             | Recorded in the slice PR                                          |
| E2E               | None (no e2e layer in the repo)                                                                                                                                                                                                                                           | n/a                                                               |

## Threat Matrix

N/A: no routing of agent commands, shell, subprocess, VCS/PR automation, executable-file classification or process-integration boundary is introduced. (HTTP routes and the Web Worker are application features, covered by the security notes below, not by this matrix.)

| Boundary                 | Applicability                            |
| ------------------------ | ---------------------------------------- |
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection | N/A: no git automation                   |
| Commit state             | N/A: no git automation                   |
| Push state               | N/A: no git automation                   |
| PR commands              | N/A: no PR automation                    |

Application security requirements (carry into specs and tests):

- Lichess token: encrypted at rest, read only in `apps/server` through `auth.api.getAccessToken`, never returned by any procedure or export; lint forbids `@b2c-template/lichess`, `@b2c-template/auth` and `@b2c-template/db` in `apps/web`.
- Ownership: every procedure filters by session user id; client-submitted evals are bounded and scoped to the caller's games.
- Delete: fresh session plus typed username; impersonated sessions refused; audit write fails closed.
- Export: authenticated, `no-store`, no secrets.

## Migration / Rollout

- **Database**: Phase 1 adds `lichess_profile`, `user_settings`, `game`, `game_analysis`, `mistake`, `card`, `review_log`. Phase 2 adds repertoire tables, the `card.repertoire_position_id` column and widens the CHECK; Phase 3 the same for drills. No existing auth or audit column changes. Rollback: the app stops reading new tables; dropping them is a separate reviewed down-migration.
- **Auth**: enabling `encryptOAuthTokens` needs no data migration (plaintext tokens pass through `decryptOAuthToken`; verified). New Lichess tokens are encrypted from the first sign-in. Reverting the flag would make encrypted Lichess tokens unreadable by better-auth; in that case Lichess users re-sign-in (no refresh tokens are lost because Lichess issues none).
- **Feature flags**: deploy with `CHESSLAB_FEATURES=mistakes` for Phase 1 testers; enable later pillars per environment.
- **Engine**: removing `public/engine/*` disables analysis; the rest of the app works (analysis status shows "engine unavailable").

### Phase 1 slice plan (auto-chain, 400 authored lines per PR, migrations and lockfile excluded)

| #    | Slice                           | Scope                                                                                                                                                                                                                                          | Est. lines             | Depends on            |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------- |
| S0   | Dependencies and spikes         | Add `chess.js`, `ts-fsrs`, `react-chessboard`, `stockfish`; engine copy script, gitignore, workbox ignore; board spike screen at 375 px under `prototype/`; written notes verifying Lichess export params, `sort`, 429 rules and explorer auth | 250                    | none                  |
| S1a  | `packages/chess` core           | Scaffold, `positionKey`, `parseMove`, `parseGame` with clocks                                                                                                                                                                                  | 350                    | S0                    |
| S1b  | `packages/chess` classification | `screenCandidates`, `classifyGame`, config                                                                                                                                                                                                     | 300                    | S1a                   |
| S2   | Phase 1 schema and package lint | Seven tables, relations, migration, ADR-02 lint overrides + fixtures                                                                                                                                                                           | 380                    | S1a                   |
| S3   | Lichess sign-in                 | generic-oauth provider, synthetic email, encryption, profile upsert plugin, provider listing, sign-in button                                                                                                                                   | 380                    | S2                    |
| S4a  | `packages/lichess`              | Client, NDJSON parser, serial gate, backoff                                                                                                                                                                                                    | 350                    | S0                    |
| S4b  | Import service and router       | Import service, `LichessPort` adapter, `lichess` router, runner lifecycle                                                                                                                                                                      | 380                    | S2, S3, S4a           |
| S5a  | `packages/study`                | FSRS wrapper, queue selection, day bounds                                                                                                                                                                                                      | 300                    | S0                    |
| S5b  | Review and settings routers     | `review.queue` hydration, idempotent `review.grade`, `settings`                                                                                                                                                                                | 380                    | S2, S5a               |
| S6   | Board wrapper                   | `ChessBoard`, `MoveList`, `SanInput`, theme, SSR tests                                                                                                                                                                                         | 350                    | S1a, S0 spike verdict |
| S7   | Midnight shell and flags        | Tokens, navigation, `NavContext.features`, `/api/public/features`, `featureProcedure`, Today page with `today.summary`, `/` -> `/today`                                                                                                        | 400                    | S5b                   |
| S8   | Review session UI               | Session screen, queue prefetch, grade outbox                                                                                                                                                                                                   | 400                    | S6, S7                |
| S9a  | Engine runtime and licence page | Worker client, UCI parser, queue, `/licenses`                                                                                                                                                                                                  | 350                    | S0                    |
| S9b  | Analysis pipeline               | `analysis` router and service, card creation, `use-game-analysis` loop, analysis status UI                                                                                                                                                     | 400                    | S1b, S4b, S5b, S9a    |
| S10  | Games and mistakes UI           | Games list, mistake list and detail, sync status                                                                                                                                                                                               | 350                    | S9b, S7               |
| S11a | Export                          | Export service, Hono route, meta-test, export UI                                                                                                                                                                                               | 350                    | S2                    |
| S11b | Lichess-only deletion           | Delete endpoint, re-auth flow, danger page for synthetic-email users, hide email-only account UI                                                                                                                                               | 350                    | S3                    |
| S12  | Template cleanup                | Remove `prototype/*`, `privateData`, dashboard, theme card; admin out of main nav                                                                                                                                                              | 300 (mostly deletions) | all above             |

About 18 slices (more than the proposal's 10 to 12 estimate because S1, S4, S5, S9 and S11 each split to stay under 400 lines). The chain strategy (`stacked-to-main` or `feature-branch-chain`) is still to be chosen by the user before the first apply. Slices with no dependency between them (for example S4a, S5a, S9a after S0) can be reordered without breaking the chain.

## Open Questions

- [ ] **Server hosting (ADR-22)**: choose A (recommended), B or C before the first tester release.
- [ ] **Chain strategy** for auto-chain: `stacked-to-main` or `feature-branch-chain` (needed before the first apply).
- [ ] **Lichess API facts** (S0): export parameter names including `sort=dateAsc`, exact 429 guidance, whether the opening explorer requires a token (affects Phase 2 caching and the serial gate).
- [ ] **Board library verdict** (S0 spike): react-chessboard v5 at 375 px touch, or switch the implementation to cm-chessboard.
- [ ] **Stockfish build pinning** (S0): exact npm version and lite single-thread file names; licensing reading confirmed before public launch (launch gate, not legal advice).
- [ ] **PRD open questions** (defaults in ADR-18, all reversible): email sign-in beside Lichess, explorer band, carded eval-loss threshold, first import window.
- [ ] **Tester gating**: separate environment plus flags (assumed) versus a per-user allowlist (would add an admin surface).
- [ ] **Deferred designs**: voice move input and its privacy notice (Phase 3), left-repertoire deviation algorithm (Phase 2); see File Changes, "Explicitly deferred".
- [ ] **Contrast**: confirm Midnight muted text and mint-on-dark buttons reach 4.5:1 in S7.
