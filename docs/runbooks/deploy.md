# Deploy runbook · Wave C onboarding

End-to-end setup for **Yuki's Running Map** production. Follow this once to provision Supabase + GitHub OAuth + Vercel; afterwards every push to `main` (or PR) deploys automatically.

> **Audience**: Yuki (or anyone with admin access to the GitHub repo, Supabase account, and Vercel account). The steps assume no prior infra exists.

## Checklist overview

```
[ ] 1. Supabase project (Postgres + PostGIS + 2 Storage buckets)
[ ] 2. GitHub OAuth App
[ ] 3. Hook OAuth into Supabase Auth
[ ] 4. Upload first PMTiles bundle
[ ] 5. Vercel project + env vars + first deploy
[ ] 6. First-time smoke checklist
```

Estimated time: 45–60 minutes the first time. Subsequent deploys are zero-touch.

---

## 1. Supabase project

1. Sign in to <https://supabase.com>.
2. **New project** in your personal org:
   - Name: `yuki-running-map`
   - Database password: generate a strong one and store in a password manager
   - Region: `Northeast Asia (Tokyo)` (lowest latency from Taiwan)
   - Pricing: **Free tier** is enough to start
3. Wait ~2 minutes for provisioning.
4. **Enable PostGIS**:
   - Left sidebar → **Database** → **Extensions**
   - Search `postgis` → toggle **Enable extension**
   - Verify: open the SQL Editor and run `select postgis_version();` — should return a non-empty version string.
5. **Create Storage buckets** (left sidebar → **Storage** → **New bucket**):
   - `gpx` — **Public bucket: OFF** (we always serve via signed URLs)
   - `tiles` — **Public bucket: ON** (PMTiles needs unrestricted range requests)
6. **Copy three keys** (left sidebar → **Project Settings** → **API**):

   | Key               | Where it goes                                    |
   | ----------------- | ------------------------------------------------ |
   | Project URL       | `NEXT_PUBLIC_SUPABASE_URL` (Vercel)              |
   | anon (public) key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel)         |
   | service_role key  | `SUPABASE_SERVICE_ROLE_KEY` (Vercel server-only) |

   Keep `service_role` secret — it bypasses RLS.

## 2. GitHub OAuth App

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: `Yuki's Running Map`
   - **Homepage URL**: leave blank for now; come back after step 5 to set to your Vercel production URL (e.g. `https://run-map.vercel.app`)
   - **Authorization callback URL**: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
     - Replace `<your-supabase-project>` with the subdomain from step 1 (e.g. `abcdefghij`).
3. Register the application.
4. On the resulting page, click **Generate a new client secret** and copy:

   | GitHub value  | Where it goes (next step)                      |
   | ------------- | ---------------------------------------------- |
   | Client ID     | Supabase → Authentication → Providers → GitHub |
   | Client secret | same                                           |

## 3. Hook OAuth into Supabase Auth

1. Supabase dashboard → **Authentication** → **Providers** → **GitHub** → toggle **Enabled**.
2. Paste **Client ID** and **Client secret** from step 2.
3. Save.
4. Optional: add `https://<your-vercel-url>/admin/login` to the **Site URL** field, and `https://<your-vercel-url>/admin/**` plus `http://localhost:3000/admin/**` to **Redirect URLs**.

## 4. Upload first PMTiles bundle

Follow [pmtiles-update.md](./pmtiles-update.md) to extract a Taiwan-only PMTiles file (~600 MB) from the Protomaps planet build. Upload to the `tiles` Storage bucket created in step 1.5.

Once uploaded, copy the **public URL** of the file (right-click the file in Supabase Storage UI → "Copy URL"). It looks like:

```
https://<project>.supabase.co/storage/v1/object/public/tiles/taiwan-2026-01.pmtiles
```

This is the value for `NEXT_PUBLIC_PMTILES_URL` in the next step.

## 5. Vercel project + env vars + first deploy

