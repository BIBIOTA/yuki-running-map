"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { ADMIN_NAV_LINKS, isLinkActive } from "./adminNavLinks";
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
        <div className="flex items-center gap-8">
          <Link
            href="/admin/upload"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Yuki&apos;s Running Map · Admin
          </Link>
          <nav
            aria-label="admin navigation"
            className="flex items-center gap-6"
          >
            {ADMIN_NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-sm transition-colors",
                    active
                      ? "font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Button onClick={onSignOut} variant="ghost" size="sm">
          Sign out
        </Button>
      </div>
    </header>
  );
}
