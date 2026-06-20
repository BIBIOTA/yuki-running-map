/**
 * Shared admin auth helpers for Playwright e2e specs.
 *
 * The Supabase admin API can mint a magic link for any user. We follow
 * the redirect, scrape the access_token / refresh_token out of the URL
 * fragment, and re-wrap them into the `@supabase/ssr` cookie format
 * (base64-prefixed JSON-serialised session) so the middleware accepts
 * subsequent requests as the signed-in admin.
 *
 * Spec: openspec/changes/feat-admin-gpx-upload/tasks.md §5.1
 *
 * Extracted from the original inline implementation in
 * `e2e/admin-login-flow.spec.ts` so the new admin upload spec
 * (`e2e/admin-upload.spec.ts`) can reuse the exact same flow.
 */

import type { BrowserContext, Page } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const ADMIN_USERNAME = process.env.ADMIN_GITHUB_USERNAME ?? "";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: { user_name?: string };
}

interface SupabaseTokenPayload {
  sub: string;
  email?: string;
  aud: string;
  role: string;
  exp: number;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export function getProjectRef(url: string): string {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  if (!match || !match[1]) {
    throw new Error(`Cannot derive Supabase project ref from URL: ${url}`);
  }
  return match[1];
}

export function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function decodeJwtPayload<T>(jwt: string): T {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT shape");
  }
  const payload = parts[1] ?? "";
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf-8",
  );
  return JSON.parse(json) as T;
}

export async function findAdminUser(): Promise<SupabaseUser> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase admin list users failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { users: SupabaseUser[] };
  const match = body.users.find((u) => u.user_metadata?.user_name === ADMIN_USERNAME);
  if (!match) {
    throw new Error(
      `No auth.users row with user_metadata.user_name='${ADMIN_USERNAME}' — sign in via GitHub OAuth once on the live app, then re-run E2E.`,
    );
  }
  return match;
}

export async function mintMagicLink(opts: { email: string; redirectTo: string }): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: opts.email,
      redirect_to: opts.redirectTo,
    }),
  });
  if (!res.ok) {
    throw new Error(`Supabase generate_link failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    action_link?: string;
    properties?: { action_link?: string };
  };
  const link = body.action_link ?? body.properties?.action_link;
  if (!link) {
    throw new Error(`Supabase generate_link returned no action_link: ${JSON.stringify(body)}`);
  }
  return link;
}

/**
 * Composed sign-in helper: locates Yuki's real admin row via the Admin
 * API, mints a magic link, follows it to harvest the access /
 * refresh tokens, and writes the `@supabase/ssr` cookie so the next
 * `page.goto(...)` lands as the signed-in admin.
 *
 * Returns the admin email so callers can assert on it if needed.
 */
export async function signInAsAdmin(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
): Promise<string> {
  if (!baseURL) {
    throw new Error("Playwright baseURL must be set");
  }

  // 1. Find Yuki's real admin row via Admin API.
  const adminUser = await findAdminUser();
  if (!adminUser.email) {
    throw new Error("Admin user must have an email");
  }

  // 2. Mint a magic link → Supabase 302 to baseURL/#access_token=...&refresh_token=...
  //    (implicit flow; PKCE-only routes don't exist in the admin API).
  const actionLink = await mintMagicLink({
    email: adminUser.email,
    redirectTo: `${baseURL}/`,
  });
  await page.goto(actionLink, { waitUntil: "domcontentloaded" });

  // 3. Pull access_token + refresh_token out of the URL fragment.
  const fragment = new URL(page.url()).hash.slice(1);
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  const expiresAt = Number(params.get("expires_at") ?? "0");
  if (!accessToken) {
    throw new Error("magic link did not surface access_token");
  }
  if (!refreshToken) {
    throw new Error("magic link did not surface refresh_token");
  }

  // 4. Re-wrap into the @supabase/ssr cookie format (base64-prefixed JSON-serialised session).
  const claims = decodeJwtPayload<SupabaseTokenPayload>(accessToken);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    token_type: "bearer",
    user: {
      id: claims.sub,
      aud: claims.aud,
      role: claims.role,
      email: claims.email,
      user_metadata: claims.user_metadata ?? {},
      app_metadata: claims.app_metadata ?? {},
      created_at: new Date(0).toISOString(),
    },
  };
  const cookieValue = `base64-${base64UrlEncode(JSON.stringify(session))}`;
  await context.clearCookies();
  await context.addCookies([
    {
      name: `sb-${getProjectRef(SUPABASE_URL)}-auth-token`,
      value: cookieValue,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  return adminUser.email;
}
