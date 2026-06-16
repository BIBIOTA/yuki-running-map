## ADDED Requirements

### Requirement: Vercel Preview Deployment is configured for every PR
The system SHALL be linked to a Vercel project with `pnpm build` as the build command, `pnpm install` as the install command, and all five production env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_GITHUB_USERNAME`, `NEXT_PUBLIC_PMTILES_URL`) populated in Project Settings → Environment Variables. The Vercel GitHub integration SHALL auto-deploy a Preview build for every pull request and Production for every merge to `main`.

#### Scenario: Vercel project mirrors the GitHub repo
- **WHEN** an operator opens Vercel Dashboard → Project Settings → Git
- **THEN** the connected repository equals the GitHub repo for Yuki's Running Map
- **AND** the production branch equals `main`

#### Scenario: All five env vars are populated
- **WHEN** an operator opens Vercel Dashboard → Project Settings → Environment Variables
- **THEN** the five env vars listed above are present in Production and Preview scopes

#### Scenario: Opening a PR creates a Preview deployment
- **WHEN** a contributor opens a pull request against `main`
- **THEN** Vercel posts a comment on the PR containing a working Preview URL within five minutes

### Requirement: Playwright E2E suite covers five critical routes
The system SHALL include a Playwright test suite under `e2e/` running against a `pnpm start` production server, covering five spec files: `visitor-home.spec.ts` (`/`), `visitor-list.spec.ts` (`/routes`), `visitor-detail.spec.ts` (`/routes/example-route` and `/routes/totally-fake-slug`), `admin-unauthenticated.spec.ts` (`/admin/upload` without session), and `admin-login-flow.spec.ts` (admin session via OAuth-mock fixture reaches `/admin/upload`). The admin session SHALL be obtained without contacting github.com by signing a JWT in `e2e/fixtures/admin-session.ts` using `SUPABASE_JWT_SECRET` and `jose`.

#### Scenario: Five spec files exist
- **WHEN** a reviewer lists `e2e/specs/*.spec.ts`
- **THEN** the file names include `visitor-home`, `visitor-list`, `visitor-detail`, `admin-unauthenticated`, and `admin-login-flow`

#### Scenario: pnpm test:e2e passes locally
- **WHEN** an operator runs `pnpm build && pnpm test:e2e` on a configured local environment
- **THEN** all five specs pass without contacting github.com

#### Scenario: Admin session fixture signs a JWT
- **WHEN** the `admin-session.ts` fixture initializes
- **THEN** it imports `SignJWT` from `jose`
- **AND** signs a token whose `user_metadata.user_name` equals the `ADMIN_GITHUB_USERNAME` env var
- **AND** uses `SUPABASE_JWT_SECRET` as the HS256 key

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml

## MODIFIED Requirements

### Requirement: GitHub Actions runs lint, typecheck, test, and e2e on every PR
The system SHALL include a GitHub Actions workflow that runs `lint`, `typecheck`, and `test` jobs in parallel for every pull request opened against `main`, and an `e2e` job that runs after the three parallel jobs succeed. The `e2e` job SHALL skip Fork PRs via `if: github.event.pull_request.head.repo.full_name == github.repository` to avoid exposing secrets.

#### Scenario: All four jobs run on internal PR
- **WHEN** a pull request from the same repository is opened
- **THEN** GitHub Actions runs `lint`, `typecheck`, and `test` jobs concurrently
- **AND** the `e2e` job runs after the three jobs succeed
- **AND** any non-zero exit marks the PR with a red X
- **AND** the workflow file is committed under `.github/workflows/`

#### Scenario: Fork PR skips e2e
- **WHEN** a pull request from a fork is opened
- **THEN** the `lint`, `typecheck`, and `test` jobs run
- **AND** the `e2e` job is skipped due to the `if:` guard
- **AND** no Supabase secrets are exposed to the fork

#### Scenario: e2e job env contains six secrets
- **WHEN** a reviewer inspects the `e2e` job definition in `.github/workflows/ci.yml`
- **THEN** the `env:` block lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ADMIN_GITHUB_USERNAME`, and `NEXT_PUBLIC_PMTILES_URL`

> See: ../../diagrams/01-sequence-admin-oauth-flow.puml
