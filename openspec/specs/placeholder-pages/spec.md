# placeholder-pages Specification

## Purpose
TBD - created by archiving change bootstrap-yuki-running-map. Update Purpose after archive.
## Requirements
### Requirement: Home page placeholder renders the brand identity
The system SHALL serve `/` as a placeholder home page containing the brand title and a CTA to the routes listing. When the URL carries the query parameter `?auth_error=not_admin`, the page SHALL render a one-shot sonner toast with the text "您不是 admin，已登出" and clear the query parameter via client-side `router.replace('/')`.

#### Scenario: Visitor lands on home
- **WHEN** a visitor sends GET `/`
- **THEN** the response status is 200
- **AND** the rendered HTML contains the text "Yuki's Running Map" in an `<h1>`
- **AND** contains a CTA element whose href is `/routes`

#### Scenario: Visitor lands on home with auth_error flash
- **WHEN** a visitor navigates to `/?auth_error=not_admin`
- **THEN** the response status is 200
- **AND** the page mounts a sonner toast whose body equals "您不是 admin，已登出"
- **AND** the client calls `router.replace('/')` so subsequent navigations do not re-trigger the toast

#### Scenario: Visitor lands on home without flash
- **WHEN** a visitor navigates to `/` without query parameters
- **THEN** the page does not mount the auth_error toast

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

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

### Requirement: /admin/login authenticates admin via GitHub OAuth
The system SHALL serve `/admin/login` as a public route (bypassed by the admin middleware) that presents a single "以 GitHub 登入" button. Clicking the button SHALL trigger `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: '<origin>/admin/upload' } })`. The admin layout SHALL NOT render the admin top-nav on `/admin/login`.

#### Scenario: Visitor opens login page
- **WHEN** a visitor sends GET `/admin/login`
- **THEN** the response status is 200
- **AND** the page renders a Card containing a "以 GitHub 登入" button
- **AND** the admin top-nav element is absent from the rendered DOM

#### Scenario: Clicking the button starts OAuth flow
- **WHEN** a visitor clicks the "以 GitHub 登入" button
- **THEN** the browser navigates to a Supabase OAuth authorize URL whose `redirect_to` query carries `<origin>/admin/upload`

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

### Requirement: /admin/upload shows the Coming soon placeholder for authenticated admin
The system SHALL serve `/admin/upload` as a protected route. For an authenticated admin (validated by middleware), the page SHALL render the "Coming soon · GPX 上傳開發中" message and a Sign out button that calls `supabase.auth.signOut()` then navigates to `/`. For any unauthenticated or non-admin client, the middleware contract handles the redirect (defined in the data-and-auth-infrastructure spec).

#### Scenario: Authenticated admin sees the placeholder
- **WHEN** an authenticated admin sends GET `/admin/upload`
- **THEN** the response status is 200
- **AND** the rendered page contains the text "Coming soon · GPX 上傳開發中"
- **AND** the page contains a Sign out button

#### Scenario: Sign out clears the session
- **WHEN** the authenticated admin clicks the Sign out button
- **THEN** `supabase.auth.signOut()` is called
- **AND** the client navigates to `/`
- **AND** subsequent GET `/admin/upload` is redirected to `/admin/login`

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

