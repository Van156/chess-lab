# Chess Board Specification

## Purpose

A reusable, client-only board component behind one wrapper interface, with touch input, annotations, a blindfold mode, an accessible move list and typed SAN input. Traces: FR-10 (typed part), NFR-03, NFR-04, NFR-08 (permissive dependencies only).

## Requirements

### Requirement: Client-only rendering behind a wrapper interface

The board SHALL be rendered only on the client and consumers MUST depend on a single wrapper interface, not on the underlying board library, so the library can be replaced without changing consumers. The board's dependencies MUST be MIT, BSD or Apache licensed. (NFR-08)

#### Scenario: No server rendering failure

- GIVEN a route that includes the board
- WHEN the app is built and loaded
- THEN loading the route does not throw during build or initial render

#### Scenario: Library swap isolation

- GIVEN consumers import only the wrapper interface
- WHEN the underlying library is replaced
- THEN no consumer source file requires changes

### Requirement: Touch and pointer move input

The board SHALL accept moves by drag and by tap-source-then-tap-target, on touch and pointer devices, at 375 px width, and MUST reject illegal moves, returning the piece to its square. (NFR-03)

#### Scenario: Tap-to-move

- GIVEN a position with a legal move e2 to e4
- WHEN the user taps e2 then e4
- THEN the move is reported to the consumer as legal

#### Scenario: Illegal move

- GIVEN a position where the attempted move is illegal
- WHEN the user attempts it
- THEN no move is reported and the piece stays on its original square

#### Scenario: Promotion

- GIVEN a legal pawn move to the last rank
- WHEN the user completes it
- THEN the user chooses the promotion piece before the move is reported

### Requirement: Arrows and square highlights

The board SHALL render consumer-supplied arrows and highlighted squares, and MUST clear them when the consumer clears them.

#### Scenario: Render annotations

- GIVEN arrows e2-e4 and highlighted square d5
- WHEN the board renders
- THEN the arrow and highlight are visible and exposed with text alternatives in the move/annotation description

#### Scenario: Clear annotations

- GIVEN annotations are displayed
- WHEN the consumer passes empty annotations
- THEN none are rendered

### Requirement: Blindfold mode

The board SHALL support a mode in which no pieces are drawn while the position and legal-move logic remain active. The mode MUST be switchable by the consumer.

#### Scenario: Pieces hidden

- GIVEN blindfold mode is on
- WHEN the board renders any position
- THEN no piece is drawn and the squares and coordinates remain visible per consumer setting

#### Scenario: Peek

- GIVEN blindfold mode is on
- WHEN the consumer turns it off
- THEN pieces are drawn for the current position

### Requirement: Accessible move list

Every board instance SHALL be accompanied by a text move list of the game so far, in SAN, available to assistive technology, with the current move indicated. (NFR-04)

#### Scenario: Move list updates

- GIVEN a game position after 1.e4 e5
- WHEN the board is displayed
- THEN the move list reads "1. e4 e5" and marks the last move as current

#### Scenario: Screen reader announcement

- GIVEN a screen reader is active
- WHEN a move is made
- THEN the new move is announced in text

### Requirement: Typed SAN input

Every board that accepts moves SHALL offer a text input accepting SAN, validated against the legal moves of the current position. Valid input MUST be applied as that move; invalid input MUST NOT change the position and MUST show an error stating the move is not legal. (FR-10 typed part, NFR-04)

#### Scenario: Valid SAN

- GIVEN the starting position
- WHEN the user types "Nf3" and submits
- THEN the knight move g1-f3 is reported as played

#### Scenario: Illegal SAN

- GIVEN the starting position
- WHEN the user types "Ke4"
- THEN the position is unchanged and an error message is shown

#### Scenario: Ambiguous or malformed

- GIVEN a position where "Nd2" is ambiguous or the text is not SAN
- WHEN the user submits it
- THEN no move is applied and the user is told to disambiguate or correct the input

### Requirement: Keyboard operation

The board and its controls SHALL be fully operable by keyboard, with visible focus, and tap targets of controls at least 44 px. (NFR-03, NFR-04)

#### Scenario: Keyboard-only move

- GIVEN keyboard use only
- WHEN the user focuses the SAN input, types a legal move and presses Enter
- THEN the move is played without pointer input
