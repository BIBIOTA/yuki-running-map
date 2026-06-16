interface SignOutDeps {
  signOut: () => Promise<unknown>;
  push: (href: string) => void;
}

export async function handleSignOut({
  signOut,
  push,
}: SignOutDeps): Promise<void> {
  await signOut();
  push("/");
}
