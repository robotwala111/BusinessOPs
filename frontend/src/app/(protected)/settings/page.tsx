"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useSettings } from "@/hooks/useSettings";
import { resolveCompanySettings } from "@/services/settingsService";
import { settingsService } from "@/services/settingsService";
import type { CompanySettings } from "@/types/settings";

const masterConfigs = [
  { table: "service_catalog", label: "Service Catalog", nameField: "service_name" },
  { table: "document_templates", label: "Document Templates", nameField: "template_name" },
  { table: "standard_terms", label: "Standard Terms", nameField: "title" },
  { table: "payment_milestone_templates", label: "Payment Milestones", nameField: "template_name" },
  { table: "expense_categories", label: "Expense Categories", nameField: "name" },
  { table: "project_types", label: "Project Types", nameField: "name" }
] as const;

const optionGroups = [
  "client_status",
  "project_status",
  "quotation_status",
  "invoice_status",
  "expense_category"
];

type CompanyForm = Pick<
  CompanySettings,
  | "company_name"
  | "legal_name"
  | "email"
  | "phone"
  | "website"
  | "address"
  | "gst_number"
  | "pan_number"
  | "logo_url"
  | "primary_color"
  | "secondary_color"
  | "currency"
  | "default_tax_percentage"
  | "bank_details"
  | "authorized_signatory_name"
  | "default_footer_text"
>;

