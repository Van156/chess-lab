# Repertoire Specification

## Purpose

Build White and Black repertoire trees, annotate positions, generate review cards, and flag where games leave the repertoire. Traces: FR-02, FR-03, FR-06, FR-16.

## Requirements

### Requirement: Repertoire trees per colour

The system SHALL let a user create named repertoires of colour White or Black and build them by playing moves on the board, each move creating a node (normalized FEN, SAN, parent, whether it is the user's move). A position MAY have multiple children (branches). (FR-02)

#### Scenario: Add moves

- GIVEN an empty White repertoire
- WHEN the user plays 1.e4 then 1...e5 on the board
- THEN two nodes exist in a chain, the first marked as the user's move

#### Scenario: Branch

- GIVEN a node with one child
- WHEN the user plays a different legal move from the same position
- THEN the node has two children

#### Scenario: Illegal move not stored

- GIVEN any position
- WHEN an illegal move is attempted
- THEN no node is created

#### Scenario: Duplicate move

- GIVEN a node with child e5
- WHEN the user plays e5 again
- THEN no duplicate child is created

### Requirement: Transpositions

Nodes MUST be identified by normalized FEN so the same position reached by different move orders is recognised as one position. The tree SHALL show that the position is shared, and annotations and cards MUST NOT be duplicated for it. (FR-02)

#### Scenario: Transposition recognised

- GIVEN lines 1.d4 Nf6 2.c4 and 1.c4 Nf6 2.d4 reaching the same position
- WHEN both are entered
- THEN a single position record exists and is reachable from both paths

#### Scenario: Different move counters

- GIVEN two FENs equal except halfmove and fullmove counters
- WHEN compared
- THEN they are treated as the same position

### Requirement: Navigate and edit the tree

The user SHALL be able to navigate to any node, delete a node (with its subtree after confirmation), and rename or delete a repertoire.

#### Scenario: Delete subtree

- GIVEN a node with descendants
- WHEN the user confirms deletion
- THEN the node and descendants are removed along with their cards and notes

#### Scenario: Delete repertoire

- GIVEN a repertoire with nodes and cards
- WHEN it is deleted
- THEN all its nodes, notes and cards are removed

### Requirement: Idea notes

The user SHALL be able to attach to any node one idea note with arrows, highlighted squares and a one-line plan. At most one note exists per node. The note MUST render on the board (arrows and highlights) when the node is shown, and the plan MUST be shown as text. (FR-03)

#### Scenario: Create note

- GIVEN a node
- WHEN the user draws arrow e2-e4, highlights d5 and writes a plan
- THEN these are saved on the node

#### Scenario: Note displayed

- GIVEN a node with a note
- WHEN it is shown in the builder or as a review card
- THEN arrows, highlights and plan appear

#### Scenario: Edit and clear

- GIVEN an existing note
- WHEN the user edits or clears it
- THEN the changes persist, and clearing removes the note

#### Scenario: Plan length

- GIVEN a plan text longer than the configured one-line limit
- WHEN saved
- THEN it is rejected or truncated with the user informed

### Requirement: Repertoire cards

For every repertoire position where it is the user's move, the system SHALL maintain one review card whose prompt is the position and whose answer is the prepared move. Positions where it is the opponent's move MUST NOT produce cards. (FR-06)

#### Scenario: Card creation

- GIVEN a White repertoire with 1.e4 e5 2.Nf3
- WHEN nodes are saved
- THEN cards exist for the positions where White is to move and prepared moves are the answer

#### Scenario: Branch for the user

- GIVEN a position where the user has two prepared moves
- WHEN reviewed
- THEN either prepared move is accepted as correct (or the model defined by design makes this explicit and testable)

#### Scenario: No duplicate card on transposition

- GIVEN a transposed position
- WHEN nodes are saved
- THEN only one card exists for the position

#### Scenario: Card removal

- GIVEN a repertoire node is deleted
- WHEN deletion completes
- THEN its card is removed

#### Scenario: Note in review

- GIVEN a card whose node has an idea note
- WHEN the answer is shown
- THEN the note's arrows, highlights and plan are shown

### Requirement: Left-repertoire flag

For each imported game, the system SHALL identify the first move where the user's moves deviated from the user's repertoire for that colour, mark that move, and offer to add the resulting line to the repertoire. The flag MUST appear only when the game followed the repertoire up to that point and the user's move was not a prepared move. (FR-16)

#### Scenario: Deviation flagged

- GIVEN a repertoire with 1.e4 e5 2.Nf3 and a game 1.e4 e5 2.Bc4
- WHEN the game is evaluated
- THEN move 2.Bc4 is marked as the point where the user left the repertoire

#### Scenario: Opponent deviates

- GIVEN the opponent plays a move not in the repertoire
- WHEN the game is evaluated
- THEN it is shown as the end of repertoire coverage and is not marked as the user's deviation

#### Scenario: Add line

- GIVEN a flagged deviation
- WHEN the user accepts "add this line"
- THEN the game's moves from the deviation onward are added as nodes and cards are created for the user's moves

#### Scenario: No repertoire for colour

- GIVEN the user has no repertoire for the game's colour
- WHEN the game is evaluated
- THEN no flag is produced

#### Scenario: Transposed arrival

- GIVEN the game reaches a repertoire position by transposition
- WHEN evaluated
- THEN it is treated as still in repertoire

### Requirement: Accessible builder

The builder SHALL work at 375 px with touch, have an accessible move list and typed SAN input, and a text alternative for arrows and highlights. (NFR-03, NFR-04)

#### Scenario: Typed entry

- GIVEN the builder
- WHEN the user types a legal SAN move
- THEN the node is added without pointer input
