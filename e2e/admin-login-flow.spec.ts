import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ADMIN_USERNAME = process.env.ADMIN_GITHUB_USERNAME ?? "";

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: { user_name?: string };
}

function getProjectRef(url: string): string {
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/);
  if (!match || !match[1]) {
    throw new Error(`Cannot derive Supabase project ref from URL: ${url}`);
  }
  return match[1];
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeJwtPayload<T>(jwt: string): T {
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

async function findAdminUser(): Promise<SupabaseUser> {
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

async function mintMagicLink(opts: { email: string; redirectTo: string }): Promise<string> {
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
  const body = (await res.json()) as { action_link?: string; properties?: { action_link?: string } };
  const link = body.action_link ?? body.properties?.action_link;
  if (!link) {
    throw new Error(`Supabase generate_link returned no action_link: ${JSON.stringify(body)}`);
  }
  return link;
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

test("authenticated admin reaches /admin/upload and sees Coming soon + sign out", async ({
  page,
  context,
  baseURL,
}) => {
  expect(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL must be set").not.toBe("");
  expect(SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY must be set").not.toBe("");
  expect(ADMIN_USERNAME, "ADMIN_GITHUB_USERNAME must be set").not.toBe("");
  expect(baseURL, "Playwright baseURL must be set").toBeTruthy();

  // 1. Find Yuki's real admin row via Admin API.
  const adminUser = await findAdminUser();
  expect(adminUser.email, "Admin user must have an email").toBeTruthy();

  // 2. Mint a magic link → Supabase 302 to baseURL/#access_token=...&refresh_token=...
  //    (implicit flow; PKCE-only routes don't exist in the admin API).
  const actionLink = await mintMagicLink({
    email: adminUser.email ?? "",
    redirectTo: `${baseURL}/`,
  });
  await page.goto(actionLink, { waitUntil: "domcontentloaded" });

  // 3. Pull access_token + refresh_token out of the URL fragment.
  const fragment = new URL(page.url()).hash.slice(1);
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  const expiresAt = Number(params.get("expires_at") ?? "0");
  expect(accessToken, "magic link did not surface access_token").not.toBe("");
  expect(refreshToken, "magic link did not surface refresh_token").not.toBe("");

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

  // 5. Navigate to /admin/upload — middleware reads cookie → auth.getUser() → admin match → render.
  const response = await page.goto("/admin/upload", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/upload$/);
  await expect(page.getByText("Coming soon · GPX 上傳開發中")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
