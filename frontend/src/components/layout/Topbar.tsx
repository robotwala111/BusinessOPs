"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { settingsService } from "@/services/settingsService";
import type { EffectiveCompanySettings } from "@/types/settings";

export function Topbar() {
  const { logout, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [settings, setSettings] = useState<EffectiveCompanySettings | null>(null);
  const router = useRouter();

  useEffect(() => {
    void settingsService.getEffectiveCompanySettings().then(setSettings);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="topbar">
      <div>
        <span>{settings?.company_name ?? "Business Operations"}</span>
        {profile?.full_name ? <small>{profile.full_name}</small> : null}
      </div>
      <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? "Signing out..." : "Logout"}
      </button>
    </header>
  );
}
