"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { shouldHideAdminNav } from "./shouldHideAdminNav";

export function AdminTopNav() {
  const pathname = usePathname();

  if (shouldHideAdminNav(pathname)) {
    return null;
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/admin/upload"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Yuki&apos;s Running Map · Admin
        </Link>
        {/* Sign out wires up in task 6.5. */}
        <Button variant="ghost" size="sm" disabled>
          Sign out
        </Button>
      </div>
    </header>
  );
}
