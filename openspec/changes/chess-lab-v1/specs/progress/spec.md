# Progress Specification

## Purpose

A dashboard that reports streak, accuracy per pillar, repeat-mistake trend, weakest openings, blindfold best depth and a review heatmap from stored data. Traces: FR-18, success metrics, NFR-03, NFR-04.

## Requirements

### Requirement: Review streak

The dashboard SHALL show the current streak as the number of consecutive days, ending today or yesterday, on which the user completed at least one review, using the user's local day boundary. (FR-18)

#### Scenario: Active streak

- GIVEN reviews on each of the last 5 days including today
- WHEN the dashboard loads
- THEN the streak is 5

#### Scenario: Not yet reviewed today

- GIVEN reviews on the previous 3 days and none today
- WHEN the dashboard loads
- THEN the streak is 3 and is shown as still extendable today

#### Scenario: Broken streak

- GIVEN no review yesterday or today
- WHEN the dashboard loads
- THEN the streak is 0

### Requirement: Accuracy per pillar

The dashboard SHALL show review accuracy for each pillar (mistakes, repertoire, blindfold) as the share of reviews graded Good or Easy within a selectable period. Pillars with no reviews MUST show no-data rather than 0%. (FR-18)

#### Scenario: Computed accuracy

- GIVEN 10 mistake-card reviews of which 8 are Good or Easy
- WHEN the dashboard loads
- THEN mistakes accuracy is 80%

#### Scenario: No data pillar

- GIVEN no repertoire reviews
- WHEN the dashboard loads
- THEN repertoire shows no data

#### Scenario: Disabled pillar

- GIVEN a pillar's flag is off
- WHEN the dashboard loads
- THEN that pillar is not shown

### Requirement: Repeat-mistake rate trend

The dashboard SHALL show the repeat-mistake rate over time: the share of new mistakes in each period that match a previously carded mistake (same normalized position or same opening move). (FR-18)

#### Scenario: Rate computed

- GIVEN 10 new mistakes in a week, 3 matching earlier carded mistakes
- WHEN the trend is computed
- THEN that week shows 30%

#### Scenario: Insufficient data

- GIVEN fewer than the configured minimum mistakes in a period
- WHEN shown
- THEN the period shows insufficient data instead of a misleading rate

### Requirement: Weakest openings

The dashboard SHALL list the openings that account for the most mistakes or highest loss, ranked by a documented rule, with mistake counts and linking to the mistakes filtered by that opening. (FR-18)

#### Scenario: Ranked list

- GIVEN mistakes distributed across openings
- WHEN the dashboard loads
- THEN openings are listed from weakest to least weak with counts

#### Scenario: Link to filter

- GIVEN a listed opening
- WHEN the user selects it
- THEN the mistakes list is shown filtered by that opening (when mistake filters are enabled)

#### Scenario: No openings data

- GIVEN no mistakes
- WHEN the dashboard loads
- THEN an empty state is shown

### Requirement: Blindfold best depth

The dashboard SHALL show the user's best blindfold depth, the maximum number of moves followed before the first peek across their drill sessions, and its trend by month. (FR-18)

#### Scenario: Best depth

- GIVEN sessions with depths 4, 9 and 6
- WHEN the dashboard loads
- THEN best depth is 9

#### Scenario: No sessions

- GIVEN no blindfold sessions
- WHEN the dashboard loads
- THEN no-data is shown

### Requirement: Review heatmap

The dashboard SHALL show a calendar heatmap of review counts per day over a recent period, with exact counts available as text for assistive technology. (FR-18, NFR-04)

#### Scenario: Counts per day

- GIVEN 12 reviews on one day
- WHEN the heatmap renders
- THEN that day shows an intensity corresponding to 12 and its count is available as text

#### Scenario: Day boundary

- GIVEN a review at 23:30 local time
- WHEN counted
- THEN it belongs to that local day

### Requirement: Data from the user only, usable on mobile

Progress data MUST be computed from the signed-in user's own records, and the dashboard SHALL work at 375 px with keyboard access and non-colour-only information. (NFR-03, NFR-04)

#### Scenario: Isolation

- GIVEN two users with different data
- WHEN each opens the dashboard
- THEN each sees only their own figures

#### Scenario: Narrow viewport

- GIVEN 375 px
- WHEN the dashboard renders
- THEN no horizontal page scroll occurs
