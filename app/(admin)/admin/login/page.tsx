"use client";

import { handleGithubSignIn } from "@/features/admin-auth/handleGithubSignIn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const onSignIn = () => {
    const supabase = createBrowserClient();
    void handleGithubSignIn({
      signInWithOAuth: (params) => supabase.auth.signInWithOAuth(params),
      origin: window.location.origin,
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-24">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Admin 登入</CardTitle>
          <CardDescription>使用 GitHub 帳號登入以管理路線</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onSignIn} className="w-full" size="lg">
            以 GitHub 登入
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
