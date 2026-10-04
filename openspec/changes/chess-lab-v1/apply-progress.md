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
