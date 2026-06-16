"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/browser";

import { handleSignOut } from "./handleSignOut";
import { shouldHideAdminNav } from "./shouldHideAdminNav";

export function AdminTopNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (shouldHideAdminNav(pathname)) {
    return null;
  }

  const onSignOut = () => {
    const supabase = createBrowserClient();
    void handleSignOut({
      signOut: () => supabase.auth.signOut(),
      push: (href) => router.push(href),
    });
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/admin/upload"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Yuki&apos;s Running Map · Admin
        </Link>
        <Button onClick={onSignOut} variant="ghost" size="sm">
          Sign out
        </Button>
      </div>
    </header>
  );
}
