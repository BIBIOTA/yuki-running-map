export function shouldHideAdminNav(pathname: string): boolean {
  return pathname === "/admin/login";
}
