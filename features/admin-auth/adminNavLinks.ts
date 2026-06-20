export type AdminNavLink = { href: string; label: string };

export const ADMIN_NAV_LINKS: readonly AdminNavLink[] = [
  { href: "/admin/upload", label: "上傳" },
  { href: "/admin/routes", label: "路線管理" },
] as const;

/** Whether the given pathname is "under" the link href. */
export function isLinkActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
