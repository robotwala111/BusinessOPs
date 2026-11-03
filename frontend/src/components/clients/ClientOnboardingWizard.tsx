"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { projectService } from "@/services/projectService";
import { formatCurrency } from "@/utils/formatCurrency";
import type { Client } from "@/types/client";

interface OnboardingState {
  // Step 1: Company
  companyName: string;
  clientShortName: string;
  industry: string;
  gstNumber: string;
  cinNumber: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;

  // Step 2: Contacts
  primaryContactName: string;
  primaryDesignation: string;
  primaryPhone: string;
  primaryEmail: string;
  billingContactName: string;
  billingContactEmail: string;

  // Step 3: Scope & Requirements
  services: string[];
  objectives: string;
  scopeSummary: string;

  // Step 4: Commercial Terms
  contractValue: number;
  paymentTerms: string;
  billingCycle: string;
  taxPercentage: number;

  // Step 5: Documents
  ndaSigned: boolean;
  msaSigned: boolean;
  proposalRef: string;
  documentNotes: string;

  // Step 6: Project Configuration
  projectName: string;
  targetEndDate: string;
  assignedManager: string;
  priority: "low" | "medium" | "high" | "urgent";
  milestoneTitle: string;
}

const defaultState: OnboardingState = {
  companyName: "",
  clientShortName: "",
  industry: "Technology & Software",
  gstNumber: "",
  cinNumber: "",
  website: "",
  address: "",
  city: "Bangalore",
  state: "Karnataka",
  country: "India",

  primaryContactName: "",
  primaryDesignation: "Director of Technology",
  primaryPhone: "",
  primaryEmail: "",
  billingContactName: "",
  billingContactEmail: "",

  services: ["Custom SaaS Development", "Cloud & DevOps"],
  objectives: "",
  scopeSummary: "",

  contractValue: 250000,
  paymentTerms: "Net 30",
  billingCycle: "Milestone-based",
  taxPercentage: 18,

  ndaSigned: true,
  msaSigned: false,
  proposalRef: "PROP-2026-001",
  documentNotes: "",

  projectName: "",
  targetEndDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  assignedManager: "Amiro Operations Lead",
  priority: "high",
  milestoneTitle: "Discovery & Architecture Blueprint"
};

const STORAGE_KEY = "amiro-client-onboarding-draft";

const STEPS = [
  { num: 1, title: "Company Profile", subtitle: "Identity & Registration" },
  { num: 2, title: "Key Contacts", subtitle: "Stakeholders & Billing" },
  { num: 3, title: "Requirements", subtitle: "Services & Scope" },
  { num: 4, title: "Commercials", subtitle: "Value, Terms & Tax" },
  { num: 5, title: "Agreements", subtitle: "NDA, MSA & Legal" },
  { num: 6, title: "Initial Project", subtitle: "Delivery & Milestones" },
  { num: 7, title: "Review & Activate", subtitle: "Validation & Launch" }
];

