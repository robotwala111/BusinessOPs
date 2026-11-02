"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { settingsService } from "@/services/settingsService";
import type { EffectiveCompanySettings } from "@/types/settings";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clients", href: "/clients" },
  { label: "Leads", href: "/leads" },
  { label: "Contacts", href: "/contacts" },
  { label: "Activities", href: "/activities" },
  { label: "Projects", href: "/projects" },
  { label: "Quotations", href: "/quotations" },
  { label: "Contracts", href: "/contracts" },
  { label: "Invoices", href: "/invoices" },
  { label: "Expenses", href: "/expenses" },
  { label: "Maintenance", href: "/maintenance" },
  { label: "Notifications", href: "/notifications" },
  { label: "Settings", href: "/settings" }
];

export function Sidebar() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<EffectiveCompanySettings | null>(null);

  useEffect(() => {
    void settingsService.getEffectiveCompanySettings().then(setSettings);
  }, []);

  const companyName = settings?.company_name ?? "Business Operations";
  const logoText = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "BO";

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-brand">
        {settings?.logo_url ? (
          <Image className="sidebar-logo sidebar-logo-image" src={settings.logo_url} alt="" width={40} height={40} unoptimized />
        ) : (
          <span className="sidebar-logo">{logoText}</span>
        )}
        <div>
          <strong>{companyName}</strong>
          <small>Business operations</small>
        </div>
      </div>
      <nav>
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
