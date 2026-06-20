import { describe, expect, it } from "vitest";

import { ADMIN_NAV_LINKS, isLinkActive } from "../adminNavLinks";

describe("ADMIN_NAV_LINKS", () => {
  it("contains the upload and routes links in order", () => {
    expect(ADMIN_NAV_LINKS).toHaveLength(2);
    expect(ADMIN_NAV_LINKS[0]).toEqual({ href: "/admin/upload", label: "上傳" });
    expect(ADMIN_NAV_LINKS[1]).toEqual({
      href: "/admin/routes",
      label: "路線管理",
    });
  });
});

describe("isLinkActive", () => {
  it("returns true when pathname exactly matches the upload href", () => {
    expect(isLinkActive("/admin/upload", "/admin/upload")).toBe(true);
  });

  it("returns true when pathname exactly matches the routes href", () => {
    expect(isLinkActive("/admin/routes", "/admin/routes")).toBe(true);
  });

  it("returns true when pathname is a sub-route of the routes href", () => {
    expect(isLinkActive("/admin/routes/abc-123", "/admin/routes")).toBe(true);
  });

  it("returns false when on upload and checking routes link", () => {
    expect(isLinkActive("/admin/upload", "/admin/routes")).toBe(false);
  });

  it("returns false when on routes and checking upload link", () => {
    expect(isLinkActive("/admin/routes", "/admin/upload")).toBe(false);
  });

  it("does not match a prefix without a '/' boundary", () => {
    expect(isLinkActive("/admin/upload-something", "/admin/upload")).toBe(false);
  });

  it("returns false for a shorter pathname than the href", () => {
    expect(isLinkActive("/admin", "/admin/upload")).toBe(false);
  });

  it("returns false for an unrelated root pathname", () => {
    expect(isLinkActive("/", "/admin/upload")).toBe(false);
  });
});
