import { createServerClient as ssrCreateServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

interface CookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export function createMiddlewareClient({
  req,
  res,
}: {
  req: NextRequest;
  res: NextResponse;
}) {
  return ssrCreateServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: CookieEntry[]) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );
}
