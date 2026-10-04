# Engine Runtime Specification

## Purpose

In-browser Stockfish analysis delivered as a separate worker, with a job queue, shallow-then-deep passes, persisted per-move evaluations and licence offering. Traces: FR-13 (engine part), FR-11 (engine for blindfold), NFR-01, NFR-02, NFR-08.

## Requirements

### Requirement: Analysis runs in the browser

All engine analysis SHALL run in the user's browser; the server MUST NOT run the engine, and server cost MUST NOT scale with analysis volume. The server only receives resulting evaluations. (NFR-01)

#### Scenario: No server-side engine

- GIVEN a game is analysed
- WHEN server activity is inspected
- THEN the only server calls are to store evaluations and no engine process is run on the server

### Requirement: Separate, unmodified, lazy-loaded worker

The engine SHALL be a single-thread build served as its own static worker file, unmodified, and MUST NOT be bundled into the app bundle. It MUST be loaded only when an analysis or engine drill is first requested. (NFR-08, NFR-02)

#### Scenario: Not in app bundle

- GIVEN a production build
- WHEN the app bundle contents are scanned
- THEN no engine code is present in app chunks and the worker exists as a separate file

#### Scenario: Lazy load

- GIVEN the user has not requested analysis
- WHEN pages load
- THEN the worker file is not requested

#### Scenario: No cross-origin isolation required

- GIVEN a standard deployment without cross-origin isolation headers
- WHEN analysis runs
- THEN it works using the single-thread build

### Requirement: Typed analysis API and job queue

The system SHALL expose a typed analyse operation that accepts a position and depth or time budget and returns evaluation and best move, and MUST process submitted jobs one at a time in submission order, allowing a job to be cancelled.

#### Scenario: Sequential jobs

- GIVEN three jobs submitted back to back
- WHEN they run
- THEN they complete one at a time in order, each with its own result

#### Scenario: Cancellation

- GIVEN a running job
- WHEN it is cancelled
- THEN the engine stops it and the next queued job starts

#### Scenario: Worker failure

- GIVEN the worker crashes or fails to load
- WHEN a job is pending
- THEN the job fails with a clear error, no partial data is stored as final, and the rest of the app keeps working

### Requirement: Shallow-then-deep analysis

For each game the system SHALL first analyse at a shallow depth to produce early results, then deepen in the background. Shallow results MUST be usable by the mistake pipeline before deep analysis completes, and deeper results MUST replace shallower ones for the same position.

#### Scenario: Early results

- GIVEN a game queued for analysis
- WHEN the shallow pass completes
- THEN per-move evaluations are available and the game is marked analysed at shallow depth

#### Scenario: Deepening

- GIVEN a game analysed at shallow depth
- WHEN the deep pass completes
- THEN stored evaluations are updated with the deeper depth recorded

### Requirement: Persisted evaluations enable resume

Per-move evaluations SHALL be persisted as they are computed, with the engine depth and analysis time, so analysis resumes across page reloads and sessions without recomputing completed moves. (NFR-01, risk mitigation)

#### Scenario: Resume after reload

- GIVEN a game with 20 of 60 moves evaluated and the tab is closed
- WHEN analysis resumes in a new session
- THEN only the remaining moves are analysed

#### Scenario: Already analysed

- GIVEN a game fully analysed at the target depth
- WHEN analysis is requested again
- THEN no engine work is performed

### Requirement: Licence and source offered

The app SHALL provide a page or link, reachable from the UI, that presents the engine's licence and a link to its source, and states that the engine runs as a separate unmodified file. (NFR-08)

#### Scenario: Licence reachable

- GIVEN any signed-in user
- WHEN they follow the licence link in the app
- THEN the engine licence text and a source link are shown

### Requirement: Permissive-only app bundle

The app bundle MUST contain only MIT, BSD or Apache licensed dependencies; the GPL engine MUST appear only as the separate worker asset. (NFR-08)

#### Scenario: Licence audit

- GIVEN the production dependency list of the bundle
- WHEN licences are audited
- THEN no GPL-licensed code is present in bundled chunks

### Requirement: Engine strength control

The engine runtime SHALL support playing a move at a caller-chosen strength so the blindfold engine drill can offer levels. (FR-11)

#### Scenario: Weaker strength

- GIVEN a position and a lower strength setting
- WHEN the engine is asked for a move
- THEN it returns a legal move at that configured strength
