import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/admin/upload";

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_missing_code", url.origin));
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_exchange_failed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
