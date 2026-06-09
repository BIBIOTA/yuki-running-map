import type { Metadata } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface RouteDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `路線 · ${slug}`,
    description: `Yuki 跑步路線 ${slug} — 詳細資訊與 GPX 下載（建設中）。`,
  };
}

export default async function RouteDetailPage({ params }: RouteDetailPageProps) {
  const { slug } = await params;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <Link
          href="/routes"
          className="font-mono text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          ← 路線列表
        </Link>
        <h1 className="font-display text-3xl font-bold text-foreground">路線 · {slug}</h1>
        <p className="text-sm text-muted-foreground">
          地圖、GPX 下載、海拔曲線、統計 chips — 功能還在組裝中。
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Coming soon
          </span>
          <p className="max-w-md text-base text-foreground">
            這個路線的詳情頁面（地圖、GPX 下載、elevation profile）正在 build。
          </p>
          <Button asChild variant="outline">
            <Link href="/routes">回路線列表</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
