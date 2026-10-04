# Game Import Specification

## Purpose

Import the user's Lichess games, first for a configured window and then incrementally, respecting rate limits and surviving failure. Traces: FR-12, NFR-06, NFR-07.

## Requirements

### Requirement: First import over a configured window

The system SHALL perform a first import covering the games played within the configured import window (config value IMPORT_WINDOW_MONTHS, whose default is 3 months). Changing the configured value MUST change the window without code changes. (FR-12)

#### Scenario: Games inside window imported

- GIVEN the configured window is N months and the user has games inside and outside it
- WHEN the first import runs
- THEN games within the last N months are stored and older games are not

#### Scenario: Window reconfigured

- GIVEN the configured window value is changed to cover the whole history
- WHEN a new user runs the first import
- THEN their entire history is eligible for import

#### Scenario: User with no games

- GIVEN a Lichess account with no games in the window
- WHEN the first import runs
- THEN it completes with zero games and the user sees that nothing was found

### Requirement: Incremental sync

After the first import, each sync SHALL import only games newer than the last successful sync cursor and MUST update the cursor and last sync time on success. (FR-12)

#### Scenario: Only new games

- GIVEN a completed import and two new games on Lichess
- WHEN a sync runs
- THEN exactly the two new games are added

#### Scenario: Nothing new

- GIVEN no new games
- WHEN a sync runs
- THEN no rows are added and last sync time is updated

### Requirement: Streamed import

The import SHALL consume the Lichess game export as a stream and process games as they arrive, without buffering the full export in memory. (NFR-06)

#### Scenario: Large history

- GIVEN an export response delivered in many chunks
- WHEN the import runs
- THEN games are persisted progressively before the stream ends

#### Scenario: Chunk boundary inside a record

- GIVEN a stream chunk that ends in the middle of a game record
- WHEN the next chunk arrives
- THEN the record is parsed correctly as one game

### Requirement: Rate-limit compliance

The system SHALL issue at most one Lichess request at a time per user, and on HTTP 429 MUST stop requests for that user, wait with backoff before retrying, and MUST NOT fail the import solely because of 429. (NFR-06)

#### Scenario: Single flight

- GIVEN a user has an import running
- WHEN a second import or Lichess request is triggered for the same user
- THEN it waits for or joins the running request and never runs concurrently

#### Scenario: Backoff on 429

- GIVEN Lichess responds 429
- WHEN the client handles it
- THEN no further request is sent until the backoff delay elapses
- AND the import resumes afterwards

#### Scenario: Persistent 429

- GIVEN 429 persists beyond the configured retry limit
- WHEN retries are exhausted
- THEN the import is marked paused or failed with a retryable status and no data is lost

### Requirement: Idempotent and resumable import

Games MUST be unique per user and Lichess game id. An interrupted import SHALL be resumable and re-running it MUST NOT create duplicate games. (NFR-07)

#### Scenario: Resume after interruption

- GIVEN an import interrupted after some games were stored
- WHEN it is restarted
- THEN the remaining games are imported and the total has no duplicates

#### Scenario: Duplicate delivery

- GIVEN the same game id appears twice (overlapping windows or retry)
- WHEN both are processed
- THEN one row exists

#### Scenario: Concurrent triggers

- GIVEN two sync triggers for one user at the same time
- WHEN both complete
- THEN no duplicate games exist

### Requirement: Import progress and failure visibility

The system SHALL show the user import status (running, paused, failed, complete) and the number of games imported, and MUST surface an actionable message on failure.

#### Scenario: Running status

- GIVEN an import in progress
- WHEN the user views the games page
- THEN status running and the count so far are shown

#### Scenario: Expired or revoked token

- GIVEN the Lichess token is no longer accepted
- WHEN a sync runs
- THEN the user is told to sign in with Lichess again and no games are lost
