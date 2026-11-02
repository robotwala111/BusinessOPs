"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
