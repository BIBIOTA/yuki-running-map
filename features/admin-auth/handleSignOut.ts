interface SignOutDeps {
  signOut: () => Promise<unknown>;
  push: (href: string) => void;
}

export async function handleSignOut(_deps: SignOutDeps): Promise<void> {
  throw new Error("not implemented");
}
