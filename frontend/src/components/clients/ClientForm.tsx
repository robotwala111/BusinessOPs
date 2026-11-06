"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Input } from "@/components/ui/Input";
import { CLIENT_STATUSES, type Client, type ClientFormData } from "@/types/client";
import { clientStatusLabels } from "@/components/clients/clientLabels";
import {
  countryOptions,
  getCityOptions,
  getStateOptions,
  industryOptions,
  leadSourceOptions
} from "@/data/dropdownOptions";

export const DEMO_AUTOFILL_CLIENT: ClientFormData = {
  company_name: "Apex Global Technologies Pvt Ltd",
  client_short_name: "APEX-TECH",
  contact_person: "Rajesh Kumar",
  email: "rajesh.kumar@apextech.com",
  phone: "+91 98490 12345",
  gst_number: "36AAACA1234A1Z5",
  pan_number: "AAACA1234A",
  address: "Plot 42, Silicon Valley Towers, Hitech City, Madhapur",
  city: "Hyderabad",
  state: "Telangana",
  country: "India",
  industry: "Information Technology",
  lead_source: "Partner Referral",
  status: "active",
  notes: "Synthesized via Amiro AI auto-fill. Verified corporate registration details."
};

const defaultFormData: ClientFormData = {
  company_name: "",
  client_short_name: "",
  contact_person: "",
  email: "",
  phone: "",
  gst_number: "",
  pan_number: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  industry: "",
  lead_source: "",
  status: "lead",
  notes: ""
};

type ClientFormProps = {
  client?: Client | null;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (data: ClientFormData) => Promise<void>;
};

function getInitialFormData(client?: Client | null): ClientFormData {
  if (!client) {
    return defaultFormData;
  }

  return {
    company_name: client.company_name,
    client_short_name: client.client_short_name ?? "",
    contact_person: client.contact_person ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    gst_number: client.gst_number ?? "",
    pan_number: client.pan_number ?? "",
    address: client.address ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    country: client.country ?? "India",
    industry: client.industry ?? "",
    lead_source: client.lead_source ?? "",
    status: client.status,
    notes: client.notes ?? ""
  };
}

