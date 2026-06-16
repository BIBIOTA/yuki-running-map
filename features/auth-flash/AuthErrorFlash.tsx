"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { handleAuthErrorFlash } from "./handleAuthErrorFlash";

export function AuthErrorFlash() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("auth_error");

  useEffect(() => {
    handleAuthErrorFlash({
      authError,
      toast,
      replace: router.replace,
    });
  }, [authError, router.replace]);

  return null;
}
