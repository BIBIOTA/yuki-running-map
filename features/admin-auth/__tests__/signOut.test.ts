import { describe, expect, it, vi } from "vitest";

import { handleSignOut } from "../handleSignOut";

describe("/admin/upload sign out", () => {
  it("Sign out clears the session", async () => {
    const signOut = vi.fn(async () => undefined);
    const push = vi.fn();

    await handleSignOut({ signOut, push });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/");
  });
});
