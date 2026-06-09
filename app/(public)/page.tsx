import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-20">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs tracking-widest text-accent uppercase">
          Yuki&apos;s Running Map
        </span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
          Yuki&apos;s Running Map
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Yuki 的跑步路線分享地圖。地圖搜尋、GPX 下載、路線詳情，溫暖手繪的視覺語彙。
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild>
          <Link href="/routes">瀏覽路線</Link>
        </Button>
      </div>
    </section>
  );
}
