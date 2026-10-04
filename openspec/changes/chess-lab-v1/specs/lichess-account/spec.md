# Lichess Account Specification

## Purpose

Sign in with Lichess as the primary identity, with secure token handling. Traces: FR-01, NFR-05.

## Requirements

### Requirement: Sign in with Lichess using PKCE

The system SHALL let a visitor sign in or sign up through Lichess OAuth 2.0 using PKCE (S256) as a public client with no client secret. The requested scope set MUST be configuration-driven; the default is no scopes, and the email scope MUST NOT be requested by default. (FR-01)

#### Scenario: First sign-in creates an account

- GIVEN a visitor with no Chess Lab account and a valid Lichess identity
- WHEN they complete the Lichess authorization
- THEN an account and session are created and they land in the app

#### Scenario: Authorization denied

- GIVEN the visitor denies access at Lichess
- WHEN they return to the app
- THEN no account or session is created and the sign-in page shows a clear failure message

#### Scenario: PKCE enforced

- GIVEN the authorization request is built
- WHEN its parameters are inspected
- THEN a PKCE S256 challenge is present and no client secret is sent

### Requirement: Immutable Lichess identity as account subject

The account subject MUST be the immutable Lichess user id, not the username. The Lichess username MUST be refreshed on every sign-in so renamed users keep their account and games. (FR-01)

#### Scenario: Returning user

- GIVEN a user previously signed in with Lichess id X
- WHEN they sign in again
- THEN they resume the same account and no second account is created

#### Scenario: Renamed Lichess user

- GIVEN the Lichess username for id X changed since the last sign-in
- WHEN they sign in
- THEN the stored username is updated and the account and its games are retained

### Requirement: Synthetic non-deliverable email

Accounts created through Lichess SHALL receive a unique synthetic non-deliverable email derived from the Lichess id, marked verified, and the system MUST NOT attempt to send mail to it. The user's real email MUST NOT be requested or stored by default. (NFR-05)

#### Scenario: Synthetic email assigned

- GIVEN a new Lichess sign-in
- WHEN the account is created
- THEN the email is unique per Lichess id, non-deliverable, and marked verified

#### Scenario: No collision

- GIVEN two different Lichess users
- WHEN both sign up
- THEN their synthetic emails differ and neither sign-up fails on uniqueness

#### Scenario: Email-dependent account UI

- GIVEN a Lichess-only user
- WHEN they open account settings
- THEN email-dependent actions (change email, set password) are hidden or explained as unavailable

### Requirement: Token encrypted at rest and never sent to the browser

The Lichess access token MUST be stored encrypted at rest and MUST NOT appear in any response, payload or storage visible to the browser. The system SHOULD store only the Lichess username, games and study data about the user. (NFR-05)

#### Scenario: Stored encrypted

- GIVEN a user signed in with Lichess
- WHEN the stored account row is read directly from the database
- THEN the token value is not readable plaintext

#### Scenario: Not exposed to client

- GIVEN a signed-in session
- WHEN every API response and the session payload are inspected
- THEN none contain the Lichess token

#### Scenario: Existing plaintext tokens

- GIVEN accounts from other providers hold plaintext tokens before encryption is enabled
- WHEN encryption is enabled
- THEN those tokens are migrated or invalidated so that sign-in for those users still works

### Requirement: Account linking to games

The Lichess username SHALL link the account to its imported games; the system MUST expose the linked username and last sync time to the owner. (FR-01)

#### Scenario: Linked username visible

- GIVEN a signed-in Lichess user
- WHEN they open account or import settings
- THEN their Lichess username and last sync time are shown
