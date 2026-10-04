# Mistake Filters Specification

## Purpose

Filter the user's mistakes by opening, game phase and time pressure. Traces: FR-15.

## Requirements

### Requirement: Filter by opening

The system SHALL let the user filter the mistake list by opening (ECO code or opening name), and mistakes with no opening data MUST be reachable under an explicit "unknown" choice. (FR-15)

#### Scenario: Filter by opening

- GIVEN mistakes in openings A and B
- WHEN the user filters by A
- THEN only mistakes in A are listed

#### Scenario: Unknown opening

- GIVEN mistakes without ECO data
- WHEN the user filters by unknown
- THEN only those are listed

### Requirement: Filter by game phase

The system SHALL filter by the phase assigned during analysis (opening, middlegame, endgame). (FR-15)

#### Scenario: Phase filter

- GIVEN mistakes in each phase
- WHEN the user selects middlegame
- THEN only middlegame mistakes are listed

### Requirement: Filter by time pressure

A mistake SHALL be counted as under time pressure when its clock left is below 10% of the game's start time; the threshold MUST be a configuration value. Mistakes without clock data MUST NOT be counted as time-pressure and SHALL be excluded from that filter. (FR-15)

#### Scenario: Under threshold

- GIVEN a 600 s game and a mistake with 59 s left
- WHEN filtering by time pressure
- THEN the mistake is included

#### Scenario: At or above threshold

- GIVEN a 600 s game and a mistake with 60 s left
- WHEN filtering by time pressure
- THEN it is not included

#### Scenario: No clock data

- GIVEN a mistake without clock data
- WHEN filtering by time pressure
- THEN it is excluded and does not cause an error

#### Scenario: Increment games

- GIVEN a game with an increment
- WHEN time pressure is evaluated
- THEN the start time used is the base clock time as documented, consistently

### Requirement: Combined filters and state

Filters SHALL combine with AND semantics, show the result count, be clearable in one action, and show an empty state when nothing matches.

#### Scenario: Combined

- GIVEN opening A and phase endgame are selected
- WHEN the list is shown
- THEN only mistakes matching both are listed with the count

#### Scenario: No match

- GIVEN a combination with no results
- WHEN applied
- THEN an empty state with a clear-filters action is shown

#### Scenario: Clear

- GIVEN active filters
- WHEN the user clears them
- THEN all mistakes are listed

### Requirement: Usable on mobile and by keyboard

Filter controls SHALL work at 375 px with 44 px targets and be keyboard operable. (NFR-03, NFR-04)

#### Scenario: Narrow viewport

- GIVEN 375 px
- WHEN filters are used
- THEN no horizontal scroll occurs and controls meet the target size
