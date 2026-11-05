# Blindfold Drills Specification

## Purpose

Four board-vision drills with recorded results that feed the review queue and progress. Traces: FR-07, FR-08, FR-09, FR-11, NFR-03, NFR-04.

## Requirements

### Requirement: Coordinates drill

The system SHALL show a target square and let the user name it (typed) or click/tap it on the board, timed, and record the score and time in a drill session. (FR-07)

#### Scenario: Correct answer

- GIVEN a displayed target square
- WHEN the user names or taps it correctly
- THEN it counts as correct and the next target appears

#### Scenario: Wrong answer

- GIVEN a displayed target square
- WHEN the user answers incorrectly
- THEN it counts as incorrect and the correct square is shown

#### Scenario: Timer expiry

- GIVEN the timed drill duration elapses
- WHEN time runs out
- THEN the drill ends and a session with score is recorded

#### Scenario: Text-only answering

- GIVEN keyboard-only use
- WHEN the user types a square name
- THEN the drill is fully playable without the board

### Requirement: Square colour drill

The system SHALL name a square and ask whether it is light or dark, recording the result. (FR-08)

#### Scenario: Correct colour

- GIVEN "a1" is shown
- WHEN the user answers dark
- THEN it counts as correct

#### Scenario: Incorrect colour

- GIVEN "h1" is shown
- WHEN the user answers dark
- THEN it counts as incorrect

### Requirement: Replay drill with peek counting

The system SHALL present a game as notation on a hidden board and ask questions about the current position (for example which piece stands on a square), and MUST count each reveal of the board as one peek and record the peek count. (FR-09)

#### Scenario: Question answered

- GIVEN the replay has advanced to a position
- WHEN the user answers a question about it
- THEN correctness is recorded

#### Scenario: Peek counted

- GIVEN the board is hidden
- WHEN the user reveals it
- THEN the peek count increases by one for that session

#### Scenario: Session result

- GIVEN a completed replay
- WHEN the session ends
- THEN score, peek count and the deepest move reached without peeking are stored

#### Scenario: Notation shown as text

- GIVEN a replay
- WHEN a move is delivered
- THEN it is available as text to assistive technology

### Requirement: Engine blindfold

The system SHALL let the user play the engine with a hidden board at a chosen strength, with levels defining the number of moves before a peek is allowed. Peeking before the allowance MUST be refused. Moves MUST be entered through typed SAN or voice. (FR-11, FR-10)

#### Scenario: Peek locked

- GIVEN a level allowing a peek after K moves and fewer than K moves played
- WHEN the user asks to peek
- THEN the request is refused

#### Scenario: Peek allowed

- GIVEN at least K moves have been played
- WHEN the user peeks
- THEN the board is shown and a peek is counted

#### Scenario: Engine replies

- GIVEN the user plays a legal move
- WHEN the engine's turn comes
- THEN the engine replies with a legal move at the chosen strength and the move is announced as text

#### Scenario: Level selection

- GIVEN the user picks strength and level
- WHEN the game starts
- THEN those are recorded in the drill session

### Requirement: Drill sessions recorded

Each completed or abandoned drill SHALL be stored as a drill session with type, level, score, peeks and best depth (moves followed before the first peek). (PRD data model, supports FR-18)

#### Scenario: Complete session

- GIVEN a finished drill
- WHEN it ends
- THEN a session with all fields is stored for the user

#### Scenario: Abandoned drill

- GIVEN the user leaves mid-drill
- WHEN they navigate away
- THEN a partial session is stored or discarded consistently as documented, and no error occurs

### Requirement: Drill results feed cards

Drill results SHALL be able to create review cards sourced from the drill (for example the squares or positions answered wrongly), scheduled by the same queue as other cards. (PRD at-a-glance, review-queue)

#### Scenario: Failed item carded

- GIVEN a wrong answer in a drill
- WHEN the session is saved
- THEN a card sourced from that drill exists for the failed item

#### Scenario: No duplicate cards

- GIVEN the same failed item recurs in later sessions
- WHEN sessions are saved
- THEN no duplicate card is created

### Requirement: Mobile and accessible drills

Every drill SHALL work at 375 px with touch, 44 px targets, and be playable through text input alone. (NFR-03, NFR-04)

#### Scenario: Narrow viewport

- GIVEN 375 px width
- WHEN a drill is open
- THEN controls fit without horizontal scroll and targets are at least 44 px
