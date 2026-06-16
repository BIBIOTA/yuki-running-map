import { describe, expect, it } from "vitest";

import { decideAdminGuard } from "../admin-guard";

describe("decideAdminGuard", () => {
  it("/admin/login bypasses the guard", () => {
    const decision = decideAdminGuard({
      pathname: "/admin/login",
      user: null,
      adminUsername: "bibiota",
    });

    expect(decision).toEqual({ type: "bypass-without-auth" });
  });

  it("Unauthenticated request to /admin/upload is redirected", () => {
    const decision = decideAdminGuard({
      pathname: "/admin/upload",
      user: null,
      adminUsername: "bibiota",
    });

    expect(decision).toEqual({ type: "redirect-to-login" });
  });

  it("Logged-in admin reaches /admin/upload", () => {
    const decision = decideAdminGuard({
      pathname: "/admin/upload",
      user: { user_metadata: { user_name: "bibiota" } },
      adminUsername: "bibiota",
    });

    expect(decision).toEqual({ type: "next" });
  });

  it("Non-admin user is signed out and redirected with flash", () => {
    const decision = decideAdminGuard({
      pathname: "/admin/upload",
      user: { user_metadata: { user_name: "someone-else" } },
      adminUsername: "bibiota",
    });

    expect(decision).toEqual({ type: "sign-out-and-redirect-to-flash" });
  });

  it("Missing ADMIN_GITHUB_USERNAME blocks everyone", () => {
    const decision = decideAdminGuard({
      pathname: "/admin/upload",
      user: { user_metadata: { user_name: "bibiota" } },
      adminUsername: undefined,
    });

    expect(decision).toEqual({ type: "sign-out-and-redirect-to-flash" });
  });
});
