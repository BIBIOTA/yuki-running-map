interface SignInDeps {
  signInWithOAuth: (params: {
    provider: "github";
    options: { redirectTo: string };
  }) => Promise<unknown>;
  origin: string;
}

export async function handleGithubSignIn(_deps: SignInDeps): Promise<void> {
  throw new Error("not implemented");
}
