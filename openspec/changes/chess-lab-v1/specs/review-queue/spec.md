# Review Queue Specification

## Purpose

One card store with a single source per card, FSRS scheduling, a daily queue and a review session, with grades that survive unreliable connections. Traces: FR-04, FR-17, NFR-02, NFR-07, supports FR-14, FR-06 and drill cards.

## Requirements

### Requirement: Single card with exactly one source

Every card SHALL reference exactly one source (a mistake, a repertoire node or a drill) and the system MUST reject a card with zero or more than one source. (PRD data model, FR-04)

#### Scenario: Valid sources

- GIVEN a card for a mistake, one for a repertoire node, one for a drill
- WHEN they are stored
- THEN each is accepted with its single source

#### Scenario: Invalid source count

- GIVEN a card with no source or two sources
- WHEN storing is attempted
- THEN it is rejected

#### Scenario: Source deleted

- GIVEN a card whose source is deleted
- WHEN deletion occurs
- THEN the card is deleted with it or never orphaned

### Requirement: FSRS scheduling

The system SHALL schedule cards with FSRS, storing due date, stability, difficulty, repetitions and lapses, and MUST update that state from the grade (Again, Hard, Good, Easy) on every review. (FR-04, FR-17)

#### Scenario: Good grade

- GIVEN a new card
- WHEN graded Good
- THEN the card is due in the future, reps is 1 and state fields are updated

#### Scenario: Again on a reviewed card

- GIVEN a card in review state
- WHEN graded Again
- THEN lapses increases and the card is due sooner than before

#### Scenario: Review log

- GIVEN any grading
- WHEN it is saved
- THEN a log is stored with grade, review time, elapsed time and the state before

### Requirement: Daily queue from all pillars

The daily queue SHALL contain all due cards from every enabled pillar, ordered by a deterministic rule, plus new cards limited by the user's daily new-card limit (a user setting with a configured default). New cards beyond the limit MUST NOT appear that day. (FR-04)

#### Scenario: Mixed pillars

- GIVEN due cards from mistakes, repertoire and drills
- WHEN the queue is built
- THEN all appear in one queue

#### Scenario: New-card limit

- GIVEN a limit L and more than L new cards
- WHEN the queue is built
- THEN exactly L new cards are included
- AND already-introduced cards that are due are not capped by L

#### Scenario: Limit consumed across the day

- GIVEN L new cards were already introduced today
- WHEN the queue is rebuilt the same day
- THEN no further new cards are offered

#### Scenario: Limit changed

- GIVEN the user changes the limit
- WHEN the queue is rebuilt
- THEN the new limit applies

#### Scenario: Disabled pillar

- GIVEN a pillar flag is off
- WHEN the queue is built
- THEN that pillar's cards are excluded

### Requirement: Review session flow

A review session SHALL show a board prompt for the card, accept a move through board or typed SAN input, and offer Show answer, then grading with Again, Hard, Good or Easy that updates the card and advances to the next card. (FR-17)

#### Scenario: Complete a card

- GIVEN a due card
- WHEN the user enters a move, reveals the answer and grades Good
- THEN the card state is updated and the next card is shown

#### Scenario: Show answer without moving

- GIVEN a due card
- WHEN the user chooses Show answer before moving
- THEN the answer is revealed and grading is allowed

#### Scenario: Queue exhausted

- GIVEN the last card is graded
- WHEN the session advances
- THEN a completion state is shown

#### Scenario: Keyboard grading

- GIVEN keyboard-only use
- WHEN the user reveals the answer
- THEN all four grades are reachable and activatable by keyboard

### Requirement: Next card under 200 ms

After grading, the next card SHALL be displayed in under 200 ms. The queue MUST be prefetched so display does not wait on the network. (NFR-02)

#### Scenario: Immediate transition

- GIVEN a prefetched queue and a slow network
- WHEN the user grades a card
- THEN the next card is shown in under 200 ms

### Requirement: Grades never lost

Each grade SHALL be written to a durable client outbox before the network call and submitted with a client-generated review id; the server MUST apply a given review id at most once. Unsent grades MUST be retried until acknowledged, including after reload. (NFR-07)

#### Scenario: Offline grading

- GIVEN the connection drops during a session
- WHEN the user grades cards
- THEN grades are retained locally and the session continues

#### Scenario: Retry after reconnect

- GIVEN queued grades and the connection returns
- WHEN the outbox flushes
- THEN each grade is applied and removed from the outbox

#### Scenario: Idempotent resubmit

- GIVEN a grade was applied but the acknowledgement was lost
- WHEN the client resubmits the same review id
- THEN the card state and log are not changed a second time

#### Scenario: Reload with pending grades

- GIVEN pending grades and the tab is reloaded
- WHEN the app starts
- THEN pending grades are submitted

### Requirement: Cards only for the owning user

The queue and grading operations MUST operate only on the signed-in user's cards.

#### Scenario: Foreign card grading

- GIVEN a grade for a card owned by another user
- WHEN submitted
- THEN it is rejected
