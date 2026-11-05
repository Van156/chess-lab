# Opening Explorer Specification

## Purpose

Show Lichess opening explorer statistics beside candidate moves for a rating band. Traces: FR-05, NFR-06.

## Requirements

### Requirement: Stats beside candidate moves

For the position being viewed in the repertoire builder, the system SHALL show for each candidate move the number of games and win, draw and loss shares from the Lichess opening explorer. (FR-05)

#### Scenario: Stats shown

- GIVEN a position with explorer data
- WHEN the builder shows it
- THEN each candidate move lists games and W/D/L

#### Scenario: Rare or novel position

- GIVEN a position with no explorer data
- WHEN shown
- THEN an empty state says no games are recorded and the builder remains usable

#### Scenario: Explorer unavailable

- GIVEN the explorer request fails or is rate-limited
- WHEN the builder loads
- THEN the builder works without stats and indicates they are unavailable, without blocking moves

### Requirement: Rating band selection

The rating band used for stats SHALL be derived from a single band-selection rule, defaulting to the user's own rating band, so alternatives (such as one band above) require changing only that rule. The band used MUST be visible in the UI. (FR-05)

#### Scenario: Default band

- GIVEN a user rated within a band B
- WHEN explorer stats are requested
- THEN the request uses band B

#### Scenario: Rule changed

- GIVEN the rule is configured to the next band above
- WHEN stats are requested
- THEN the request uses that band

#### Scenario: Unknown rating

- GIVEN the user has no known rating
- WHEN stats are requested
- THEN a documented fallback band is used and shown

### Requirement: Server-side requests that respect rate limits

Explorer requests SHALL go through the server Lichess client, obey the one-request-at-a-time and 429 backoff rules, and MUST NOT expose any token to the browser. Identical requests SHOULD be cached for a configured duration. (NFR-06, NFR-05)

#### Scenario: Throttled

- GIVEN several rapid position changes
- WHEN stats are requested
- THEN requests are serialized per user and not sent in parallel

#### Scenario: Cache hit

- GIVEN stats for a position and band were fetched within the cache duration
- WHEN requested again
- THEN no new Lichess request is made

### Requirement: Accessible stats

Stats MUST be presented as text or table data readable by assistive technology, not by colour alone. (NFR-04)

#### Scenario: Non-colour information

- GIVEN a W/D/L bar is displayed
- WHEN read by a screen reader
- THEN percentages are available as text
