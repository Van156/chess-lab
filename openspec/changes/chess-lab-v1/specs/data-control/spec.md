# Data Control Specification

## Purpose

Let users export all their personal data and delete their account with all its data, including users without a deliverable email. Traces: FR-19, NFR-05.

## Requirements

### Requirement: Export all personal data

The system SHALL let a signed-in user export all their personal data as PGN (games) and JSON (all other study and account data: mistakes, cards, review logs, and later-phase data such as repertoires, notes and drill sessions as those exist). The export MUST be streamed, MUST NOT include the Lichess token or other users' data, and MUST include every phase's data present for that user. (FR-19, NFR-05)

#### Scenario: Export contents

- GIVEN a user with games, mistakes, cards and review logs
- WHEN they request an export
- THEN they receive PGN of their games and JSON of the other data, each complete

#### Scenario: Token excluded

- GIVEN a Lichess-linked user
- WHEN the export is inspected
- THEN it contains the username but no token

#### Scenario: Large export

- GIVEN a user with a large history
- WHEN the export runs
- THEN data is streamed without loading it all in memory

#### Scenario: Later-phase data

- GIVEN the user also has repertoires, idea notes and drill sessions
- WHEN they export
- THEN those are included in the JSON

#### Scenario: Empty account

- GIVEN a user with no data
- WHEN they export
- THEN valid empty PGN and JSON are produced

#### Scenario: Unauthenticated export

- GIVEN no session
- WHEN the export is requested
- THEN it is rejected

### Requirement: Account deletion without email

The system SHALL let a user delete their account without relying on an emailed link. Deletion MUST require a fresh session (a recent sign-in, otherwise re-authentication through the identity provider) and the user typing their own Lichess username. This MUST work for Lichess-only users. (FR-19)

#### Scenario: Successful deletion

- GIVEN a Lichess-only user with a fresh session
- WHEN they type their exact Lichess username and confirm
- THEN the account is deleted and they are signed out

#### Scenario: Wrong username

- GIVEN a fresh session
- WHEN the typed username does not match
- THEN nothing is deleted and an error is shown

#### Scenario: Stale session

- GIVEN the session is older than the fresh-session window
- WHEN the user starts deletion
- THEN they are asked to re-authenticate first, and deletion only proceeds afterwards

#### Scenario: Case differences

- GIVEN a username differing only in letter case
- WHEN typed
- THEN it is accepted since Lichess usernames are case-insensitive

### Requirement: Deletion removes all user data

Deleting an account MUST remove all data tied to the user (games, analyses, mistakes, repertoires, notes, cards, review logs, drill sessions, stored tokens, sessions) with no orphaned rows. (FR-19, NFR-05)

#### Scenario: Cascade

- GIVEN a user with data in every table
- WHEN the account is deleted
- THEN no row referencing the user remains in any table

#### Scenario: Other users unaffected

- GIVEN two users
- WHEN one is deleted
- THEN the other's data is unchanged

#### Scenario: Re-signup after deletion

- GIVEN a deleted Lichess user
- WHEN they sign in with Lichess again
- THEN a fresh empty account is created

### Requirement: Deletion and export accessible

Export and delete actions SHALL be reachable from account settings, keyboard operable, and work at 375 px. (NFR-03, NFR-04)

#### Scenario: Mobile access

- GIVEN a 375 px viewport
- WHEN the user opens data settings
- THEN export and delete actions are visible and at least 44 px tall
