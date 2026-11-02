"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { quotationStatusLabels } from "@/components/quotations/quotationLabels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useClients } from "@/hooks/useClients";
import {
  calculateQuotationTotals,
  quotationService
} from "@/services/quotationService";
import { settingsService } from "@/services/settingsService";
import {
  QUOTATION_STATUSES,
  type Quotation,
  type QuotationFormData,
  type QuotationItemFormData
} from "@/types/quotation";
import { formatCurrency } from "@/utils/formatCurrency";

const defaultItem: QuotationItemFormData = {
  description: "",
  quantity: 1,
  unit_price: 0
};

const defaultFormData: QuotationFormData = {
  quotation_number: "",
  client_id: "",
  project_id: "",
  title: "",
  quotation_date: new Date().toISOString().slice(0, 10),
  valid_until: "",
  status: "draft",
  discount_rate: 0,
  tax_rate: 18,
  project_overview: "",
  scope_of_work: "",
  tech_stack: "",
  project_timeline: "",
  payment_terms: "50% advance payment, balance on completion.",
  support_and_maintenance: "",
  notes: "",
  terms_and_conditions:
    "This quotation is valid until the date shown above. Scope changes may require revised pricing.",
  items: [{ ...defaultItem }]
};

type QuotationFormProps = {
  quotation?: Quotation | null;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (data: QuotationFormData) => Promise<void>;
};

function getInitialFormData(quotation?: Quotation | null): QuotationFormData {
  if (!quotation) {
    return defaultFormData;
  }

  return {
    quotation_number: quotation.quotation_number,
    client_id: quotation.client_id,
    project_id: quotation.project_id ?? "",
    title: quotation.title,
    quotation_date: quotation.quotation_date,
    valid_until: quotation.valid_until ?? "",
    status: quotation.status,
    discount_rate: quotation.discount_rate,
    tax_rate: quotation.tax_rate,
    project_overview: quotation.project_overview ?? "",
    scope_of_work: quotation.scope_of_work ?? "",
    tech_stack: quotation.tech_stack ?? "",
    project_timeline: quotation.project_timeline ?? "",
    payment_terms: quotation.payment_terms ?? "",
    support_and_maintenance: quotation.support_and_maintenance ?? "",
    notes: quotation.notes ?? "",
    terms_and_conditions: quotation.terms_and_conditions ?? "",
    items:
      quotation.items.length > 0
        ? quotation.items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price
          }))
        : [{ ...defaultItem }]
  };
}

