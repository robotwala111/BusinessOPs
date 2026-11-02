"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [isLoading, router, user]);

  return (
    <main className="page-shell">
      <section className="content-panel">
        <p className="eyebrow">Business Operations Platform</p>
        <h1>Business Operations</h1>
        <p className="muted">Preparing your workspace...</p>
      </section>
    </main>
  );
}
