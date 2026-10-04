# Voice Move Input Specification

## Purpose

Enter moves by speaking, converted to SAN and validated against legal moves, with typed SAN always available. Traces: FR-10 (voice part), NFR-04.

## Requirements

### Requirement: Feature detection

The system SHALL detect whether the browser supports speech recognition and MUST show the voice control only when it does. When unsupported, the typed SAN input MUST remain fully functional. (FR-10)

#### Scenario: Supported browser

- GIVEN speech recognition is available
- WHEN a drill that accepts moves is shown
- THEN a voice control is offered beside the typed input

#### Scenario: Unsupported browser

- GIVEN speech recognition is unavailable
- WHEN the drill is shown
- THEN no voice control is shown and the typed input works

### Requirement: Speech to SAN

The system SHALL convert a spoken move transcript into SAN for the current position, supporting spoken piece names, squares (including spoken letter and number forms), captures, castling and promotion, and MUST apply the move only when it resolves to exactly one legal move. (FR-10)

#### Scenario: Plain piece move

- GIVEN the starting position
- WHEN the transcript is "knight f3"
- THEN the move Nf3 is applied

#### Scenario: Pawn move

- GIVEN the starting position
- WHEN the transcript is "e four"
- THEN the move e4 is applied

#### Scenario: Castling

- GIVEN castling is legal
- WHEN the transcript is "castle kingside"
- THEN O-O is applied

#### Scenario: Promotion

- GIVEN a legal promotion
- WHEN the transcript is "e eight queen"
- THEN the promotion to a queen is applied

#### Scenario: Ambiguous

- GIVEN two knights can reach the stated square
- WHEN the transcript omits disambiguation
- THEN no move is applied and the user is asked to disambiguate

#### Scenario: Illegal or unrecognised

- GIVEN the transcript resolves to no legal move or is not a move
- WHEN processed
- THEN the position is unchanged and the user is told the move was not understood

### Requirement: Confirmation of recognised move

The system SHOULD show the interpreted SAN before or as it is applied so the user can correct a misrecognition, and MUST NOT crash on empty or error results.

#### Scenario: Show interpretation

- GIVEN a transcript is recognised
- WHEN it is interpreted
- THEN the resulting SAN is displayed as text

#### Scenario: Recognition error or permission denied

- GIVEN microphone permission is denied or recognition errors
- WHEN the user taps the voice control
- THEN an error message is shown and typed input remains available

### Requirement: Voice does not leave the privacy boundary unannounced

The UI SHALL tell the user that voice recognition is provided by their browser before first use. The system MUST NOT store audio or transcripts. (NFR-05)

#### Scenario: First use notice

- GIVEN the user has not used voice before
- WHEN they first activate it
- THEN a notice that the browser handles speech is shown

#### Scenario: Nothing stored

- GIVEN a voice move is made
- WHEN stored data is inspected
- THEN no audio or transcript is persisted
