import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/admin/upload"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Yuki&apos;s Running Map · Admin
          </Link>
          {/* TODO: Wave A/Wave C — wire sign-out to Supabase Auth signOut() once admin login is functional (tasks 3.6 + 6.4). */}
          <Button variant="ghost" size="sm" disabled>
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
