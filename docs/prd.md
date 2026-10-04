# Chess Lab PRD

> Repo copy of the Claude Doc https://claude.ai/code/artifact/51cf46d1-b99f-4d0b-a86a-5d37350bee10 (rev 13, 2026-10-04). The doc is the source of truth; refresh this copy when it changes.

Chess Lab is a free, public web app that turns your own Lichess games, a visual opening repertoire and blindfold drills into one daily spaced-repetition session.

## Problem and goals

Club players repeat the same opening mistakes because their study is spread across tools that never talk to each other. Lichess shows the mistake, a course teaches the line, and nothing brings either back at the right time.

v1 commits to three outcomes:

1. **Fewer repeated mistakes:** every engine-flagged mistake from your own games becomes a review card, and the same mistake shows up less often over time.
2. **Openings you remember:** you build your own repertoire inside the app, with visual idea notes (arrows, highlighted squares, a one-line plan) that make each line easy to recall.
3. **Board vision:** blindfold drills, including voice input, train you to see the board without looking at it.

All three feed one daily review session scheduled by FSRS, so a few minutes a day covers everything.

**Non-goals for v1:** playing games against other people, importing Lichess studies or puzzle history, Chess.com import, a paid tier, native mobile apps.

## Users

The primary user is an adult club player rated roughly 1200 to 2000 on Lichess who plays online regularly and wants to improve in 10 to 20 minutes a day.

| Job                         | What they need from Chess Lab                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Stop repeating mistakes     | See the mistakes from their own games, understand the better move, and drill it until it sticks                  |
| Learn and keep a repertoire | Build White and Black lines quickly, mark the key idea of each line visually, and get quizzed before they forget |
| Improve board vision        | Short blindfold drills they can do on a phone or with voice, with a level that grows with them                   |
| Know if it works            | A simple view of streak, accuracy and which openings still leak points                                           |

## At a glance

```text
            Your Lichess games
                   |
                   v
   Mistakes        Repertoire        Blindfold
 (Stockfish flags  (lines with       (coordinates, replay,
  mistakes; each   visual ideas;     engine; voice or
  becomes a card)  your moves        typed moves)
                   become cards)
        \               |               /
         v              v              v
          Daily review queue (FSRS)
   prompt, show answer, grade Again / Hard / Good / Easy
                        |
                        v  grades and drill results
                    Progress
       streak, accuracy, repeat-mistake rate
```

Mistakes, repertoire and blindfold each produce cards; one FSRS queue schedules them all, and Progress reads the results.

## Functional requirements

Nineteen requirements across five pillars plus account. P0 is required for the public v1 launch; Phase is the release phase that delivers it.

| ID    | Pillar     | Requirement                                                                                                                  | Priority | Phase |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| FR-01 | Account    | Sign in with Lichess (OAuth 2.0 with PKCE); the Lichess username links the account to its games                              | P0       | 1     |
| FR-02 | Repertoire | Build White and Black repertoire trees by playing moves on the board, with branches and transpositions                       | P0       | 2     |
| FR-03 | Repertoire | Attach visual idea notes to any position: arrows, highlighted squares and a one-line plan                                    | P0       | 2     |
| FR-04 | Review     | One daily queue of due cards from every pillar, scheduled by FSRS, with a daily new-card limit                               | P0       | 1     |
| FR-05 | Repertoire | Show Lichess opening explorer stats (games, win/draw/loss) for the user's rating band beside each candidate move             | P1       | 2     |
| FR-06 | Repertoire | Turn every repertoire position where it is the user's move into a review card: play the prepared move                        | P0       | 2     |
| FR-07 | Blindfold  | Coordinates drill: name or click the square shown, timed                                                                     | P0       | 3     |
| FR-08 | Blindfold  | Square colour drill: say whether a named square is light or dark                                                             | P1       | 3     |
| FR-09 | Blindfold  | Replay drill: follow a game from notation on a hidden board and answer questions about the position; each peek is counted    | P0       | 3     |
| FR-10 | Blindfold  | Move input by voice (speech to SAN) and by typed SAN, both validated against legal moves                                     | P0       | 3     |
| FR-11 | Blindfold  | Play the engine blindfold at a chosen strength; levels raise the number of moves before a peek is allowed                    | P2       | 3     |
| FR-12 | Mistakes   | Import the user's Lichess games, first the last 3 months, then incremental syncs                                             | P0       | 1     |
| FR-13 | Mistakes   | Analyse imported games with Stockfish and flag inaccuracies, mistakes and blunders by evaluation loss                        | P0       | 1     |
| FR-14 | Mistakes   | Turn each mistake into a review card: find the better move from the position before it                                       | P0       | 1     |
| FR-15 | Mistakes   | Filter mistakes by opening, game phase and time pressure (clock under 10% of the start time)                                 | P1       | 4     |
| FR-16 | Mistakes   | Mark the move where a game left the user's repertoire and offer to add the line                                              | P1       | 2     |
| FR-17 | Review     | Review session: board prompt, move input, Show answer, then grade Again / Hard / Good / Easy to update the card's FSRS state | P0       | 1     |
| FR-18 | Progress   | Dashboard: streak, accuracy per pillar, repeat-mistake rate trend, weakest openings, blindfold best depth, review heatmap    | P1       | 4     |
| FR-19 | Account    | Export all personal data (PGN and JSON) and delete the account with its data                                                 | P0       | 1     |

