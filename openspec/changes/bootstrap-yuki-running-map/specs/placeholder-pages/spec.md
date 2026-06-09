## ADDED Requirements

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

### Requirement: Admin login page exposes a working GitHub OAuth button
The system SHALL serve `/admin/login` as a public placeholder whose primary control is a functional "以 GitHub 登入" button wired to Supabase OAuth.

#### Scenario: Unauthenticated visitor sees the sign-in button
- **WHEN** an unauthenticated visitor sends GET `/admin/login`
- **THEN** the response status is 200
- **AND** the page shows a "以 GitHub 登入" button bound to the Supabase GitHub OAuth flow

#### Scenario: Clicking the button starts OAuth and lands on the intended path
- **WHEN** the visitor clicks the sign-in button
- **THEN** the browser is redirected to Supabase's GitHub OAuth start URL
- **AND** after consent, the callback returns to `/admin/upload` (or the path specified by the `from` query parameter)

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Admin upload page is protected by middleware
The system SHALL serve `/admin/upload` only to authorized admins; everyone else is redirected by middleware. The page itself is a placeholder containing an "Upload form coming soon" message and a sign-out button.

#### Scenario: Unauthenticated visitor is redirected
- **WHEN** an unauthenticated visitor sends GET `/admin/upload`
- **THEN** the middleware redirects to `/admin/login?from=%2Fadmin%2Fupload`

#### Scenario: Authorized admin sees the placeholder upload page
- **WHEN** the authorized admin (matching `ADMIN_GITHUB_USERNAME`) sends GET `/admin/upload`
- **THEN** the response status is 200
- **AND** the page shows the "Upload form coming soon" placeholder block
- **AND** the page exposes a working sign-out button

> See: ../../diagrams/01-component-system-architecture.puml