export function QuotationForm({
  quotation,
  submitLabel,
  isSubmitting = false,
  onSubmit
}: QuotationFormProps) {
  const [formData, setFormData] = useState<QuotationFormData>(
    getInitialFormData(quotation)
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(!quotation);
  const { clients, isLoading: isLoadingClients } = useClients();

  useEffect(() => {
    if (quotation) {
      return;
    }

    async function loadDefaults() {
      const settings = await settingsService.getEffectiveCompanySettings();
      setFormData((currentData) => ({
        ...currentData,
        tax_rate: settings.default_tax_percentage
      }));
    }

    void loadDefaults();

    async function loadQuotationNumber() {
      try {
        const number = await quotationService.generateQuotationNumber();
        setFormData((currentData) => ({
          ...currentData,
          quotation_number: number
        }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to generate quotation number."
        );
      } finally {
        setIsGeneratingNumber(false);
      }
    }

    void loadQuotationNumber();
  }, [quotation]);

  const totals = useMemo(
    () =>
      calculateQuotationTotals(
        formData.items,
        formData.discount_rate,
        formData.tax_rate
      ),
    [formData.discount_rate, formData.items, formData.tax_rate]
  );

  function updateField<Key extends keyof QuotationFormData>(
    key: Key,
    value: QuotationFormData[Key]
  ) {
    setFormData((currentData) => ({
      ...currentData,
      [key]: value
    }));
  }

  function updateItem(
    index: number,
    key: keyof QuotationItemFormData,
    value: string | number
  ) {
    setFormData((currentData) => ({
      ...currentData,
      items: currentData.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  }

  function addItem() {
    setFormData((currentData) => ({
      ...currentData,
      items: [...currentData.items, { ...defaultItem }]
    }));
  }

  function removeItem(index: number) {
    setFormData((currentData) => ({
      ...currentData,
      items:
        currentData.items.length === 1
          ? [{ ...defaultItem }]
          : currentData.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!formData.quotation_number.trim()) {
      setErrorMessage("Quotation number is required.");
      return;
    }

    if (!formData.client_id) {
      setErrorMessage("Select a client.");
      return;
    }

    if (!formData.title.trim()) {
      setErrorMessage("Quotation title is required.");
      return;
    }

    const validItems = formData.items.filter((item) => item.description.trim());

    if (validItems.length === 0) {
      setErrorMessage("Add at least one quotation item.");
      return;
    }

    if (
      validItems.some(
        (item) => Number(item.quantity) <= 0 || Number(item.unit_price) < 0
      )
    ) {
      setErrorMessage("Item quantity must be positive and price cannot be negative.");
      return;
    }

    await onSubmit({
      ...formData,
      title: formData.title.trim(),
      quotation_number: formData.quotation_number.trim(),
      items: validItems.map((item) => ({
        ...item,
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price)
      }))
    });
  }

  return (
    <Card>
      <form className="client-form" onSubmit={handleSubmit}>
        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

        <div className="form-grid two-columns">
          <label>
            Quotation number
            <Input
              value={formData.quotation_number}
              onChange={(event) =>
                updateField("quotation_number", event.target.value)
              }
              disabled={isGeneratingNumber}
              required
            />
          </label>
          <label>
            Client
            <select
              value={formData.client_id}
              onChange={(event) =>
                setFormData((currentData) => ({
                  ...currentData,
                  client_id: event.target.value,
                  project_id: ""
                }))
              }
              disabled={isLoadingClients}
              required
            >
              <option value="">
                {isLoadingClients ? "Loading clients..." : "Select client"}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Project
            <ProjectSelect
              clientId={formData.client_id}
              value={formData.project_id}
              onChange={(projectId) => updateField("project_id", projectId)}
            />
          </label>
          <label>
            Title
            <Input
              value={formData.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
            />
          </label>
          <label>
            Status
            <select
              value={formData.status}
              onChange={(event) =>
                updateField(
                  "status",
                  event.target.value as QuotationFormData["status"]
                )
              }
            >
              {QUOTATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {quotationStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quotation date
            <Input
              type="date"
              value={formData.quotation_date}
              onChange={(event) =>
                updateField("quotation_date", event.target.value)
              }
              required
            />
          </label>
          <label>
            Valid until
            <Input
              type="date"
              value={formData.valid_until}
              onChange={(event) => updateField("valid_until", event.target.value)}
            />
          </label>
        </div>

        <div className="quote-items">
          <div className="quote-items-header">
            <h2>Items</h2>
            <Button type="button" variant="secondary" onClick={addItem}>
              Add Item
            </Button>
          </div>

          {formData.items.map((item, index) => (
            <div className="quote-item-row" key={item.id ?? index}>
              <label>
                Description
                <Input
                  value={item.description}
                  onChange={(event) =>
                    updateItem(index, "description", event.target.value)
                  }
                />
              </label>
              <label>
                Qty
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    updateItem(index, "quantity", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Unit price
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(event) =>
                    updateItem(index, "unit_price", Number(event.target.value))
                  }
                />
              </label>
              <div className="quote-line-total">
                <span>Line total</span>
                <strong>
                  {formatCurrency(Number(item.quantity) * Number(item.unit_price))}
                </strong>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="quote-remove"
                onClick={() => removeItem(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="form-grid two-columns">
          <label>
            Discount %
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.discount_rate}
              onChange={(event) =>
                updateField("discount_rate", Number(event.target.value))
              }
            />
          </label>
          <label>
            Tax %
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formData.tax_rate}
              onChange={(event) =>
                updateField("tax_rate", Number(event.target.value))
              }
            />
          </label>
        </div>

        <div className="quote-summary">
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>
          <div>
            <span>Discount</span>
            <strong>{formatCurrency(totals.discount_amount)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{formatCurrency(totals.tax_amount)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatCurrency(totals.total_amount)}</strong>
          </div>
        </div>

        <label>
          Project overview
          <textarea
            value={formData.project_overview}
            onChange={(event) =>
              updateField("project_overview", event.target.value)
            }
            rows={4}
            placeholder="Write a short paragraph explaining the project background and objective."
          />
        </label>

        <label>
          Scope of work
          <textarea
            value={formData.scope_of_work}
            onChange={(event) => updateField("scope_of_work", event.target.value)}
            rows={5}
            placeholder="Use one line per bullet point or separate points with semicolons."
          />
        </label>

        <label>
          Tech stack
          <textarea
            value={formData.tech_stack}
            onChange={(event) => updateField("tech_stack", event.target.value)}
            rows={4}
            placeholder="Frontend, backend, database, hosting, integrations, and other planned technology."
          />
        </label>

        <label>
          Project timeline
          <textarea
            value={formData.project_timeline}
            onChange={(event) =>
              updateField("project_timeline", event.target.value)
            }
            rows={4}
            placeholder="Phases, estimated duration, delivery schedule, or milestone timeline."
          />
        </label>

        <label>
          Payment terms
          <textarea
            value={formData.payment_terms}
            onChange={(event) => updateField("payment_terms", event.target.value)}
            rows={3}
          />
        </label>

        <label>
          Support and maintenance
          <textarea
            value={formData.support_and_maintenance}
            onChange={(event) =>
              updateField("support_and_maintenance", event.target.value)
            }
            rows={4}
            placeholder="Post-delivery support, warranty, maintenance period, or optional AMC details."
          />
        </label>

        <label>
          Additional notes
          <textarea
            value={formData.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
          />
        </label>
        <label>
          Terms and conditions
          <textarea
            value={formData.terms_and_conditions}
            onChange={(event) =>
              updateField("terms_and_conditions", event.target.value)
            }
            rows={4}
          />
        </label>

        <div className="form-actions">
          <Button type="submit" disabled={isSubmitting || isGeneratingNumber}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
