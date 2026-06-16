import { createBrowserClient as ssrCreateBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
  return ssrCreateBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
