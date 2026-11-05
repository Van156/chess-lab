# S0 verification notes (chess-lab-v1)

S0.7 was verified by a separate research worker; its section follows S0.6.

## S0.6 Board spike, 375 px touch check

PENDING: manual 375 px touch check by the user.

Spike is ready at `/prototype/board-spike` (`apps/web/src/routes/prototype/board-spike.tsx`, throwaway, deleted in S12; not in the lab catalog). Run `pnpm dev:web` and open it on a real phone or in device emulation at 375 px. Check: tap-tap move (select piece, tap target), drag move, promotion picker ("Promotion position" button, then a7-a8), arrows (green arrows preview legal targets of the selected piece; right-drag or long-press draws extra arrows), and that dragging does not scroll the page.

Verdict to record: keep `react-chessboard` or switch `chess-board-impl.tsx` to cm-chessboard. Not yet decided.

## S0.7 Lichess API facts (verified 2026-10-04)

Source: the OpenAPI yaml in https://github.com/lichess-org/api (master, `doc/specs/`) plus one live unauthenticated request to the explorer. The rendered lichess.org/api page could not be read.

| Fact                                          | Verified                                                                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Games export `GET /api/games/user/{username}` | `since`/`until` (ms timestamps), `max`, `sort` (`dateAsc` or `dateDesc`, default `dateDesc`), `clocks`, `opening`, `pgnInJson`, `evals` (default false), `moves`, `finished` (default true), `rated`, `perfType` (comma list) all exist |
| Export format                                 | `Accept: application/x-ndjson` (or PGN); streamed                                                                                                                                                                                       |
| Export speed                                  | 20 games/s anonymous, 30 with a token, 60 for your own games with a token                                                                                                                                                               |
| Export scope                                  | None needed (`OAuth2: []`, no scope); inferred, not tested with a live token                                                                                                                                                            |
| HTTP 429                                      | "Waiting one minute before retrying will be sufficient" in most cases; some limits need longer                                                                                                                                          |
| Concurrency                                   | "Only make one request at a time"                                                                                                                                                                                                       |
| Explorer                                      | `https://explorer.lichess.org/lichess`; params `fen`, `play`, `speeds`, `ratings` (buckets 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500), `moves` (12), `topGames` (4), `recentGames` (4), `since`/`until` (YYYY-MM)               |
| Explorer auth                                 | **Token required**: unauthenticated request returned 401 (2026-10-04); spec declares OAuth2, no scope                                                                                                                                   |
| OAuth                                         | Authorize `https://lichess.org/oauth`, token `https://lichess.org/api/token`; unregistered public clients; PKCE `S256` only                                                                                                             |
| Tokens                                        | Last about one year; no refresh tokens; may exceed 512 characters                                                                                                                                                                       |
| `GET /api/account`                            | `id`, `username`, `perfs` keyed by speed; each `Perf` has `games`, `rating`, `rd`, `prog`; `prov` only when provisional                                                                                                                 |

Design impact: ADR-09 amended (explorer always sends the user's token; 401 maps to re-authorization). Gaps: explorer per-token rate limits are undocumented; scope-free export and account calls are inferred from the spec, not tested with a live token.

## S0.8 Stockfish pin

- npm package: `stockfish@19.0.0` (devDependency of `apps/web`, resolved as `^19.0.0`; `pnpm-lock.yaml` pins 19.0.0). License field: GPL-3.0. `buildVersion`: 19.
- Upstream source: https://github.com/nmrugg/stockfish.js (npm `repository`: `git://github.com/nmrugg/stockfish.js`); licence text https://raw.githubusercontent.com/nmrugg/stockfish.js/master/Copying.txt.
- Lite single-thread files in the package `bin/`: `stockfish-19-lite-single.js`, `stockfish-19-lite-single.wasm`. Licence file: `Copying.txt` (package root, GPL v3).
- md5: js `a4daa2dfacc853ab3c70e8967a6912d7`, wasm `92258327755a372f1b4a867658ddba69`. `scripts/copy-engine.ts` copies them byte-identical (verified with `cmp`) to `apps/web/public/engine/`.
- UCI handshake (run headless under node with `bin/stockfish-19-lite-single.js`, sent `uci`):
  - `id name Stockfish 19 Lite WASM`
  - `option name UCI_Elo type spin default 1320 min 1320 max 3190`
  - Verified: `UCI_Elo` min 1320, max 3190.
- `ENGINE_ID` for S9a: `stockfish-19-lite-single` (matches `id name` "Stockfish 19 Lite WASM"; suggested stored value `stockfish-19-lite-single`).
- pnpm note: the package has a `postinstall` (only creates `bin/stockfish.js` symlinks, unused by us). pnpm 12 reported `ERR_PNPM_IGNORED_BUILDS` and added a placeholder `stockfish: set this to true or false` under `allowBuilds` in `pnpm-workspace.yaml`. It must be set to `false` (build script not needed); see the open item in the S0 report.

## S0.9 Dockerfile pnpm finding

- `apps/server/Dockerfile` line 2: `RUN npm install -g pnpm@11`.
- Root `package.json`: `"packageManager": "pnpm@12.4.2"`.
- Mismatch confirmed (11 vs 12.4.2). Fix needed before first deploy: install the pinned version (for example `corepack enable` with the `packageManager` field, or `npm install -g pnpm@12.4.2`). The fix belongs to the hosting decision, not S0; the Dockerfile was not modified.

## S0.10 Stockfish GPL launch gate

Stockfish is GPL-3.0. The app serves it unmodified as a separate static asset loaded in a Web Worker, with `Copying.txt` shipped alongside, and never imports it into app code. Whether this separation is sufficient for the app's own licence remains a LAUNCH GATE: the legal reading must be confirmed before first public deploy.

## Verification facts

- `pnpm --filter web build` succeeds; `prebuild` populates `apps/web/public/engine` (`Copying.txt`, `stockfish-19-lite-single.js`, `stockfish-19-lite-single.wasm`) and `dist/engine`.
- No `stockfish` string in `apps/web/dist/assets/*` or `dist/sw.js` (engine excluded from precache).
