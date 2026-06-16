export type GuardDecision =
  | { type: "bypass-without-auth" }
  | { type: "next" }
  | { type: "redirect-to-login" }
  | { type: "sign-out-and-redirect-to-flash" };

export interface GuardUser {
  user_metadata?: {
    user_name?: string;
  };
}

export interface GuardInput {
  pathname: string;
  user: GuardUser | null;
  adminUsername: string | undefined;
}

export function decideAdminGuard({
  pathname,
  user,
  adminUsername,
}: GuardInput): GuardDecision {
  if (pathname === "/admin/login") {
    return { type: "bypass-without-auth" };
  }

  if (!user) {
    return { type: "redirect-to-login" };
  }

  if (!adminUsername || user.user_metadata?.user_name !== adminUsername) {
    return { type: "sign-out-and-redirect-to-flash" };
  }

  return { type: "next" };
}
