import { type NextRequest, NextResponse } from "next/server";

import { decideAdminGuard } from "@/lib/auth/admin-guard";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export const config = {
  matcher: ["/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decideAdminGuard({
    pathname: req.nextUrl.pathname,
    user,
    adminUsername: process.env.ADMIN_GITHUB_USERNAME,
  });

  switch (decision.type) {
    case "bypass-without-auth":
    case "next":
      return res;
    case "redirect-to-login":
      return NextResponse.redirect(new URL("/admin/login", req.url));
    case "sign-out-and-redirect-to-flash":
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/?auth_error=not_admin", req.url));
  }
}
