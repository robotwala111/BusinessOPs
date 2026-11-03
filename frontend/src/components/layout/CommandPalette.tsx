"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientService } from "@/services/clientService";
import { projectService } from "@/services/projectService";
import { invoiceService } from "@/services/invoiceService";
import { quotationService } from "@/services/quotationService";

interface CommandItem {
  id: string;
  category: "Navigation" | "Quick Action" | "Clients" | "Projects" | "Invoices" | "Quotations";
  title: string;
  subtitle?: string;
  href?: string;
  action?: () => void;
  icon?: string;
}

const defaultCommands: CommandItem[] = [
  // Quick Actions
  { id: "act-onboard", category: "Quick Action", title: "Onboard New Client (7-Step Wizard)", subtitle: "Launch complete onboarding pipeline", href: "/clients/onboard", icon: "✨" },
  { id: "act-new-client", category: "Quick Action", title: "New Client (Quick Entry)", subtitle: "Create an organization profile", href: "/clients/new", icon: "🏢" },
  { id: "act-new-quote", category: "Quick Action", title: "Create New Quotation", subtitle: "Prepare commercial quote with line items", href: "/quotations/new", icon: "📄" },
  { id: "act-new-lead", category: "Quick Action", title: "Record New Lead", subtitle: "Add prospect to commercial funnel", href: "/leads", icon: "🎯" },
  { id: "act-new-invoice", category: "Quick Action", title: "Draft New Invoice", subtitle: "Issue customer billing", href: "/invoices", icon: "💳" },
  { id: "act-new-ticket", category: "Quick Action", title: "Raise Support Ticket", subtitle: "Log an SLA service request", href: "/support", icon: "🎫" },

  // Navigation
  { id: "nav-dash", category: "Navigation", title: "Executive Dashboard", subtitle: "Financial pulse & KPI analytics", href: "/dashboard", icon: "📊" },
  { id: "nav-ai", category: "Navigation", title: "Amiro Intelligence (AI Assistant)", subtitle: "Ask business questions & get insights", href: "/copilot", icon: "🤖" },
  { id: "nav-clients", category: "Navigation", title: "Clients Directory", subtitle: "Client 360° management & accounts", href: "/clients", icon: "👥" },
  { id: "nav-leads", category: "Navigation", title: "Leads & Prospects", subtitle: "CRM pipeline & qualification", href: "/leads", icon: "📈" },
  { id: "nav-contacts", category: "Navigation", title: "Key Contacts & Stakeholders", subtitle: "Directory of client persons", href: "/contacts", icon: "📇" },
  { id: "nav-projects", category: "Navigation", title: "Projects & Operations", subtitle: "Active projects & delivery milestones", href: "/projects", icon: "📁" },
  { id: "nav-quotes", category: "Navigation", title: "Quotations & Proposals", subtitle: "Commercial pricing & approvals", href: "/quotations", icon: "📑" },
  { id: "nav-contracts", category: "Navigation", title: "Contracts & SOWs", subtitle: "Legal agreements & versioning", href: "/contracts", icon: "⚖️" },
  { id: "nav-invoices", category: "Navigation", title: "Invoices & Billing", subtitle: "Issued billings & receivables", href: "/invoices", icon: "🧾" },
  { id: "nav-payments", category: "Navigation", title: "Payments & Collections", subtitle: "Payment ledger & settlements", href: "/payments", icon: "💵" },
  { id: "nav-reports", category: "Navigation", title: "Financial Reports", subtitle: "P&L, AR aging, client profitability", href: "/reports/finance", icon: "📉" },
  { id: "nav-portal", category: "Navigation", title: "Client Portal View", subtitle: "Open client-facing workspace", href: "/portal", icon: "🌐" },
  { id: "nav-settings", category: "Navigation", title: "Platform Settings", subtitle: "Company branding & configuration", href: "/settings", icon: "⚙️" }
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState<CommandItem[]>([]);
  const router = useRouter();

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Live query search across records
  useEffect(() => {
    if (!query.trim()) {
      setLiveResults(defaultCommands);
      return;
    }

    const q = query.toLowerCase();

    // Filter static commands
    const matchedStatic = defaultCommands.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.subtitle && c.subtitle.toLowerCase().includes(q))
    );

    // Also search live records
    let isCancelled = false;
    Promise.all([
      clientService.getClients().catch(() => []),
      projectService.getProjects().catch(() => []),
      quotationService.getQuotations().catch(() => []),
      invoiceService.getInvoices().catch(() => [])
    ]).then(([clients, projects, quotations, invoices]) => {
      if (isCancelled) return;

      const dynamicItems: CommandItem[] = [];

      clients
        .filter((c) => c.company_name.toLowerCase().includes(q) || c.contact_person?.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((c) => {
          dynamicItems.push({
            id: `client-${c.id}`,
            category: "Clients",
            title: c.company_name,
            subtitle: `Client • ${c.contact_person || "Account"}`,
            href: `/clients/${c.id}`,
            icon: "🏢"
          });
        });

      projects
        .filter((p) => p.project_name.toLowerCase().includes(q) || p.project_code.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((p) => {
          dynamicItems.push({
            id: `proj-${p.id}`,
            category: "Projects",
            title: p.project_name,
            subtitle: `Project #${p.project_code} • ${p.status}`,
            href: `/projects/${p.id}`,
            icon: "📁"
          });
        });

      quotations
        .filter((qt) => qt.quotation_number.toLowerCase().includes(q) || qt.title?.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((qt) => {
          dynamicItems.push({
            id: `quote-${qt.id}`,
            category: "Quotations",
            title: qt.quotation_number,
            subtitle: `Quotation • ${qt.title || "Proposal"}`,
            href: `/quotations/${qt.id}`,
            icon: "📑"
          });
        });

      invoices
        .filter((inv) => inv.invoice_number.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((inv) => {
          dynamicItems.push({
            id: `inv-${inv.id}`,
            category: "Invoices",
            title: inv.invoice_number,
            subtitle: `Invoice • Status: ${inv.status}`,
            href: `/invoices/${inv.id}`,
            icon: "🧾"
          });
        });

      setLiveResults([...matchedStatic, ...dynamicItems]);
      setSelectedIndex(0);
    });

    return () => {
      isCancelled = true;
    };
  }, [query]);

  function handleSelect(item: CommandItem) {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }

  function handleKeyDownNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, liveResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + liveResults.length) % Math.max(1, liveResults.length));
    } else if (e.key === "Enter" && liveResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(liveResults[selectedIndex]);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={() => setIsOpen(false)}>
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDownNav}
      >
        <div className="command-palette-input-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            type="text"
            className="command-palette-input"
            placeholder="Type a command, client, invoice, or route..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="command-palette-esc" onClick={() => setIsOpen(false)}>ESC</kbd>
        </div>

        <div className="command-palette-results">
          {liveResults.length === 0 ? (
            <div className="command-palette-empty">
              <p>No results found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            liveResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`command-item ${isSelected ? "selected" : ""}`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => handleSelect(item)}
                >
                  <span className="command-icon">{item.icon || "•"}</span>
                  <div className="command-text-wrap">
                    <span className="command-title">{item.title}</span>
                    {item.subtitle && <span className="command-subtitle">{item.subtitle}</span>}
                  </div>
                  <span className="command-category-tag">{item.category}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span>Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to select</span>
          <span><kbd>ESC</kbd> to dismiss</span>
        </div>
      </div>
    </div>
  );
}
