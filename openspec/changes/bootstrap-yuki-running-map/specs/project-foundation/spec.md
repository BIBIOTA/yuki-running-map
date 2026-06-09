## ADDED Requirements

### Requirement: Next.js 15 App Router scaffold with TypeScript strict mode
The system SHALL ship a Next.js 15 App Router project written in TypeScript with strict mode enabled and pnpm as the locked package manager.

#### Scenario: Local dev server boots
- **WHEN** a developer runs `pnpm install && pnpm dev` from repo root
- **THEN** the dev server starts on http://localhost:3000
- **AND** GET `/` returns HTTP 200

#### Scenario: Strict TypeScript flags are enforced
- **WHEN** a file is added that uses `any` or unchecked indexed access
- **THEN** `pnpm typecheck` exits non-zero
- **AND** the failure cites the file and line

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Lint, format, and import order are automated
The system SHALL enforce code style via ESLint flat config + Prettier with the Tailwind plugin and a deterministic import-order rule.

#### Scenario: Clean scaffold passes lint
- **WHEN** a developer runs `pnpm lint` and `pnpm format:check` on a freshly scaffolded codebase
- **THEN** both commands exit 0 with zero reported issues

#### Scenario: Out-of-order imports are rejected
- **WHEN** a TypeScript file is committed with imports in non-canonical order
- **THEN** `pnpm lint` exits non-zero and identifies the offending file

### Requirement: Tailwind CSS v4 design tokens reflect V2 Trail Vintage
The system SHALL load `app/globals.css` with a Tailwind v4 `@theme` block whose color, typography, spacing, radius, shadow, and motion tokens carry the V2 Trail Vintage values from `design.md` §6.

#### Scenario: Color tokens resolve to V2 Trail Vintage values
- **WHEN** a Server Component uses `bg-bg`, `text-fg`, `bg-brand`, `text-brand-fg`, `bg-accent`, or `border-border`
- **THEN** the computed CSS variable equals the hex declared in `design.md` §6 (`--color-bg: #F8F1E0`, `--color-brand: #2F5D3A`, `--color-accent: #C26A3D`, etc.)

#### Scenario: Typography stack matches V2 selection
- **WHEN** `font-display`, `font-sans`, or `font-mono` Tailwind utilities are applied
- **THEN** the resolved CSS `font-family` lists `Fraunces`, `Inter`, or `IBM Plex Mono` respectively (with the documented fallback chain)

> See: ../../designs/figma.md

### Requirement: shadcn/ui base primitives are installed
The system SHALL ship the shadcn/ui CLI configuration plus the base primitives `button`, `input`, `card`, `dialog`, `dropdown-menu`, `tabs`, and `sonner`.

#### Scenario: Components render without runtime errors
- **WHEN** any of the listed shadcn primitives is imported into a page
- **THEN** the component renders correctly in dev mode
- **AND** Lucide icon imports resolve
- **AND** Radix peer dependencies are present in `package.json`

### Requirement: Route group layouts separate public and admin surfaces
The system SHALL define two App Router route groups, `(public)` and `(admin)`, each with its own layout sharing the root layout's fonts and `globals.css`.

#### Scenario: Public layout wraps the public surface
- **WHEN** a visitor requests any `(public)` route (e.g. `/`, `/routes`, `/routes/[slug]`)
- **THEN** the response includes the public header and footer placeholders
- **AND** does NOT include the admin layout chrome

#### Scenario: Admin layout wraps the admin surface
- **WHEN** an authenticated admin requests an `(admin)` route (e.g. `/admin/upload`)
- **THEN** the response includes the admin layout chrome (sign-out button placeholder)
- **AND** does NOT include the public header/footer

> See: ../../diagrams/01-component-system-architecture.puml

### Requirement: Placeholder Logo SVG and favicon are shipped
The system SHALL include a placeholder Logo SVG under `public/brand/logo.svg`, a `favicon.ico`, plus `app/icon.tsx` and `app/apple-icon.tsx` for browser/OS asset coverage.

#### Scenario: Logo asset is reachable
- **WHEN** a browser requests `/brand/logo.svg`
- **THEN** the server returns the placeholder SVG with content-type `image/svg+xml`

#### Scenario: Favicons resolve with no console error
- **WHEN** a browser loads any page
- **THEN** favicon and apple-touch-icon resolve with HTTP 200
- **AND** no missing-icon error appears in the browser console

> See: ../../designs/figma.md

### Requirement: `.env.example` documents all required environment variables
The system SHALL include a `.env.example` listing every environment variable consumed by the application, with a short purpose note for each, while `.env.local` remains git-ignored.

#### Scenario: Required env vars are documented
- **WHEN** a new developer reads `.env.example`
- **THEN** the file lists at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_GITHUB_USERNAME`, and `NEXT_PUBLIC_PMTILES_URL`
- **AND** each entry has a one-line purpose comment

#### Scenario: Secret files stay out of git
- **WHEN** a developer creates `.env.local` with real values
- **THEN** `git status` does not list the file
