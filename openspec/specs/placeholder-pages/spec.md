# placeholder-pages Specification

## Purpose
TBD - created by archiving change bootstrap-yuki-running-map. Update Purpose after archive.
## Requirements
### Requirement: Home page placeholder renders the brand identity
The system SHALL serve `/` as a placeholder home page containing the brand title and a CTA to the routes listing.

#### Scenario: Visitor lands on home
- **WHEN** a visitor sends GET `/`
- **THEN** the response status is 200
- **AND** the rendered HTML contains the text "Yuki's Running Map" in an `<h1>`
- **AND** contains a CTA element whose href is `/routes`

### Requirement: Routes listing placeholder ships the filter shell
The system SHALL serve `/routes` as a placeholder route listing showing a left filter column placeholder, a sort/toolbar area, and an empty-state copy — without performing any database query.

#### Scenario: Visitor opens routes list
- **WHEN** a visitor sends GET `/routes`
- **THEN** the response status is 200
- **AND** the page contains a left-column filter placeholder (region filter visible)
- **AND** the page contains an empty-state message such as "目前無路線"
- **AND** no SQL query is issued against the `routes` table (verified via Supabase logs or absence of network call)

### Requirement: Route detail placeholder renders for any slug
The system SHALL serve `/routes/[slug]` as a placeholder route detail page that returns HTTP 200 for any slug — real not-found logic is deferred to the follow-up route-detail change.

#### Scenario: Known slug returns placeholder
- **WHEN** a visitor sends GET `/routes/example-route`
- **THEN** the response status is 200
- **AND** the page shows a "Coming soon" placeholder block

#### Scenario: Unknown slug also returns placeholder
- **WHEN** a visitor sends GET `/routes/totally-made-up-slug`
- **THEN** the response status is 200
- **AND** the page shows the same "Coming soon" placeholder