function isValidEmail(email: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ClientForm({
  client,
  submitLabel,
  isSubmitting = false,
  onSubmit
}: ClientFormProps) {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<ClientFormData>(
    getInitialFormData(client)
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [autofillBanner, setAutofillBanner] = useState(false);
  const [emailVerification, setEmailVerification] = useState<"idle" | "sent" | "verified">("idle");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const stateOptions = getStateOptions(formData.country);
  const cityOptions = getCityOptions(formData.country);

  function updateField<Key extends keyof ClientFormData>(
    key: Key,
    value: ClientFormData[Key]
  ) {
    setFormData((currentData) => ({
      ...currentData,
      [key]: value
    }));
  }

  async function sendEmailVerificationCode() {
    const email = formData.email.trim().toLowerCase();
    if (!isValidEmail(email) || !email) {
      setErrorMessage("Enter a valid email address before requesting a code.");
      return;
    }
    setIsSendingCode(true);
    setErrorMessage("");
    setVerificationMessage("");
    try {
      const response = await fetch("/api/clients/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email })
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to send the verification code.");
      setEmailVerification("sent");
      setVerificationCode("");
      setVerificationMessage(payload.message || "Verification code sent. Check your inbox.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the verification code.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function verifyEmailCode() {
    const email = formData.email.trim().toLowerCase();
    setIsVerifyingCode(true);
    setErrorMessage("");
    setVerificationMessage("");
    try {
      const response = await fetch("/api/clients/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, code: verificationCode })
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to verify this email address.");
      setEmailVerification("verified");
      setVerificationMessage(payload.message || "Email verified.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to verify this email address.");
    } finally {
      setIsVerifyingCode(false);
    }
  }

  useEffect(() => {
    const autofillParam = searchParams?.get("autofill");
    if (autofillParam === "custom" || autofillParam === "true") {
      let custom: Partial<ClientFormData> | null = null;
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("amiro-client-intake-prefill");
        if (raw) {
          try {
            custom = JSON.parse(raw);
          } catch {
            // ignore
          }
        }
      }
      if (custom && custom.company_name) {
        setFormData({
          ...defaultFormData,
          ...DEMO_AUTOFILL_CLIENT,
          ...custom,
          company_name: custom.company_name,
          client_short_name: custom.client_short_name || custom.company_name.split(/\s+/)[0] || "",
          contact_person: custom.contact_person || DEMO_AUTOFILL_CLIENT.contact_person,
          email: custom.email || DEMO_AUTOFILL_CLIENT.email,
          phone: custom.phone || DEMO_AUTOFILL_CLIENT.phone,
          industry: custom.industry || DEMO_AUTOFILL_CLIENT.industry,
          address: custom.address || DEMO_AUTOFILL_CLIENT.address,
          city: custom.city || DEMO_AUTOFILL_CLIENT.city,
          state: custom.state || DEMO_AUTOFILL_CLIENT.state,
          country: custom.country || "India",
          gst_number: custom.gst_number || DEMO_AUTOFILL_CLIENT.gst_number,
          pan_number: custom.pan_number || DEMO_AUTOFILL_CLIENT.pan_number
        });
      } else {
        setFormData(DEMO_AUTOFILL_CLIENT);
      }
      setAutofillBanner(true);
    }
  }, [searchParams]);

  function handleAutoFill() {
    let custom: Partial<ClientFormData> | null = null;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("amiro-client-intake-prefill");
      if (raw) {
        try {
          custom = JSON.parse(raw);
        } catch {
          // ignore
        }
      }
    }
    if (custom && custom.company_name) {
      setFormData({
        ...defaultFormData,
        ...DEMO_AUTOFILL_CLIENT,
        ...custom,
        company_name: custom.company_name,
        client_short_name: custom.client_short_name || custom.company_name.split(/\s+/)[0] || "",
        contact_person: custom.contact_person || DEMO_AUTOFILL_CLIENT.contact_person,
        email: custom.email || DEMO_AUTOFILL_CLIENT.email,
        phone: custom.phone || DEMO_AUTOFILL_CLIENT.phone,
        industry: custom.industry || DEMO_AUTOFILL_CLIENT.industry,
        address: custom.address || DEMO_AUTOFILL_CLIENT.address,
        city: custom.city || DEMO_AUTOFILL_CLIENT.city,
        state: custom.state || DEMO_AUTOFILL_CLIENT.state,
        country: custom.country || "India",
        gst_number: custom.gst_number || DEMO_AUTOFILL_CLIENT.gst_number,
        pan_number: custom.pan_number || DEMO_AUTOFILL_CLIENT.pan_number
      });
    } else {
      setFormData(DEMO_AUTOFILL_CLIENT);
    }
    setAutofillBanner(true);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!formData.company_name.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }

    if ((!client && !formData.email.trim()) || !isValidEmail(formData.email.trim())) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    if (!client && emailVerification !== "verified") {
      setErrorMessage("Verify this email address before creating the client.");
      return;
    }

    await onSubmit({
      ...formData,
      company_name: formData.company_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim()
    });
  }

  return (
    <Card>
      <form className="client-form" onSubmit={handleSubmit}>
        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

        {autofillBanner ? (
          <div
            style={{
              background: "rgba(234, 179, 8, 0.12)",
              border: "1px solid rgba(234, 179, 8, 0.4)",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#fef08a"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>✨</span>
              <div>
                <strong>AI Auto-Fill Active:</strong> Client details for <strong>{formData.company_name || "Enterprise Account"}</strong> have been automatically populated from your AI chat intake. Ready to save without manual typing!
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutofillBanner(false)}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                fontSize: "16px"
              }}
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="form-grid two-columns">
          <label>
            Company name
            <Input
              value={formData.company_name}
              onChange={(event) => updateField("company_name", event.target.value)}
              required
            />
          </label>
          <label>
            Short name
            <Input
              value={formData.client_short_name}
              onChange={(event) =>
                updateField("client_short_name", event.target.value)
              }
            />
          </label>
          <label>
            Contact person
            <Input
              value={formData.contact_person}
              onChange={(event) =>
                updateField("contact_person", event.target.value)
              }
            />
          </label>
          <div className="client-email-verification">
            <label htmlFor="client-email">Email{client ? "" : " *"}</label>
            <Input
              id="client-email"
              type="email"
              value={formData.email}
              required={!client}
              onChange={(event) => {
                updateField("email", event.target.value);
                if (!client) {
                  setEmailVerification("idle");
                  setVerificationCode("");
                  setVerificationMessage("");
                }
              }}
            />
            {!client ? (
              <>
                <div className="client-email-verification-actions">
                  <Button type="button" variant="secondary" disabled={isSendingCode || !formData.email.trim()} onClick={() => void sendEmailVerificationCode()}>
                    {isSendingCode ? "Sending code…" : emailVerification === "sent" ? "Send a new code" : "Verify email"}
                  </Button>
                  {emailVerification === "verified" ? <span className="email-verified-indicator" role="status">✓ Email verified</span> : null}
                </div>
                {emailVerification === "sent" ? (
                  <div className="client-email-code-entry">
                    <label htmlFor="client-email-code">6-digit verification code</label>
                    <div className="client-email-verification-actions">
                      <Input
                        id="client-email-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        aria-label="6-digit email verification code"
                      />
                      <Button type="button" disabled={isVerifyingCode || verificationCode.length !== 6} onClick={() => void verifyEmailCode()}>
                        {isVerifyingCode ? "Checking…" : "Confirm code"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {verificationMessage ? <p className={emailVerification === "verified" ? "form-note" : "muted"} role="status">{verificationMessage}</p> : null}
              </>
            ) : null}
          </div>
          <label>
            Phone
            <Input
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </label>
          <label>
            Status
            <select
              value={formData.status}
              onChange={(event) =>
                updateField("status", event.target.value as ClientFormData["status"])
              }
            >
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {clientStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            GST number
            <Input
              value={formData.gst_number}
              onChange={(event) => updateField("gst_number", event.target.value)}
            />
          </label>
          <label>
            PAN number
            <Input
              value={formData.pan_number}
              onChange={(event) => updateField("pan_number", event.target.value)}
            />
          </label>
          <label>
            City
            <AutocompleteInput
              value={formData.city}
              onChange={(event) => updateField("city", event.target.value)}
              options={cityOptions}
              placeholder="Search city"
            />
          </label>
          <label>
            State
            <AutocompleteInput
              value={formData.state}
              onChange={(event) => updateField("state", event.target.value)}
              options={stateOptions}
              placeholder="Search state"
            />
          </label>
          <label>
            Country
            <AutocompleteInput
              value={formData.country}
              onChange={(event) => updateField("country", event.target.value)}
              options={countryOptions}
              placeholder="Search country"
            />
          </label>
          <label>
            Industry
            <AutocompleteInput
              value={formData.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              options={industryOptions}
              placeholder="Search industry"
            />
          </label>
          <label>
            Lead source
            <AutocompleteInput
              value={formData.lead_source}
              onChange={(event) => updateField("lead_source", event.target.value)}
              options={leadSourceOptions}
              placeholder="Search lead source"
            />
          </label>
        </div>

        <label>
          Address
          <textarea
            value={formData.address}
            onChange={(event) => updateField("address", event.target.value)}
            rows={3}
          />
        </label>

        <label>
          Notes
          <textarea
            value={formData.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={4}
          />
        </label>

        <div
          className="form-actions"
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            justifyContent: "flex-end"
          }}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={handleAutoFill}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <span>✨</span> AI Auto-Fill Form
          </Button>
          <Button type="submit" disabled={isSubmitting || (!client && emailVerification !== "verified")}>
            {isSubmitting ? "Saving..." : !client && emailVerification !== "verified" ? "Verify email to continue" : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