1. Sign in to <https://vercel.com> with your GitHub account.
2. **Add New… → Project** → import the `run-map` GitHub repo.
3. Framework Preset: **Next.js** (auto-detected).
4. **Root Directory**: leave as `.`
5. **Environment Variables** — add **all five** to **both** Production and Preview environments:

   | Name                            | Value source                            |
   | ------------------------------- | --------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Step 1.6                                |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Step 1.6                                |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Step 1.6 — **mark "Sensitive"**         |
   | `ADMIN_GITHUB_USERNAME`         | Yuki's GitHub username (e.g. `bibiota`) |
   | `NEXT_PUBLIC_PMTILES_URL`       | Step 4                                  |

6. Click **Deploy**.
7. Once Vercel assigns a domain (e.g. `run-map.vercel.app`):
   - Go back to the GitHub OAuth App (step 2) and set **Homepage URL** to `https://run-map.vercel.app`.
   - Optionally configure a custom domain via Vercel → Domains.

## 6. First-time smoke checklist

After the first deploy completes (~60s), open the production URL and verify:

```
[ ] GET /                       → 200, hero with "Yuki's Running Map"
[ ] GET /routes                 → 200, empty-state ("目前無路線")
[ ] GET /routes/example-route   → 200, "Coming soon" placeholder
[ ] GET /admin/login            → 200, "Sign in with GitHub" button
[ ] GET /admin/upload (logged out) → 307 redirect to /admin/login?from=%2Fadmin%2Fupload
```

Then sign in via GitHub:

```
[ ] OAuth round-trip lands back on /admin/upload (your GitHub account is the configured ADMIN_GITHUB_USERNAME)
[ ] OAuth round-trip for a NON-admin GitHub account immediately signs out and shows ?error=unauthorized
[ ] Map base layer loads (browser network tab shows successful range requests against the PMTiles URL)
```

If any check fails, see [Troubleshooting](#troubleshooting).

## Maintenance

- **PMTiles refresh**: quarterly, per [pmtiles-update.md](./pmtiles-update.md).
- **Supabase backups**: free tier auto-backups daily for 7 days. For longer retention upgrade to Pro.
- **Secret rotation**: if `SUPABASE_SERVICE_ROLE_KEY` is ever leaked, regenerate in Supabase API settings and update Vercel env. Vercel will redeploy automatically.
- **Add a new admin** (future): change `ADMIN_GITHUB_USERNAME` env in Vercel. There is no "multi-admin" mode by design.

## Troubleshooting

| Symptom                                       | Likely cause                                                                             | Fix                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| OAuth redirect 404                            | Callback URL mismatch                                                                    | Check GitHub OAuth App callback URL matches `https://<project>.supabase.co/auth/v1/callback` exactly |
| `/admin/upload` redirects in a loop           | `ADMIN_GITHUB_USERNAME` mismatch                                                         | Compare with `auth.users.user_metadata.user_name` in Supabase → Authentication → Users               |
| Map shows blank tile grid                     | `NEXT_PUBLIC_PMTILES_URL` wrong or `tiles` bucket private                                | Verify the URL with `pmtiles show <url>` locally; confirm bucket is Public                           |
| `Sign out` button on admin shell does nothing | Sign-out wired in Wave C (task 6.5); confirm `lib/supabase` clients are present (Wave B) | Re-run latest deploy                                                                                 |
| RLS blocks admin writes after OAuth login     | Missing/incorrect `auth.jwt()->user_metadata->>user_name` value in RLS policy            | Re-apply RLS migrations; verify session JWT shape via Supabase Auth → Users → row → "User metadata"  |

## See also

- [docs/architecture.md](../architecture.md) — system overview
- [docs/data-model.md](../data-model.md) — RLS specifics
- [docs/runbooks/pmtiles-update.md](./pmtiles-update.md) — base map refresh
- [openspec/changes/bootstrap-yuki-running-map/tasks.md](../../openspec/changes/bootstrap-yuki-running-map/tasks.md) — implementation status (Wave C tasks reference this runbook)