## Non-functional requirements

| ID     | Area          | Requirement                                                                                                                                                                                     |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Cost          | Engine analysis runs in the browser (Stockfish WASM), so server cost does not grow with analysis volume                                                                                         |
| NFR-02 | Performance   | The review session shows the next card in under 200 ms; the Today screen loads in under 2 s on a mid-range phone over 4G                                                                        |
| NFR-03 | Mobile        | Every screen works at 375 px wide with touch; tap targets are at least 44 px                                                                                                                    |
| NFR-04 | Accessibility | WCAG 2.2 AA: contrast of at least 4.5:1, full keyboard use, and an accessible move list and text move input beside every board                                                                  |
| NFR-05 | Privacy       | Store only the Lichess username, games and study data; Lichess tokens are encrypted at rest and never sent to the browser                                                                       |
| NFR-06 | Lichess API   | Respect Lichess rate limits: one request at a time per user, back off on HTTP 429, and stream game exports                                                                                      |
| NFR-07 | Reliability   | Imports resume after failure without duplicating games; review grades are never lost on a flaky connection                                                                                      |
| NFR-08 | Licensing     | Only permissive dependencies (MIT, BSD, Apache) in the app bundle. Stockfish (GPL-3.0) runs as a separate, unmodified Web Worker file, with its licence and source offered to users (see Risks) |

## Data model

Every card points at one source (a repertoire position, a mistake or a blindfold drill), so the review queue stays a single table.

| Entity         | Holds                                                                                | Key relations                                            |
| -------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| User           | Lichess username, rating band, settings (daily new-card limit, board theme)          | Owns everything below                                    |
| LichessAccount | Encrypted OAuth token, last sync time                                                | 1:1 with User                                            |
| Game           | Lichess game id, PGN, colour, time control, result, played at                        | Many per User; unique by Lichess id                      |
| Analysis       | Per-move evaluation, engine depth, analysed at                                       | 1:1 with Game                                            |
| Mistake        | Ply, FEN before, played move, best move, eval loss, phase, clock left, opening (ECO) | Many per Game                                            |
| Repertoire     | Colour (White or Black), name                                                        | Many per User                                            |
| RepertoireNode | FEN, move (SAN), parent node, is user's move                                         | Tree inside a Repertoire                                 |
| IdeaNote       | Arrows, highlighted squares, one-line plan                                           | 0..1 per RepertoireNode                                  |
| Card           | Source type and id, FSRS state (due, stability, difficulty, reps, lapses)            | Many per User; source = RepertoireNode, Mistake or Drill |
| ReviewLog      | Grade, reviewed at, elapsed time, state before                                       | Many per Card                                            |
| DrillSession   | Drill type, level, score, peeks, best depth                                          | Many per User                                            |

## Key decisions