export default function SettingsPage() {
  const {
    companySettings,
    numberingFormats,
    configurableOptions,
    masters,
    isLoading,
    errorMessage,
    saveCompanySettings,
    saveNumberingFormat,
    createConfigurableOption,
    createMaster,
    loadSettings
  } = useSettings();
  const resolvedSettings = useMemo(
    () => resolveCompanySettings(companySettings),
    [companySettings]
  );
  const [companyForm, setCompanyForm] = useState<CompanyForm>(resolvedSettings);
  const [numberingValues, setNumberingValues] = useState<Record<string, string>>({});
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});
  const [masterValues, setMasterValues] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    setCompanyForm(resolvedSettings);
  }, [resolvedSettings]);

  useEffect(() => {
    setNumberingValues(
      Object.fromEntries(
        numberingFormats.map((format) => [format.document_type, format.prefix])
      )
    );
  }, [numberingFormats]);

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    setSuccessMessage("");
    await saveCompanySettings({
      ...companyForm,
      default_tax_percentage: Number(companyForm.default_tax_percentage)
    });
    await loadSettings();
    setSuccessMessage("Company settings saved.");
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setIsUploadingLogo(true); setSuccessMessage("");
    try {
      const logoUrl = await settingsService.uploadCompanyLogo(file);
      updateCompany("logo_url", logoUrl); await loadSettings();
      setSuccessMessage("Logo uploaded. Quotations, invoices, contracts, and future documents will use this brand.");
    } catch (caught) {
      setSuccessMessage(caught instanceof Error ? caught.message : "Unable to upload logo.");
    } finally { setIsUploadingLogo(false); }
  }

  async function savePrefix(documentType: string) {
    const prefix = numberingValues[documentType]?.trim();

    if (!prefix) {
      return;
    }

    setSuccessMessage("");
    await saveNumberingFormat(documentType, { prefix });
    await loadSettings();
    setSuccessMessage("Numbering format saved.");
  }

  async function addOption(group: string) {
    const label = optionValues[group]?.trim();

    if (!label) {
      return;
    }

    setSuccessMessage("");
    await createConfigurableOption({
      option_group: group,
      option_key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      label,
      sort_order: configurableOptions.filter((option) => option.option_group === group).length + 1,
      is_active: true
    });
    setOptionValues((current) => ({ ...current, [group]: "" }));
    await loadSettings();
    setSuccessMessage("Configuration option added.");
  }

  async function addMaster(table: string, field: string) {
    const value = masterValues[table]?.trim();

    if (!value) {
      return;
    }

    setSuccessMessage("");
    await createMaster(table, {
      [field]: value,
      ...(table === "document_templates" ? { template_type: "quotation", version: 1 } : {}),
      ...(table === "standard_terms" ? { term_type: "payment" } : {}),
      ...(table === "payment_milestone_templates" ? { milestone_name: value, percentage: 0 } : {})
    });
    setMasterValues((current) => ({ ...current, [table]: "" }));
    await loadSettings();
    setSuccessMessage("Master record added.");
  }

  function updateCompany<Key extends keyof CompanyForm>(key: Key, value: CompanyForm[Key]) {
    setCompanyForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <ModuleScaffold
      title="Settings"
      eyebrow="Product Configuration"
      description="Configure company identity, branding, numbering, tax, reusable options, and document foundations."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      {successMessage ? <div className="form-success">{successMessage}</div> : null}

      <Card>
        <form className="settings-form" onSubmit={saveCompany}>
          <h2>Company Profile, Branding, Tax, and Currency</h2>
          <div className="form-grid two-columns">
            <label>Company name<Input value={companyForm.company_name ?? ""} onChange={(event) => updateCompany("company_name", event.target.value)} /></label>
            <label>Legal name<Input value={companyForm.legal_name ?? ""} onChange={(event) => updateCompany("legal_name", event.target.value)} /></label>
            <label>Email<Input value={companyForm.email ?? ""} onChange={(event) => updateCompany("email", event.target.value)} /></label>
            <label>Phone<Input value={companyForm.phone ?? ""} onChange={(event) => updateCompany("phone", event.target.value)} /></label>
            <label>Website<Input value={companyForm.website ?? ""} onChange={(event) => updateCompany("website", event.target.value)} /></label>
            <label>Logo URL<Input value={companyForm.logo_url ?? ""} onChange={(event) => updateCompany("logo_url", event.target.value)} /></label>
            <label>Upload company logo<Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={isUploadingLogo} onChange={(event) => void uploadLogo(event.target.files?.[0])} /><small>{isUploadingLogo ? "Uploading logo…" : "PNG, JPG, WebP or SVG. Maximum 2 MB."}</small></label>
            <label>Primary color<Input type="color" value={companyForm.primary_color ?? "#f4b000"} onChange={(event) => updateCompany("primary_color", event.target.value)} /></label>
            <label>Secondary color<Input type="color" value={companyForm.secondary_color ?? "#111111"} onChange={(event) => updateCompany("secondary_color", event.target.value)} /></label>
            <label>Currency<Input value={companyForm.currency ?? "INR"} onChange={(event) => updateCompany("currency", event.target.value.toUpperCase())} /></label>
            <label>Default tax %<Input type="number" step="0.01" value={companyForm.default_tax_percentage ?? 0} onChange={(event) => updateCompany("default_tax_percentage", Number(event.target.value))} /></label>
            <label>GST / Tax number<Input value={companyForm.gst_number ?? ""} onChange={(event) => updateCompany("gst_number", event.target.value)} /></label>
            <label>PAN / Registration number<Input value={companyForm.pan_number ?? ""} onChange={(event) => updateCompany("pan_number", event.target.value)} /></label>
          </div>
          {companyForm.logo_url ? <div className="brand-preview"><span>Document brand preview</span><Image src={companyForm.logo_url} alt="Company logo preview" width={112} height={112} unoptimized /></div> : null}
          <label>Address<textarea rows={3} value={companyForm.address ?? ""} onChange={(event) => updateCompany("address", event.target.value)} /></label>
          <label>Bank details<textarea rows={3} value={companyForm.bank_details ?? ""} onChange={(event) => updateCompany("bank_details", event.target.value)} /></label>
          <label>Authorized signatory<Input value={companyForm.authorized_signatory_name ?? ""} onChange={(event) => updateCompany("authorized_signatory_name", event.target.value)} /></label>
          <label>Default footer text<textarea rows={2} value={companyForm.default_footer_text ?? ""} onChange={(event) => updateCompany("default_footer_text", event.target.value)} /></label>
          <div className="form-actions"><Button type="submit">Save Company Settings</Button></div>
        </form>
      </Card>

      <Card>
        <h2>Numbering Formats</h2>
        <Table>
          <thead><tr><th>Document</th><th>Prefix</th><th>Format</th><th>Action</th></tr></thead>
          <tbody>
            {numberingFormats.map((format) => (
              <tr key={format.document_type}>
                <td>{format.document_type.replace(/_/g, " ")}</td>
                <td><Input value={numberingValues[format.document_type] ?? ""} onChange={(event) => setNumberingValues((current) => ({ ...current, [format.document_type]: event.target.value.toUpperCase() }))} /></td>
                <td>{`${numberingValues[format.document_type] || format.prefix}-${new Date().getFullYear()}-${"1".padStart(format.padding, "0")}`}</td>
                <td><Button type="button" onClick={() => void savePrefix(format.document_type)}>Save</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <h2>Status and Category Configuration Foundation</h2>
        <div className="settings-grid">
          {optionGroups.map((group) => (
            <div key={group}>
              <h2>{group.replace(/_/g, " ")}</h2>
              <div className="inline-create">
                <Input value={optionValues[group] ?? ""} onChange={(event) => setOptionValues((current) => ({ ...current, [group]: event.target.value }))} placeholder={`Add ${group.replace(/_/g, " ")}`} />
                <Button type="button" onClick={() => void addOption(group)}>Add</Button>
              </div>
              <Table>
                <thead><tr><th>Label</th><th>Status</th></tr></thead>
                <tbody>
                  {configurableOptions.filter((option) => option.option_group === group).map((option) => (
                    <tr key={option.id}><td>{option.label}</td><td>{option.is_active === false ? "Inactive" : "Active"}</td></tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      </Card>

      <div className="settings-grid">
        {masterConfigs.map((config) => (
          <Card key={config.table}>
            <h2>{config.label}</h2>
            <div className="inline-create">
              <Input value={masterValues[config.table] ?? ""} onChange={(event) => setMasterValues((current) => ({ ...current, [config.table]: event.target.value }))} placeholder={`Add ${config.label.toLowerCase()}`} />
              <Button type="button" onClick={() => void addMaster(config.table, config.nameField)}>Add</Button>
            </div>
            <Table>
              <thead><tr><th>Name</th><th>Status</th></tr></thead>
              <tbody>{(masters[config.table] ?? []).map((record) => <tr key={record.id}><td>{record.name ?? record.service_name ?? record.template_name ?? record.title ?? "-"}</td><td>{record.is_active === false ? "Inactive" : "Active"}</td></tr>)}</tbody>
            </Table>
          </Card>
        ))}
      </div>
    </ModuleScaffold>
  );
}
