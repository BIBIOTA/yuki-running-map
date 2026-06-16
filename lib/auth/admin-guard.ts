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

export function decideAdminGuard(_input: GuardInput): GuardDecision {
  throw new Error("not implemented");
}
