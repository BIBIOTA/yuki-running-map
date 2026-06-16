import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight text-foreground">
            Yuki&apos;s Running Map
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/routes" className="transition-colors hover:text-foreground">
              路線
            </Link>
            <a href="#about" className="transition-colors hover:text-foreground">
              關於 Yuki
            </a>
            <a href="#contact" className="transition-colors hover:text-foreground">
              聯絡
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-foreground text-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 text-sm">
          <span className="font-display font-semibold">Yuki&apos;s Running Map</span>
          <span className="font-mono text-xs opacity-70">
            © 2026 Yuki · Built with Next.js + Supabase
          </span>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
