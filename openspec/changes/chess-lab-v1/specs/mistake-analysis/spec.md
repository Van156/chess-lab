# Mistake Analysis Specification

## Purpose

Classify moves by evaluation loss and turn qualifying mistakes into review cards. Traces: FR-13, FR-14, supports FR-15, FR-18 metrics.

## Requirements

### Requirement: Classification by evaluation loss

The system SHALL classify each of the user's moves as inaccuracy, mistake or blunder by the evaluation loss versus the engine's best move, using configured thresholds (defaults 50, 100 and 200 centipawns respectively). Changing thresholds MUST change classification without code changes. Moves below the inaccuracy threshold MUST NOT be flagged. (FR-13)

#### Scenario: Classification at thresholds

- GIVEN thresholds inaccuracy=T1, mistake=T2, blunder=T3 (configured)
- WHEN moves lose exactly T1, T2 and T3 centipawns
- THEN they are classified inaccuracy, mistake and blunder respectively
- AND a move losing less than T1 is not flagged

#### Scenario: Reconfigured thresholds

- GIVEN thresholds are changed
- WHEN the same evaluations are classified
- THEN classification follows the new values

#### Scenario: Only the user's moves

- GIVEN a game where the user played White
- WHEN classification runs
- THEN only White's moves are considered, not the opponent's

#### Scenario: Mate and decided positions

- GIVEN evaluations involving a forced mate or an already decided position
- WHEN loss is computed
- THEN loss is computed consistently, and moves in already decided positions are not flagged above the configured rules

### Requirement: Mistake record contents

Each flagged move SHALL be stored as a mistake with: ply, normalized FEN before the move, move played, best move, evaluation loss, severity, game phase, clock left (when available) and opening (ECO, when available). (FR-13, PRD data model)

#### Scenario: Stored fields

- GIVEN a blunder at ply 22 with clock data
- WHEN it is stored
- THEN all listed fields are present and the FEN is normalized (position-identifying fields only)

#### Scenario: No clock data

- GIVEN a game without clock information
- WHEN a mistake is stored
- THEN clock left is empty and no error occurs

#### Scenario: Game phase

- GIVEN a mistake in the opening, middlegame or endgame
- WHEN it is stored
- THEN its phase is set by the configured phase rule

### Requirement: Cards for carded severities only

A mistake card SHALL be created only for severities configured as carded (default: mistakes and blunders). Inaccuracies MUST be stored as mistakes but MUST NOT produce cards under the default. (FR-14)

#### Scenario: Default carding

- GIVEN default configuration
- WHEN a game yields one inaccuracy, one mistake and one blunder
- THEN three mistakes are stored and two cards are created

#### Scenario: Inaccuracies carded by configuration

- GIVEN inaccuracies are configured as carded
- WHEN the same game is processed
- THEN three cards are created

### Requirement: Exactly one card per mistake

Each carded mistake MUST yield exactly one card, and reprocessing the same game MUST NOT create duplicate mistakes or cards. (FR-14)

#### Scenario: Reanalysis

- GIVEN a game already processed into mistakes and cards
- WHEN it is analysed again at greater depth
- THEN no duplicate mistake or card is created
- AND an existing mistake's loss and best move may be updated

#### Scenario: Reanalysis changes severity

- GIVEN deeper analysis reclassifies a carded mistake as not carded
- WHEN it is reprocessed
- THEN existing review history is preserved and the outcome for the card is defined as retained, not deleted

### Requirement: Card prompt is the position before the mistake

A mistake card SHALL present the position before the user's move and ask for a better move; its answer MUST be the stored best move. (FR-14)

#### Scenario: Prompt and answer

- GIVEN a mistake card
- WHEN it is shown in review
- THEN the board shows the FEN before the move with the user to move
- AND the revealed answer is the best move

#### Scenario: Played move is accepted as wrong

- GIVEN the user enters the originally played mistake
- WHEN the answer is checked
- THEN it is judged incorrect

### Requirement: Repeat-mistake identification

The system SHALL record enough data (normalized FEN and move) to identify a new mistake as a repeat of an already carded mistake when the position or the opening move matches. (Supports success metric and FR-18)

#### Scenario: Repeat detected

- GIVEN a carded mistake at normalized FEN F with move M
- WHEN a later game contains a mistake at F with move M
- THEN it is flagged as a repeat

#### Scenario: Transposed equivalent position

- GIVEN the same position reached by a different move order
- WHEN the mistake is stored
- THEN the normalized FEN matches the earlier record

### Requirement: Analysis owned by the user

Evaluations submitted by the client MUST be stored only against games owned by the submitting user, and MUST NOT affect other users' data.

#### Scenario: Foreign game

- GIVEN a request submits evaluations for a game owned by another user
- WHEN it is processed
- THEN it is rejected and nothing is stored