| Area           | Choice                                                                                    | Why                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product        | Public and free, no paid tier                                                             | Decided by the owner; keeps running cost as the main constraint                                                                                                                     |
| Import scope   | Lichess games only; repertoires are built in the app                                      | Studies and puzzle history add sync work without serving the three outcomes                                                                                                         |
| Chessboard     | [react-chessboard](https://github.com/Clariity/react-chessboard) v5 (MIT)                 | React 19 support, props for square colours, rounded corners, custom pieces, arrows and square highlights. Chessground was ruled out because GPL-3.0 would force the app open source |
| Board fallback | [cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT)                            | Has arrows, markers and an accessibility extension; needs a small React wrapper                                                                                                     |
| Chess rules    | chess.js (BSD-2)                                                                          | Legal moves, SAN, FEN and PGN; parses typed and spoken moves                                                                                                                        |
| Scheduler      | FSRS via ts-fsrs                                                                          | Better retention per review than SM-2; one algorithm for every card type                                                                                                            |
| Engine         | Stockfish WASM in a Web Worker                                                            | Zero server cost for analysis (NFR-01)                                                                                                                                              |
| Voice          | Browser Web Speech API, typed SAN as fallback                                             | No server cost; blindfold v1 includes voice by owner decision                                                                                                                       |
| Stack          | React 19 + TanStack Router + Tailwind 4 (web), Hono + oRPC (server), better-auth, Drizzle | The existing monorepo; no new platform to learn                                                                                                                                     |
| Look           | Midnight theme from the prototype: navy + mint, left sidebar, 16 px radius                | Chosen by the owner from five prototype variants                                                                                                                                    |

Blindfold mode on react-chessboard uses an empty piece set; the library has no built-in hidden-pieces option.

## Release plan

The public v1 launch follows Phase 3; each phase ships to a small group of testers first.

1. **Phase 1, mistake loop:** Lichess sign-in, game import, Stockfish analysis, mistake cards, review session, daily queue, data export and deletion (FR-01, 04, 12, 13, 14, 17, 19).
2. **Phase 2, repertoire:** repertoire builder, visual idea notes, explorer stats, repertoire cards, left-repertoire flag (FR-02, 03, 05, 06, 16).
3. **Phase 3, blindfold:** coordinates, square colour, replay and engine drills, voice and typed moves (FR-07 to FR-11).
4. **Phase 4, insight:** progress dashboard and mistake filters (FR-15, 18).

## Success metrics

Targets are first guesses to revisit after Phase 1 testers.

| Metric                   | Definition                                                                                     | Target                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Repeat-mistake rate      | Share of new mistakes that match a mistake already carded (same position or same opening move) | Falls 30% after 8 weeks of use                    |
| Day-30 retention         | Share of new users who review on day 30                                                        | 25%                                               |
| Daily session completion | Share of sessions where the due queue reaches zero                                             | 60%                                               |
| Review accuracy          | Share of cards graded Good or Easy                                                             | Stays between 80% and 90% (FSRS target retention) |
| Blindfold depth          | Moves a user can follow before the first peek                                                  | Grows month over month for active users           |

## Risks and open questions

| Risk                                                    | Impact                                                | Mitigation                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stockfish is GPL-3.0                                    | Shipping it could put licence duties on the app       | Ship it unmodified as a separate worker file, show its licence and link its source. Confirm this reading before launch; it is not legal advice |
| Lichess API limits and terms change                     | Imports slow down or break                            | Stream exports, back off on HTTP 429, and check the current API docs before Phase 1 (the details here are not yet verified)                    |
| In-browser analysis is slow on phones                   | Mistakes appear late after import                     | Analyse at a shallow depth first, deepen in the background, and resume across sessions                                                         |
| Web Speech API support varies by browser                | Voice input fails for some users                      | Feature-detect it and always offer typed SAN                                                                                                   |
| react-chessboard touch and SSR behaviour are unverified | Board feels poor on mobile or breaks server rendering | Spike one prototype screen at 375 px before Phase 1; render the board client-only                                                              |

Open questions:

- [ ] Should email sign-in exist beside Lichess sign-in, for users who want to try repertoire and blindfold without a Lichess account?
- [ ] Which rating bands should explorer stats use: the user's own band, or a band one step above it?
- [ ] What eval loss counts as a mistake worth carding (for example 100 centipawns or more)?
- [ ] Should the first import cover only the last 3 months (assumed) or the whole game history?

## Sources

Library facts were checked on 2026-10-04. Lichess API and FSRS details are from memory and still need checking.

- [react-chessboard](https://github.com/Clariity/react-chessboard): MIT, v5.12.1, React 19 peer
- [chessground](https://github.com/lichess-org/chessground): GPL-3.0-or-later
- [cm-chessboard](https://github.com/shaack/cm-chessboard): MIT, arrows, markers and accessibility extensions
- [chess.js on npm](https://registry.npmjs.org/chess.js): BSD-2-Clause, v1.4.0