export function ClientOnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<OnboardingState>(defaultState);
  const [existingClients, setExistingClients] = useState<Client[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavedDraft, setIsSavedDraft] = useState(false);
  const router = useRouter();

  // Load draft from localStorage & fetch existing clients for duplicate checking
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setForm(JSON.parse(saved) as OnboardingState);
      } catch {
        // ignore parse error
      }
    }
    clientService.getClients().then(setExistingClients).catch(() => []);
  }, []);

  function saveDraft() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    setIsSavedDraft(true);
    setTimeout(() => setIsSavedDraft(false), 2500);
  }

  function handleFieldChange<K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setErrorMsg("");
  }

  function toggleService(service: string) {
    const exists = form.services.includes(service);
    const updated = exists ? form.services.filter((s) => s !== service) : [...form.services, service];
    handleFieldChange("services", updated);
  }

  function validateCurrentStep(): boolean {
    if (currentStep === 1) {
      if (!form.companyName.trim()) {
        setErrorMsg("Company name is required.");
        return false;
      }
      // Check duplicates
      const isDuplicate = existingClients.some(
        (c) => c.company_name.trim().toLowerCase() === form.companyName.trim().toLowerCase()
      );
      if (isDuplicate) {
        setErrorMsg(`An account named "${form.companyName}" already exists in the system.`);
        return false;
      }
    } else if (currentStep === 2) {
      if (!form.primaryContactName.trim()) {
        setErrorMsg("Primary contact person's name is required.");
        return false;
      }
      if (!form.primaryEmail.trim() || !form.primaryEmail.includes("@")) {
        setErrorMsg("A valid primary email address is required.");
        return false;
      }
    } else if (currentStep === 4) {
      if (form.contractValue <= 0) {
        setErrorMsg("Estimated contract value must be greater than zero.");
        return false;
      }
    } else if (currentStep === 6) {
      if (!form.projectName.trim()) {
        // Default to company name + Phase 1 if empty
        handleFieldChange("projectName", `${form.companyName} – Enterprise Implementation`);
      }
    }
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setErrorMsg("");
    setCurrentStep((prev) => Math.min(STEPS.length, prev + 1));
  }

  function prevStep() {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  async function handleFinalActivation() {
    if (!validateCurrentStep()) return;
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // 1. Create the Client Organization
      const newClient = await clientService.createClient({
        company_name: form.companyName.trim(),
        client_short_name: form.clientShortName.trim() || form.companyName.slice(0, 8).toUpperCase(),
        contact_person: form.primaryContactName.trim(),
        email: form.primaryEmail.trim(),
        phone: form.primaryPhone.trim(),
        gst_number: form.gstNumber.trim(),
        pan_number: form.cinNumber.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        industry: form.industry,
        status: "active",
        notes: `Services: ${form.services.join(", ")}. Objectives: ${form.objectives}. Payment Terms: ${form.paymentTerms}. Proposal: ${form.proposalRef}.`,
        payment_terms: form.paymentTerms,
        lead_source: "Enterprise Onboarding Wizard",
        created_by: null
      });

      // 2. Create the Primary Contact
      if (newClient?.id) {
        await contactService.createContact({
          client_id: newClient.id,
          full_name: form.primaryContactName.trim(),
          designation: form.primaryDesignation.trim(),
          email: form.primaryEmail.trim(),
          phone: form.primaryPhone.trim(),
          is_primary: true,
          is_billing_contact: true,
          is_project_contact: true,
          department: "Executive & Tech",
          whatsapp: form.primaryPhone.trim(),
          notes: "",
          created_by: null
        }).catch(() => null);

        // 3. Create initial Project
        const projectName = form.projectName.trim() || `${form.companyName} – Enterprise Operations`;
        await projectService.createProject({
          client_id: newClient.id,
          project_name: projectName,
          project_code: `PRJ-${Date.now().toString().slice(-4)}`,
          project_type: form.services[0] || "Custom Implementation",
          description: form.scopeSummary || `Scope of work for ${form.companyName}. Objectives: ${form.objectives}`,
          status: "planned",
          project_value: form.contractValue,
          priority: form.priority,
          start_date: new Date().toISOString().slice(0, 10),
          target_end_date: form.targetEndDate,
          actual_end_date: "",
          assigned_manager: form.assignedManager,
          tags: "onboarding, initial-setup",
          notes: "",
          created_by: null
        }).catch(() => null);
      }

      // Clear draft
      window.localStorage.removeItem(STORAGE_KEY);

      // Redirect directly to client 360 profile
      router.push(`/clients/${newClient.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to complete onboarding. Please verify details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="onboarding-wizard-container">
      {/* Top Banner Header */}
      <div className="wizard-hero-banner">
        <div className="wizard-hero-left">
          <Link href="/clients" className="wizard-back-link">
            &larr; Back to Clients Directory
          </Link>
          <h1 className="wizard-hero-title">Client Onboarding Wizard</h1>
          <p className="wizard-hero-sub">
            Guided 7-step enterprise onboarding for Amiro Tech Solutions. Pre-configures commercial terms, legal contracts, stakeholders, and delivery milestones.
          </p>
        </div>
        <div className="wizard-hero-actions">
          <button type="button" className="wizard-draft-btn" onClick={saveDraft}>
            {isSavedDraft ? "✓ Draft Saved" : "💾 Save Draft"}
          </button>
        </div>
      </div>

      {/* 7-Step Navigation Progress Bar */}
      <div className="wizard-steps-track">
        {STEPS.map((s) => {
          const isCurrent = s.num === currentStep;
          const isDone = s.num < currentStep;
          return (
            <div
              key={s.num}
              className={`wizard-step-node ${isCurrent ? "active" : ""} ${isDone ? "done" : ""}`}
              onClick={() => {
                if (s.num <= currentStep) setCurrentStep(s.num);
              }}
            >
              <div className="step-circle">
                {isDone ? "✓" : s.num}
              </div>
              <div className="step-labels">
                <span className="step-title">{s.title}</span>
                <small className="step-subtitle">{s.subtitle}</small>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="wizard-error-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step Panels */}
      <div className="wizard-card-body">
        {/* STEP 1: Company Information */}
        {currentStep === 1 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 1: Company Profile & Registration</h3>
              <p>Enter legal entity details, industry domain, and official registered address.</p>
            </div>

            <div className="wizard-form-grid">
              <div className="form-field-full">
                <label>Company Legal Name *</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. Acme FinTech Technologies Pvt Ltd"
                  value={form.companyName}
                  onChange={(e) => handleFieldChange("companyName", e.target.value)}
                />
              </div>

              <div>
                <label>Short Code / Acronym</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. ACME"
                  value={form.clientShortName}
                  onChange={(e) => handleFieldChange("clientShortName", e.target.value)}
                />
              </div>

              <div>
                <label>Industry Vertical</label>
                <select
                  className="input-base"
                  value={form.industry}
                  onChange={(e) => handleFieldChange("industry", e.target.value)}
                >
                  <option value="Technology & Software">Technology & Software</option>
                  <option value="Fintech & Banking">Fintech & Banking</option>
                  <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                  <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                  <option value="Manufacturing & Logistics">Manufacturing & Logistics</option>
                  <option value="Education & EdTech">Education & EdTech</option>
                  <option value="Other">Other Enterprise</option>
                </select>
              </div>

              <div>
                <label>GSTIN Number</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="29AAAAA0000A1Z5"
                  value={form.gstNumber}
                  onChange={(e) => handleFieldChange("gstNumber", e.target.value)}
                />
              </div>

              <div>
                <label>CIN / Registration Number</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="U72200KA2020PTC123456"
                  value={form.cinNumber}
                  onChange={(e) => handleFieldChange("cinNumber", e.target.value)}
                />
              </div>

              <div className="form-field-full">
                <label>Website URL</label>
                <input
                  type="url"
                  className="input-base"
                  placeholder="https://www.example.com"
                  value={form.website}
                  onChange={(e) => handleFieldChange("website", e.target.value)}
                />
              </div>

              <div className="form-field-full">
                <label>Registered Office Address</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Suite 500, Prestige Tech Park, Outer Ring Road"
                  value={form.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                />
              </div>

              <div>
                <label>City</label>
                <input
                  type="text"
                  className="input-base"
                  value={form.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                />
              </div>

              <div>
                <label>State & Country</label>
                <input
                  type="text"
                  className="input-base"
                  value={`${form.state}, ${form.country}`}
                  onChange={(e) => handleFieldChange("state", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Key Contacts */}
        {currentStep === 2 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 2: Key Stakeholders & Billing Contact</h3>
              <p>Identify the primary project sponsor and the designated accounts coordinator.</p>
            </div>

            <div className="wizard-form-grid">
              <div className="form-section-banner form-field-full">
                <strong>Primary Executive Stakeholder</strong>
              </div>

              <div>
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. Ramesh Kumar"
                  value={form.primaryContactName}
                  onChange={(e) => handleFieldChange("primaryContactName", e.target.value)}
                />
              </div>

              <div>
                <label>Designation / Role</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. VP of Engineering"
                  value={form.primaryDesignation}
                  onChange={(e) => handleFieldChange("primaryDesignation", e.target.value)}
                />
              </div>

              <div>
                <label>Direct Work Email *</label>
                <input
                  type="email"
                  className="input-base"
                  placeholder="ramesh@company.com"
                  value={form.primaryEmail}
                  onChange={(e) => handleFieldChange("primaryEmail", e.target.value)}
                />
              </div>

              <div>
                <label>Phone / WhatsApp</label>
                <input
                  type="tel"
                  className="input-base"
                  placeholder="+91 98765 43210"
                  value={form.primaryPhone}
                  onChange={(e) => handleFieldChange("primaryPhone", e.target.value)}
                />
              </div>

              <div className="form-section-banner form-field-full">
                <strong>Finance & Billing Coordinator (Invoicing)</strong>
              </div>

              <div>
                <label>Billing Contact Name</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="e.g. Accounts Payables"
                  value={form.billingContactName}
                  onChange={(e) => handleFieldChange("billingContactName", e.target.value)}
                />
              </div>

              <div>
                <label>Billing Email</label>
                <input
                  type="email"
                  className="input-base"
                  placeholder="invoices@company.com"
                  value={form.billingContactEmail}
                  onChange={(e) => handleFieldChange("billingContactEmail", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Business Requirements */}
        {currentStep === 3 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 3: Business Requirements & Scope</h3>
              <p>Select required capabilities and summarize client goals.</p>
            </div>

            <div className="services-selection-grid">
              {[
                "Custom SaaS Development",
                "Cloud & DevOps Architecture",
                "AI & Intelligence Integration",
                "Annual Maintenance Contract (AMC)",
                "Security & Compliance Audit",
                "Mobile App Development"
              ].map((service) => {
                const checked = form.services.includes(service);
                return (
                  <label
                    key={service}
                    className={`service-checkbox-card ${checked ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(service)}
                    />
                    <div className="service-card-info">
                      <strong>{service}</strong>
                      <small>Enterprise delivery service</small>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="wizard-form-grid" style={{ marginTop: 20 }}>
              <div className="form-field-full">
                <label>Business Objectives & Success Metrics</label>
                <textarea
                  className="input-base"
                  rows={3}
                  placeholder="What is the client looking to achieve? (e.g. 99.9% uptime, reduce processing time by 40%, launch V1 MVP by Q3)"
                  value={form.objectives}
                  onChange={(e) => handleFieldChange("objectives", e.target.value)}
                />
              </div>

              <div className="form-field-full">
                <label>Scope of Work (SOW Summary)</label>
                <textarea
                  className="input-base"
                  rows={3}
                  placeholder="High-level milestones, architectural deliverables, and technology stack expectations..."
                  value={form.scopeSummary}
                  onChange={(e) => handleFieldChange("scopeSummary", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Commercial Terms */}
        {currentStep === 4 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 4: Commercial Terms & Pricing Structure</h3>
              <p>Define contract valuation, billing frequency, and payment terms.</p>
            </div>

            <div className="wizard-form-grid">
              <div>
                <label>Estimated Total Contract Value (INR) *</label>
                <input
                  type="number"
                  className="input-base"
                  value={form.contractValue}
                  onChange={(e) => handleFieldChange("contractValue", Number(e.target.value) || 0)}
                />
                <small className="field-hint">
                  Preview: {formatCurrency(form.contractValue)}
                </small>
              </div>

              <div>
                <label>Payment Terms</label>
                <select
                  className="input-base"
                  value={form.paymentTerms}
                  onChange={(e) => handleFieldChange("paymentTerms", e.target.value)}
                >
                  <option value="Net 15">Net 15 Days</option>
                  <option value="Net 30">Net 30 Days (Standard)</option>
                  <option value="Net 45">Net 45 Days</option>
                  <option value="50% Upfront, 50% on Delivery">50% Advance / 50% Completion</option>
                  <option value="Immediate Due">Due on Receipt</option>
                </select>
              </div>

              <div>
                <label>Billing Cycle Frequency</label>
                <select
                  className="input-base"
                  value={form.billingCycle}
                  onChange={(e) => handleFieldChange("billingCycle", e.target.value)}
                >
                  <option value="Milestone-based">Milestone Completion</option>
                  <option value="Monthly Retainer">Monthly Retainer</option>
                  <option value="Quarterly in Advance">Quarterly Advance</option>
                  <option value="One-time Fixed Price">One-time Fixed Fee</option>
                </select>
              </div>

              <div>
                <label>Applicable Tax Rate</label>
                <select
                  className="input-base"
                  value={form.taxPercentage}
                  onChange={(e) => handleFieldChange("taxPercentage", Number(e.target.value))}
                >
                  <option value={18}>18% GST (Standard)</option>
                  <option value={0}>0% (Export of Services / SEZ)</option>
                  <option value={12}>12% GST</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Documents & Agreements */}
        {currentStep === 5 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 5: Legal Agreements & Compliance</h3>
              <p>Record status of mutual non-disclosure and master service agreements.</p>
            </div>

            <div className="agreements-status-list">
              <label className="agreement-toggle-row">
                <input
                  type="checkbox"
                  checked={form.ndaSigned}
                  onChange={(e) => handleFieldChange("ndaSigned", e.target.checked)}
                />
                <div className="agreement-text">
                  <strong>Mutual Non-Disclosure Agreement (NDA) Executed</strong>
                  <small>Protects intellectual property, confidential technical data, and trade secrets.</small>
                </div>
                <span className={`status-pill ${form.ndaSigned ? "pill-active" : "pill-muted"}`}>
                  {form.ndaSigned ? "Executed" : "Pending"}
                </span>
              </label>

              <label className="agreement-toggle-row">
                <input
                  type="checkbox"
                  checked={form.msaSigned}
                  onChange={(e) => handleFieldChange("msaSigned", e.target.checked)}
                />
                <div className="agreement-text">
                  <strong>Master Services Agreement (MSA) Countersigned</strong>
                  <small>Establishes enterprise governance, liability limits, and dispute jurisdiction.</small>
                </div>
                <span className={`status-pill ${form.msaSigned ? "pill-active" : "pill-muted"}`}>
                  {form.msaSigned ? "Signed" : "Draft Prepared"}
                </span>
              </label>
            </div>

            <div className="wizard-form-grid" style={{ marginTop: 20 }}>
              <div>
                <label>Commercial Proposal Reference #</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="PROP-2026-001"
                  value={form.proposalRef}
                  onChange={(e) => handleFieldChange("proposalRef", e.target.value)}
                />
              </div>

              <div>
                <label>Document Compliance Notes</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Stored in cloud documents folder"
                  value={form.documentNotes}
                  onChange={(e) => handleFieldChange("documentNotes", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Project Configuration */}
        {currentStep === 6 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 6: Delivery Project Configuration</h3>
              <p>Configure the initial project workspace, timeline, and delivery lead.</p>
            </div>

            <div className="wizard-form-grid">
              <div className="form-field-full">
                <label>Initial Project Name *</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder={`${form.companyName || "Client"} – Core Operations Platform`}
                  value={form.projectName}
                  onChange={(e) => handleFieldChange("projectName", e.target.value)}
                />
              </div>

              <div>
                <label>Target Delivery Completion Date</label>
                <input
                  type="date"
                  className="input-base"
                  value={form.targetEndDate}
                  onChange={(e) => handleFieldChange("targetEndDate", e.target.value)}
                />
              </div>

              <div>
                <label>Assigned Delivery Lead</label>
                <input
                  type="text"
                  className="input-base"
                  value={form.assignedManager}
                  onChange={(e) => handleFieldChange("assignedManager", e.target.value)}
                />
              </div>

              <div>
                <label>Operational Priority</label>
                <select
                  className="input-base"
                  value={form.priority}
                  onChange={(e) => handleFieldChange("priority", e.target.value as OnboardingState["priority"])}
                >
                  <option value="urgent">Urgent Priority (High SLA)</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority (Standard)</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label>Phase 1 Milestone Deliverable</label>
                <input
                  type="text"
                  className="input-base"
                  value={form.milestoneTitle}
                  onChange={(e) => handleFieldChange("milestoneTitle", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Review & Activate */}
        {currentStep === 7 && (
          <div className="wizard-step-section">
            <div className="step-section-heading">
              <h3>Step 7: Final Review & Account Activation</h3>
              <p>Confirm the onboarding parameters before initializing the client record and workspace.</p>
            </div>

            <div className="onboarding-summary-deck">
              <div className="summary-block">
                <h5>1. Company Details</h5>
                <div className="summary-row">
                  <span>Name:</span>
                  <strong>{form.companyName}</strong>
                </div>
                <div className="summary-row">
                  <span>Industry:</span>
                  <strong>{form.industry}</strong>
                </div>
                <div className="summary-row">
                  <span>City:</span>
                  <strong>{form.city}, {form.country}</strong>
                </div>
                {form.gstNumber && (
                  <div className="summary-row">
                    <span>GSTIN:</span>
                    <strong>{form.gstNumber}</strong>
                  </div>
                )}
              </div>

              <div className="summary-block">
                <h5>2. Stakeholders</h5>
                <div className="summary-row">
                  <span>Primary:</span>
                  <strong>{form.primaryContactName} ({form.primaryDesignation})</strong>
                </div>
                <div className="summary-row">
                  <span>Email:</span>
                  <strong>{form.primaryEmail}</strong>
                </div>
                {form.primaryPhone && (
                  <div className="summary-row">
                    <span>Phone:</span>
                    <strong>{form.primaryPhone}</strong>
                  </div>
                )}
              </div>

              <div className="summary-block">
                <h5>3. Scope & Commercials</h5>
                <div className="summary-row">
                  <span>Contract Value:</span>
                  <strong className="text-emerald">{formatCurrency(form.contractValue)}</strong>
                </div>
                <div className="summary-row">
                  <span>Terms:</span>
                  <strong>{form.paymentTerms} ({form.billingCycle})</strong>
                </div>
                <div className="summary-row">
                  <span>Services:</span>
                  <strong>{form.services.join(", ")}</strong>
                </div>
              </div>

              <div className="summary-block">
                <h5>4. Project & Launch</h5>
                <div className="summary-row">
                  <span>Initial Project:</span>
                  <strong>{form.projectName || `${form.companyName} Implementation`}</strong>
                </div>
                <div className="summary-row">
                  <span>Target Date:</span>
                  <strong>{form.targetEndDate}</strong>
                </div>
                <div className="summary-row">
                  <span>Priority:</span>
                  <strong className="text-amber uppercase">{form.priority}</strong>
                </div>
              </div>
            </div>

            <div className="activation-callout">
              <div className="callout-icon">🚀</div>
              <div className="callout-text">
                <strong>Ready for Launch</strong>
                <p>
                  Clicking &ldquo;Activate Client&rdquo; will create the organization profile, establish contact directory records, initialize the project workspace, and unlock client portal access.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Navigation Footer */}
        <div className="wizard-navigation-bar">
          {currentStep > 1 ? (
            <button
              type="button"
              className="wizard-btn-secondary"
              onClick={prevStep}
              disabled={isSubmitting}
            >
              &larr; Previous Step
            </button>
          ) : <div />}

          <div className="wizard-right-actions">
            <button
              type="button"
              className="wizard-btn-ghost"
              onClick={saveDraft}
            >
              Save Draft
            </button>

            {currentStep < STEPS.length ? (
              <button
                type="button"
                className="wizard-btn-primary"
                onClick={nextStep}
              >
                Continue to Step {currentStep + 1} &rarr;
              </button>
            ) : (
              <button
                type="button"
                className="wizard-btn-activate"
                onClick={handleFinalActivation}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Activating Client..." : "✓ Activate Client Organization"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
