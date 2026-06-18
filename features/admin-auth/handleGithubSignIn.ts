interface SignInDeps {
  signInWithOAuth: (params: {
    provider: "github";
    options: { redirectTo: string };
  }) => Promise<unknown>;
  origin: string;
}

export async function handleGithubSignIn({
  signInWithOAuth,
  origin,
}: SignInDeps): Promise<void> {
  await signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback?next=/admin/upload` },
  });
}
