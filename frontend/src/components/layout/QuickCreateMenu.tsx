"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function QuickCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="quick-create-container" ref={menuRef}>
      <button
        type="button"
        className="quick-create-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>Create</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="quick-create-dropdown">
          <div className="dropdown-section-title">Client & CRM</div>
          <Link
            href="/clients/onboard"
            className="dropdown-menu-item highlighted"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">✨</span>
            <div className="dropdown-item-text">
              <strong>Onboard Client (Wizard)</strong>
              <small>7-step guided enterprise setup</small>
            </div>
          </Link>
          <Link
            href="/clients/new"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">🏢</span>
            <div className="dropdown-item-text">
              <strong>Quick Client</strong>
              <small>Standard organization entry</small>
            </div>
          </Link>
          <Link
            href="/leads"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">🎯</span>
            <div className="dropdown-item-text">
              <strong>New Lead</strong>
              <small>Prospect qualification</small>
            </div>
          </Link>

          <div className="dropdown-divider" />
          <div className="dropdown-section-title">Commercial & Operations</div>
          <Link
            href="/quotations/new"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">📑</span>
            <div className="dropdown-item-text">
              <strong>New Quotation</strong>
              <small>Commercial proposal</small>
            </div>
          </Link>
          <Link
            href="/projects"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">📁</span>
            <div className="dropdown-item-text">
              <strong>New Project</strong>
              <small>Delivery & milestones</small>
            </div>
          </Link>
          <Link
            href="/support"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">🎫</span>
            <div className="dropdown-item-text">
              <strong>Support Ticket</strong>
              <small>SLA issue tracking</small>
            </div>
          </Link>

          <div className="dropdown-divider" />
          <div className="dropdown-section-title">Finance</div>
          <Link
            href="/invoices"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">🧾</span>
            <div className="dropdown-item-text">
              <strong>Draft Invoice</strong>
              <small>Client billing</small>
            </div>
          </Link>
          <Link
            href="/expenses"
            className="dropdown-menu-item"
            onClick={() => setIsOpen(false)}
          >
            <span className="dropdown-item-icon">💳</span>
            <div className="dropdown-item-text">
              <strong>Record Expense</strong>
              <small>Operational burn entry</small>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
