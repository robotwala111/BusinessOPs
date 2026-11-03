"use client";

import Link from "next/link";
import type { KeyContactSummary } from "@/types/dashboard";

type Props = {
  contacts: KeyContactSummary[];
};

export function KeyStakeholdersRoster({ contacts }: Props) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="empty-roster-state">
        <p>No client contacts recorded yet. Add contacts to see key stakeholders.</p>
        <Link href="/contacts" className="btn btn-sm btn-outline">
          + Add Contact
        </Link>
      </div>
    );
  }

  return (
    <div className="stakeholders-roster-grid">
      {contacts.map((contact) => {
        const initials = contact.fullName
          ? contact.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join("")
          : "ST";

        return (
          <div key={contact.id} className="stakeholder-card">
            <div className="stakeholder-avatar-slot">
              <div className="stakeholder-avatar-circle">
                <span>{initials}</span>
              </div>
              {contact.isPrimary && (
                <span className="primary-star-badge" title="Primary Stakeholder">
                  ★
                </span>
              )}
            </div>

            <div className="stakeholder-info">
              <h5 className="stakeholder-name">{contact.fullName}</h5>
              <span className="stakeholder-role">{contact.designation}</span>
              <span className="stakeholder-company">{contact.companyName}</span>
            </div>

            <div className="stakeholder-actions">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="contact-pill-btn"
                  title={`Email ${contact.email}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  Email
                </a>
              )}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="contact-pill-btn"
                  title={`Call ${contact.phone}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Call
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
