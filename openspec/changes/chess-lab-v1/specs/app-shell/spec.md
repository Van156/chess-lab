# App Shell Specification

## Purpose

The Midnight-themed application frame: navigation, Today home, per-phase feature flags, and the performance and mobile budgets that apply to every screen. Traces: NFR-02 (Today load), NFR-03, NFR-04, FR-04 (Today surface), proposal cross-cutting items.

## Requirements

### Requirement: Midnight shell and pruned navigation

The system SHALL render authenticated screens inside the Midnight shell (navy and mint palette, left sidebar, 16 px corner radius) and the navigation MUST list only Chess Lab pillars that are enabled (Today, Mistakes, Repertoire, Blindfold, Progress, data and account settings). Template-only entries (admin, audit log, prototype routes) MUST NOT appear in the Chess Lab navigation. (NFR-03, proposal cross-cutting)

#### Scenario: Signed-in user sees pillar navigation

- GIVEN a signed-in user and all phase flags enabled
- WHEN the shell renders
- THEN the sidebar lists Today, Mistakes, Repertoire, Blindfold and Progress
- AND no admin, audit-log or prototype entry is present

#### Scenario: Unauthenticated visit

- GIVEN a visitor without a session
- WHEN they open an authenticated route
- THEN they are directed to sign in and the shell is not shown

### Requirement: Per-phase feature flags

The system SHALL gate each release phase's pillar (repertoire and explorer, blindfold and voice, progress and mistake filters) behind a configuration flag. When a flag is off, the pillar's routes MUST be unreachable and its navigation entry MUST be hidden, without any code revert, and existing user data MUST remain untouched.

#### Scenario: Pillar hidden by flag

- GIVEN the blindfold flag is off
- WHEN the user views the sidebar and requests the blindfold route directly
- THEN no blindfold entry is shown
- AND the direct request is redirected to Today or shown as not available

#### Scenario: Flag turned on later

- GIVEN a pillar flag was off and the user has existing data for other pillars
- WHEN the flag is turned on
- THEN the pillar appears in navigation and previously stored data is unaffected

### Requirement: Today home

The system SHALL provide a Today home that shows the count of due cards from all active pillars, the new-card allowance remaining, and an entry point to start the review session. (FR-04)

#### Scenario: Cards due

- GIVEN the user has due cards
- WHEN they open Today
- THEN the due count and a start-review action are shown

#### Scenario: Nothing due

- GIVEN no cards are due and no new cards are allowed
- WHEN they open Today
- THEN an empty state states that the queue is complete and no start action is offered for review

#### Scenario: No games imported yet

- GIVEN a new user with no imported games
- WHEN they open Today
- THEN an onboarding prompt directs them to import games

### Requirement: Today load performance

The Today screen SHALL load in under 2 seconds on a mid-range phone over 4G. The engine worker and board code MUST be lazy-loaded and MUST NOT be fetched on the Today route's critical path. (NFR-02)

#### Scenario: Cold load budget

- GIVEN a mid-range mobile profile on 4G throttling
- WHEN Today is loaded cold
- THEN content is usable in under 2 seconds as measured by the project's performance check

#### Scenario: Engine not loaded on Today

- GIVEN the user opens Today
- WHEN network requests are inspected
- THEN the Stockfish worker asset is not requested until analysis starts

### Requirement: 375 px layout and touch targets

Every screen in the shell SHALL be fully usable at 375 px viewport width with touch, with no horizontal page scroll, and interactive targets MUST be at least 44 px in both dimensions. (NFR-03)

#### Scenario: Narrow viewport

- GIVEN a 375 px wide viewport
- WHEN any pillar screen is rendered
- THEN there is no horizontal page overflow
- AND the sidebar collapses to a mobile-appropriate navigation

#### Scenario: Tap target size

- GIVEN any interactive control
- WHEN its rendered box is measured
- THEN width and height are each at least 44 px

### Requirement: Shell accessibility

The shell SHALL meet WCAG 2.2 AA: text contrast of at least 4.5:1 against the Midnight palette, a visible focus indicator, and complete keyboard operation of navigation. (NFR-04)

#### Scenario: Keyboard navigation

- GIVEN keyboard-only use
- WHEN the user tabs through the shell
- THEN every navigation entry is reachable and activatable and focus is visible

#### Scenario: Contrast

- GIVEN the Midnight theme tokens
- WHEN text and background token pairs are checked
- THEN each pair used for text has a ratio of at least 4.5:1

### Requirement: Email sign-up UI flag

The system SHALL hide the email/password sign-up UI behind a configuration flag whose default is off, while the email sign-in backend remains intact. The default MUST be changeable without removing code. (Proposal default; open question on email sign-in.)

#### Scenario: Default off

- GIVEN the flag is at its default
- WHEN a visitor opens the sign-in page
- THEN the Sign in with Lichess action is offered and no email sign-up form is shown

#### Scenario: Flag on

- GIVEN the flag is turned on
- WHEN a visitor opens the sign-in page
- THEN the email sign-up form is shown and works with the existing backend
