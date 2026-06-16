import { describe, expect, it, vi } from "vitest";

import { handleGithubSignIn } from "../handleGithubSignIn";
import { shouldHideAdminNav } from "../shouldHideAdminNav";

describe("/admin/login", () => {
  it("Visitor opens login page", () => {
    expect(shouldHideAdminNav("/admin/login")).toBe(true);
    expect(shouldHideAdminNav("/admin/upload")).toBe(false);
    expect(shouldHideAdminNav("/admin")).toBe(false);
  });

  it("Clicking the button starts OAuth flow", async () => {
    const signInWithOAuth = vi.fn(async () => undefined);

    await handleGithubSignIn({
      signInWithOAuth,
      origin: "https://example.com",
    });

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://example.com/admin/upload" },
    });
  });
});
