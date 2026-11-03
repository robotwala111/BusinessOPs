"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { settingsService } from "@/services/settingsService";
import type { EffectiveCompanySettings } from "@/types/settings";
import { QuickCreateMenu } from "./QuickCreateMenu";
import { ThemeToggle } from "./ThemeToggle";

const routeNames: Record<string, string> = {
  "/dashboard": "Executive Dashboard",
  "/copilot": "Amiro Intelligence",
  "/clients": "Clients Directory",
  "/clients/onboard": "Client Onboarding Wizard",
  "/leads": "Leads & Pipeline",
  "/activities": "Activities & Notes",
  "/projects": "Projects & Operations",
  "/quotations": "Quotations & Proposals",
  "/contracts": "Contracts & SOWs",
  "/invoices": "Invoices & Billing",
  "/expenses": "Expenses Ledger",
  "/payments": "Payments & Collections",
  "/reports/finance": "Financial Reports",
  "/maintenance": "Maintenance & AMC",
  "/support": "Support & SLA",
  "/notifications": "Notifications",
  "/settings": "Platform Settings",
  "/settings/users": "User Management",
  "/settings/roles": "Roles & Permissions",
  "/settings/audit": "Audit Logs",
  "/portal": "Client Portal"
};

export function Topbar() {
  const { logout, profile, isDemoMode } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [settings, setSettings] = useState<EffectiveCompanySettings | null>(null);
  const router = useRouter();
  const pathname = usePathname();

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

  // Derive page title from route
  const currentKey = Object.keys(routeNames).find((key) => pathname === key || pathname.startsWith(`${key}/`));
  const currentPageTitle = currentKey ? routeNames[currentKey] : "Operations";

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join("")
    : "AT";

  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  }

  return (
    <header className="topbar">
      {/* Left: Breadcrumbs & Organization */}
      <div className="topbar-left">
        <div className="topbar-brand-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div className="topbar-breadcrumb">
          <span className="topbar-company">{settings?.company_name ?? "Amiro Tech Solutions"}</span>
          <span className="topbar-separator" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <span className="topbar-title">{currentPageTitle}</span>
        </div>
      </div>

      {/* Right Controls: Command Palette trigger, Quick Create, Theme Toggle, Mode Badge, User Pill, Sign Out */}
      <div className="topbar-right">
        {/* Command Palette Trigger */}
        <button
          type="button"
          className="topbar-cmd-trigger"
          onClick={openCommandPalette}
          title="Open Command Palette (Ctrl + K)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Search & commands</span>
          <kbd>Ctrl K</kbd>
        </button>

        {/* Quick Create Dropdown Menu */}
        <QuickCreateMenu />

        {/* Theme Toggle (Light / Dark) */}
        <ThemeToggle />

        {/* Mode Indicator */}
        {isDemoMode ? (
          <span className="topbar-mode-badge" title="Running in local sandbox mode with isolated state">
            <span className="topbar-mode-dot" />
            Demo Mode
          </span>
        ) : (
          <span className="topbar-mode-badge connected" title="Connected to production database">
            <span className="topbar-mode-dot connected" />
            Live Cloud
          </span>
        )}

        {/* User Pill */}
        <div className="topbar-user-pill">
          <div className="topbar-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{profile?.full_name || "Admin User"}</span>
            <span className="topbar-user-role">{profile?.role || "Admin"}</span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          className="topbar-logout-btn"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Sign out of system"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          <span>{isLoggingOut ? "..." : "Sign Out"}</span>
        </button>
      </div>
    </header>
  );
}
