## ADDED Requirements

### Requirement: CLAUDE.md is the Claude Code entry point
The system SHALL include a top-level `CLAUDE.md` that names the project, prominently instructs readers to read `AGENTS.md` before editing, lists the standard commands (`dev`, `test`, `lint`, `db migrate`, `pmtiles update`), enumerates "do-not" rules, and links to `AGENTS.md`, `openspec/project.md`, and `docs/architecture.md`.

#### Scenario: Required sections are present
- **WHEN** a reader opens `CLAUDE.md`
- **THEN** the file contains a one-line project description, a prominent "Read AGENTS.md before editing" notice, a "Common commands" list, a "Do not" list, and links to the four documents named above

### Requirement: AGENTS.md captures development conventions
The system SHALL include `AGENTS.md` covering: language policy (conversation 繁中, code/identifier/commit/spec keyword English), tech-stack one-liner (pointing at `docs/architecture.md`), TypeScript strict / no-`any` rules, naming conventions, folder boundaries (`features/*` no cross-import, shared via `lib/*`), testing policy (Vitest for `lib`, Playwright for the four user flows), Conventional Commits, the PR↔change correspondence rule, and the secrets policy with required env vars enumerated.

#### Scenario: Conventions are documented
- **WHEN** a reader opens `AGENTS.md`
- **THEN** every section above is present and self-contained
- **AND** the env-var list matches `.env.example`

### Requirement: openspec/project.md is the north-star document
The system SHALL include `openspec/project.md` stating the project purpose, stakeholders, long-term goals, and explicit non-goals.

#### Scenario: North star is published
- **WHEN** a reader opens `openspec/project.md`
- **THEN** the file declares "個人跑步路線分享網站" purpose, names Yuki as owner/admin and 訪客 as read-only audience, lists long-term goals, and explicit non-goals (no comments, no membership, no payment)

### Requirement: docs/architecture.md and docs/data-model.md are written
The system SHALL include `docs/architecture.md` mirroring `design.md` §3 (with the ASCII or Mermaid architecture diagram and Edge-vs-Node boundary notes) and `docs/data-model.md` mirroring `design.md` §4 (with the `routes` schema, per-index purpose, "why both `geojson` and `gpx_path`" note, the bbox SQL example, and an RLS policy summary).

#### Scenario: Architecture doc is reachable
- **WHEN** a developer opens `docs/architecture.md`
- **THEN** the file shows the architecture diagram and explains the runtime split

#### Scenario: Data-model doc is reachable
- **WHEN** a developer opens `docs/data-model.md`
- **THEN** the file shows the full `routes` schema, every index purpose, the "why both `geojson` and `gpx_path`" justification, and an example bbox SELECT query

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Runbooks cover local dev, deploy, and PMTiles updates
The system SHALL include `docs/runbooks/local-dev.md`, `docs/runbooks/deploy.md`, and `docs/runbooks/pmtiles-update.md` complete enough for a new contributor to reproduce each operation.

#### Scenario: New contributor follows local-dev runbook
- **WHEN** a new contributor follows `docs/runbooks/local-dev.md` start to finish
- **THEN** they can clone the repo, set env vars, run `pnpm db:migrate`, and reach `pnpm dev` successfully

#### Scenario: Deploy runbook covers external setup
- **WHEN** an operator opens `docs/runbooks/deploy.md`
- **THEN** the runbook documents Vercel project linking, env-vars configuration, the Supabase OAuth callback URL, the PMTiles bucket location, and a first-time deploy checklist

#### Scenario: PMTiles runbook covers bundle scope and refresh
- **WHEN** an operator opens `docs/runbooks/pmtiles-update.md`
- **THEN** the runbook explains the bundle scope (Taiwan + frequent countries), the `pmtiles extract` command, the Storage path convention, and how to roll the `NEXT_PUBLIC_PMTILES_URL`

### Requirement: README.md serves the public GitHub face
The system SHALL include a `README.md` with a one-paragraph project intro, a live URL placeholder, tech-stack badges, a quickstart pointer to `docs/runbooks/local-dev.md`, and authorship — without duplicating `CLAUDE.md` or `AGENTS.md` content.

#### Scenario: README is self-contained for visitors
- **WHEN** a visitor opens the repo on GitHub
- **THEN** the rendered README explains what the project is, links to the live URL slot, lists the tech stack, and points contributors to `docs/runbooks/local-dev.md`

### Requirement: GitHub Actions runs lint, typecheck, and test on every PR
The system SHALL include a GitHub Actions workflow that runs `lint`, `typecheck`, and `test` jobs in parallel for every pull request opened against `main`.

#### Scenario: All three jobs run on PR
- **WHEN** a pull request is opened
- **THEN** GitHub Actions runs `lint`, `typecheck`, and `test` jobs concurrently
- **AND** any non-zero exit marks the PR with a red X
- **AND** the workflow file is committed under `.github/workflows/`

