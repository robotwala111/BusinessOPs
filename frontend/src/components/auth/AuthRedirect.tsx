"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

type AuthRedirectProps = {
  children: React.ReactNode;
};

export function AuthRedirect({ children }: AuthRedirectProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(searchParams.get("next") ?? "/dashboard");
    }
  }, [isLoading, router, searchParams, user]);

  if (isLoading) {
    return <main className="page-shell">Loading...</main>;
  }

  if (user) {
    return null;
  }

  return children;
}
