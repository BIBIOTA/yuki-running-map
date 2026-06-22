import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ElevationProfile } from "@/features/route-detail/ElevationProfile";
import { getDb } from "@/lib/db/client";
import { routes } from "@/lib/db/schema";

interface RouteDetailPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Fetch a published route by slug. Anonymous SELECT is gated by routes RLS
 * to `published = true`, but the Drizzle client bypasses RLS — we therefore
 * filter on `published` explicitly here so the public page only ever shows
 * published rows.
 */
async function loadPublishedRoute(slug: string) {
  const db = getDb();
  const rows = await db
    .select({
      slug: routes.slug,
      title: routes.title,
      description: routes.description,
      distanceM: routes.distanceM,
      elevationGainM: routes.elevationGainM,
      elevationProfile: routes.elevationProfile,
      recordedAt: routes.recordedAt,
      gpxPath: routes.gpxPath,
      published: routes.published,
    })
    .from(routes)
    .where(eq(routes.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row || !row.published) return null;
  return row;
}

export async function generateMetadata({ params }: RouteDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await loadPublishedRoute(slug).catch(() => null);
  if (!row) {
    return { title: "找不到路線" };
  }
  return {
    title: `${row.title} · 路線`,
    description: row.description ?? `Yuki 跑步路線 ${row.title}`,
  };
}

export default async function RouteDetailPage({ params }: RouteDetailPageProps) {
  const { slug } = await params;
  const row = await loadPublishedRoute(slug);
  if (!row) notFound();

  const distanceKm = (row.distanceM / 1000).toFixed(2);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div className="space-y-2">
        <Link
          href="/routes"
          className="font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          ← 路線列表
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground">{row.title}</h1>
        {row.description ? (
          <p className="text-sm text-muted-foreground">{row.description}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-3 gap-4 rounded-md border border-border bg-card p-4">
        <div className="space-y-1">
          <dt className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            距離
          </dt>
          <dd className="font-display text-xl font-semibold text-primary">{distanceKm} km</dd>
        </div>
        <div className="space-y-1">
          <dt className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            累積爬升
          </dt>
          <dd className="font-display text-xl font-semibold text-primary">
            {row.elevationGainM} m
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            紀錄時間
          </dt>
          <dd className="font-display text-xl font-semibold text-primary">
            {row.recordedAt.toISOString().slice(0, 10)}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="elevation-heading" className="space-y-3">
        <h2
          id="elevation-heading"
          className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
        >
          海拔曲線
        </h2>
        <div className="rounded-md border border-border bg-card p-3">
          <ElevationProfile profile={row.elevationProfile} />
        </div>
      </section>

      <div>
        <Button asChild>
          <a href={`/api/routes/${row.slug}/gpx`} download>
            ↓ 下載 GPX
          </a>
        </Button>
      </div>
    </section>
  );
}
