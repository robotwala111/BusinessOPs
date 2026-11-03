"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { settingsService } from "@/services/settingsService";
import type { EffectiveCompanySettings } from "@/types/settings";

interface NavItem {
  label: string;
  href: string;
  badge?: string;
  icon: (props: { className?: string }) => JSX.Element;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        label: "Executive Dashboard",
        href: "/dashboard",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </svg>
        )
      },
      {
        label: "Amiro Intelligence",
        href: "/copilot",
        badge: "AI",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
        )
      }
    ]
  },
  {
    title: "CRM & CLIENTS",
    items: [
      {
        label: "Leads",
        href: "/leads",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        )
      },
      {
        label: "Clients",
        href: "/clients",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      },
      {
        label: "Activities",
        href: "/activities",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        )
      }
    ]
  },
  {
    title: "BUSINESS OPERATIONS",
    items: [
      {
        label: "Projects",
        href: "/projects",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )
      },
      {
        label: "Quotations",
        href: "/quotations",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
        )
      },
      {
        label: "Contracts",
        href: "/contracts",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          </svg>
        )
      },
      {
        label: "Maintenance",
        href: "/maintenance",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        )
      },
      {
        label: "Support",
        href: "/support",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )
      }
    ]
  },
  {
    title: "FINANCE",
    items: [
      {
        label: "Invoices",
        href: "/invoices",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="16" height="20" x="4" y="2" rx="2" />
            <line x1="8" x2="16" y1="6" y2="6" />
            <line x1="8" x2="16" y1="10" y2="10" />
            <line x1="8" x2="12" y1="14" y2="14" />
          </svg>
        )
      },
      {
        label: "Expenses",
        href: "/expenses",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        )
      },
      {
        label: "Payments",
        href: "/payments",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        )
      },
      {
        label: "Financial Reports",
        href: "/reports/finance",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" x2="18" y1="20" y2="10" />
            <line x1="12" x2="12" y1="20" y2="4" />
            <line x1="6" x2="6" y1="20" y2="14" />
          </svg>
        )
      }
    ]
  },
  {
    title: "ADMINISTRATION",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        )
      },
      {
        label: "User Management",
        href: "/settings/users",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )
      },
      {
        label: "Roles & Permissions",
        href: "/settings/roles",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )
      },
      {
        label: "Settings",
        href: "/settings",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        )
      },
      {
        label: "Audit Logs",
        href: "/settings/audit",
        icon: (props) => (
          <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="m9 15 2 2 4-4" />
          </svg>
        )
      }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<EffectiveCompanySettings | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    void settingsService.getEffectiveCompanySettings().then(setSettings);
  }, []);

  const companyName = settings?.company_name ?? "Amiro Tech Solutions";
  const logoText = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "AT";

  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`} aria-label="Primary navigation">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-container">
          {settings?.logo_url ? (
            <Image className="sidebar-logo sidebar-logo-image" src={settings.logo_url} alt="" width={36} height={36} unoptimized />
          ) : (
            <span className="sidebar-logo">{logoText}</span>
          )}
        </div>
        {!isCollapsed && (
          <div className="sidebar-brand-text">
            <strong>{companyName}</strong>
            <small>ENTERPRISE OPERATIONS</small>
          </div>
        )}
        <button
          type="button"
          className="sidebar-collapse-toggle"
          onClick={() => setIsCollapsed((prev) => !prev)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isCollapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav">
        {navigationSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            {!isCollapsed && <span className="sidebar-section-title">{section.title}</span>}
            <div className="sidebar-section-items">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <IconComponent className="sidebar-nav-icon" />
                    {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
                    {!isCollapsed && item.badge ? (
                      <span className="sidebar-item-badge">{item.badge}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / Client Portal Shortcut */}
      <div className="sidebar-footer">
        <Link
          href="/portal"
          prefetch={true}
          className="sidebar-portal-btn"
          title="Switch to Client Portal View"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          {!isCollapsed && <span>Client Portal</span>}
        </Link>
      </div>
    </aside>
  );
}
