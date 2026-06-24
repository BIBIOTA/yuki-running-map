/**
 * Static contract tests for `<RouteRegionsSection>` shared chrome.
 *
 * Spec: openspec/changes/refactor-upload-metadata-fields/specs/route-administrative-regions/spec.md
 *       Requirement "RouteRegionsSection shared chrome wraps the regions surface across all pages"
 *
 * Scenarios covered:
 *   - "Public detail page delegates regions chrome to the shared component"
 *   - "Public detail page hides the section when there are zero regions"
 *   - "RouteMetadataForm no longer owns the regions surface"
 *
 * The vitest environment is node-only (no React testing library / jsdom).
 * The component's actual rendering is covered by Playwright e2e (task
 * 10.x). Here we assert the source-level contract that downstream surfaces
 * cannot drift from the canonical chrome.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const COMPONENT_PATH = join(ROOT, "components/RouteRegions.tsx");
const PUBLIC_PAGE_PATH = join(ROOT, "app/(public)/routes/[slug]/page.tsx");
const FORM_PATH = join(ROOT, "features/admin-routes/RouteMetadataForm.tsx");

function read(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("RouteRegionsSection shared chrome", () => {
  it("Public detail page delegates regions chrome to the shared component", () => {
    // (A) The component exists and exports the canonical chrome.
    const componentSource = read(COMPONENT_PATH);
    expect(componentSource).toMatch(/export function RouteRegionsSection\b/);
    expect(componentSource).toMatch(/<section\s+aria-labelledby="regions-heading"/);
    // h2 chrome must match the public detail page's existing styling so a
    // greyhead refactor cannot break either surface in isolation.
    expect(componentSource).toMatch(
      /<h2[^>]*id="regions-heading"[\s\S]*?className="[^"]*font-mono[^"]*text-xs[^"]*tracking-widest[^"]*text-muted-foreground[^"]*uppercase[^"]*"/,
    );
    expect(componentSource).toMatch(/途經區域/);

    // (B) Public detail page imports + uses the shared component
    //     and no longer hand-rolls the heading.
    const publicPage = read(PUBLIC_PAGE_PATH);
    expect(publicPage).toMatch(
      /import\s*\{[^}]*RouteRegionsSection[^}]*\}\s*from\s*"@\/components\/RouteRegions"/,
    );
    expect(publicPage).toMatch(/<RouteRegionsSection\b/);
    expect(publicPage).not.toMatch(/aria-labelledby="regions-heading"/);
  });

  it("Public detail page hides the section when there are zero regions", () => {
    // The component contains an early `return null` branch keyed off
    // `regions.length === 0` so the public page surface stays empty
    // when there are no regions (matches the existing detail-page
    // behaviour where the heading was conditionally rendered).
    const componentSource = read(COMPONENT_PATH);
    // Match: inside RouteRegionsSection's body, an early-return when
    // regions is empty. Allow either `length === 0` or `!regions.length`.
    expect(componentSource).toMatch(
      /(regions\.length\s*===\s*0|regions\.length\s*<\s*1|!regions\.length)[\s\S]*?return\s+null/,
    );
  });

  it("RouteMetadataForm no longer owns the regions surface", () => {
    const formSource = read(FORM_PATH);
    expect(formSource).not.toMatch(/\brouteRegions\b/);
    expect(formSource).not.toMatch(/<RouteRegions\b/);
    expect(formSource).not.toMatch(
      /import\s*\{[^}]*\bRouteRegions\b[^}]*\}\s*from\s*"@\/components\/RouteRegions"/,
    );
  });
});
