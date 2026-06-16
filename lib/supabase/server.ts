import { createServerClient as ssrCreateServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CookieEntry {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

export async function createServerClient() {
  const cookieStore = await cookies();
  return ssrCreateServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieEntry[]) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
