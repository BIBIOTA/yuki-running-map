import { describe, expect, it, vi } from "vitest";

import { handleAuthErrorFlash } from "../handleAuthErrorFlash";

describe("handleAuthErrorFlash", () => {
  it("Visitor lands on home with auth_error flash", () => {
    const toast = vi.fn();
    const replace = vi.fn();

    handleAuthErrorFlash({
      authError: "not_admin",
      toast,
      replace,
    });

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("您不是 admin，已登出");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("Visitor lands on home without flash", () => {
    const toast = vi.fn();
    const replace = vi.fn();

    handleAuthErrorFlash({
      authError: null,
      toast,
      replace,
    });

    expect(toast).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
