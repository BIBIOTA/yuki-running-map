interface HandleAuthErrorFlashArgs {
  authError: string | null;
  toast: (message: string) => void;
  replace: (href: string) => void;
}

export function handleAuthErrorFlash({
  authError,
  toast,
  replace,
}: HandleAuthErrorFlashArgs): void {
  if (authError !== "not_admin") {
    return;
  }

  toast("您不是 admin，已登出");
  replace("/");
}
