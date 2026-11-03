import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { clientService } from "@/services/clientService";
import { settingsService } from "@/services/settingsService";
import { historyService } from "@/services/historyService";
import { contractService } from "@/services/contractService";
import { invoiceService } from "@/services/invoiceService";
import { invoiceLineService, type InvoiceLineDraft } from "@/services/invoiceLineService";
import { assertQuotationEditable, nextRevision } from "@/lib/commercialRules";
import { assertTransition } from "@/lib/workflowRules";
import { calculateTax, calculateTaxableAmount, roundMoney } from "@/lib/businessCalculations";
import type { Client } from "@/types/client";
import type {
  Quotation,
  QuotationCreateInput,
  QuotationFormData,
  QuotationItem,
  QuotationItemFormData,
  QuotationTotals,
  QuotationUpdateInput
} from "@/types/quotation";

const DEMO_QUOTATIONS_STORAGE_KEY = "business-ops-demo-quotations";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return supabase;
}

function normalizeText(value: string) {
  return value.trim() === "" ? null : value.trim();
}

function toNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function calculateQuotationTotals(
  items: QuotationItemFormData[],
  discountRate: number,
  taxRate: number
): QuotationTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => {
    const gross = toNumber(item.quantity) * toNumber(item.unit_price);
    return sum + calculateTaxableAmount(gross, gross * Math.max(toNumber(item.discount_rate ?? 0), 0) / 100);
  }, 0));
  const discount_amount = roundMoney(subtotal * (Math.max(toNumber(discountRate), 0) / 100));
  const taxableAmount = calculateTaxableAmount(subtotal, discount_amount);
  const tax_amount = calculateTax(taxableAmount, taxRate, "igst").totalTax;

  return {
    subtotal,
    discount_amount,
    tax_amount,
    total_amount: roundMoney(taxableAmount + tax_amount)
  };
}

function readDemoQuotations(): Quotation[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedQuotations = window.localStorage.getItem(
    DEMO_QUOTATIONS_STORAGE_KEY
  );
  return storedQuotations
    ? (JSON.parse(storedQuotations) as Quotation[])
    : [];
}

function writeDemoQuotations(quotations: Quotation[]) {
  window.localStorage.setItem(
    DEMO_QUOTATIONS_STORAGE_KEY,
    JSON.stringify(quotations)
  );
}

function createItems(
  quotationId: string,
  items: QuotationItemFormData[],
  now: string
): QuotationItem[] {
  return items.map((item, index) => ({
    id: item.id || crypto.randomUUID(),
    quotation_id: quotationId,
    description: item.description.trim(),
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.unit_price),
    line_total: toNumber(item.quantity) * toNumber(item.unit_price),
    unit: item.unit || null,
    hsn_sac: item.hsn_sac || null,
    discount_rate: toNumber(item.discount_rate ?? 0),
    discount_amount: 0,
    taxable_amount: toNumber(item.quantity) * toNumber(item.unit_price),
    sort_order: index,
    created_at: now,
    updated_at: now
  }));
}

function normalizeQuotationPayload(data: QuotationFormData) {
  const items = data.items.filter((item) => item.description.trim());
  const totals = calculateQuotationTotals(
    items,
    data.discount_rate,
    data.tax_rate
  );

  return {
    quotation: {
      quotation_number: data.quotation_number.trim(),
      client_id: data.client_id,
      project_id: data.project_id || null,
      title: data.title.trim(),
      quotation_date: data.quotation_date,
      valid_until: data.valid_until || null,
      status: data.status,
      discount_rate: toNumber(data.discount_rate),
      tax_rate: toNumber(data.tax_rate),
      project_overview: normalizeText(data.project_overview),
      scope_of_work: normalizeText(data.scope_of_work),
      tech_stack: normalizeText(data.tech_stack),
      project_timeline: normalizeText(data.project_timeline),
      payment_terms: normalizeText(data.payment_terms),
      support_and_maintenance: normalizeText(data.support_and_maintenance),
      notes: normalizeText(data.notes),
      terms_and_conditions: normalizeText(data.terms_and_conditions),
      ...totals
    },
    items
  };
}

async function attachClients(quotations: Quotation[]) {
  if (quotations.length === 0) {
    return quotations;
  }

  if (!isSupabaseConfigured) {
    const clients = await clientService.getClients();
    const clientsById = new Map(clients.map((client) => [client.id, client]));

    return quotations.map((quotation) => ({
      ...quotation,
      client: clientsById.get(quotation.client_id) ?? null
    }));
  }

  const clientIds = Array.from(
    new Set(quotations.map((quotation) => quotation.client_id))
  );
  const { data, error } = await requireSupabase()
    .from("clients")
    .select("*")
    .in("id", clientIds);

  if (error) {
    throw error;
  }

  const clientsById = new Map(
    (data as Client[]).map((client) => [client.id, client])
  );

  return quotations.map((quotation) => ({
    ...quotation,
    client: clientsById.get(quotation.client_id) ?? null
  }));
}

export const quotationService = {
  async generateQuotationNumber() {
    const basePrefix = await settingsService.getNumberingPrefix("quotation", "QTN");

    if (!isSupabaseConfigured) {
      const year = new Date().getFullYear();
      const prefix = `${basePrefix}-${year}-`;
      const latestNumber = readDemoQuotations()
        .map((quotation) => quotation.quotation_number)
        .filter((number) => number.startsWith(prefix))
        .sort()
        .at(-1);
      const next = latestNumber ? Number(latestNumber.slice(-4)) + 1 : 1;
      return `${prefix}${String(next).padStart(4, "0")}`;
    }

    const { data, error } = await requireSupabase().rpc("next_document_number", {
      p_document_type: "quotation"
    });

    if (error) {
      throw error;
    }

    return String(data);
  },

  async getQuotations() {
    if (!isSupabaseConfigured) {
      return readDemoQuotations().sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
    }

    const { data, error } = await requireSupabase()
      .from("quotations")
      .select("*, quotation_items(*)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const quotations = (data ?? []).map((quotation) => ({
      ...quotation,
      items: [...(quotation.quotation_items ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      )
    })) as Quotation[];

    return attachClients(quotations);
  },

  async getQuotationById(id: string) {
    if (!isSupabaseConfigured) {
      const quotation =
        readDemoQuotations().find((quotation) => quotation.id === id) ?? null;
      const [quotationWithClient] = await attachClients(
        quotation ? [quotation] : []
      );
      return quotationWithClient ?? null;
    }

    const { data, error } = await requireSupabase()
      .from("quotations")
      .select("*, quotation_items(*), clients(*)")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return {
      ...data,
      client: data.clients,
      items: [...(data.quotation_items ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      )
    } as Quotation;
  },

  async createQuotation(data: QuotationCreateInput) {
    const { quotation, items } = normalizeQuotationPayload(data);

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const createdQuotation: Quotation = {
        id,
        ...quotation,
        created_by: data.created_by,
        revision_number: 1, parent_quotation_id: null, reviewed_at: null,
        approved_at: null, sent_at: null, accepted_at: null, superseded_at: null,
        rejected_reason: null, return_to_draft_reason: null, generated_contract_id: null,
        generated_project_id: null, place_of_supply: null, tax_type: null,
        rounding_amount: 0, archived_at: null, updated_by: data.created_by,
        created_at: now,
        updated_at: now,
        items: createItems(id, items, now)
      };
      writeDemoQuotations([createdQuotation, ...readDemoQuotations()]);
      return createdQuotation;
    }

    const { data: createdQuotation, error } = await requireSupabase()
      .from("quotations")
      .insert({ ...quotation, created_by: data.created_by })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const itemPayload = items.map((item, index) => ({
      quotation_id: createdQuotation.id,
      description: item.description.trim(),
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      line_total: toNumber(item.quantity) * toNumber(item.unit_price),
      sort_order: index
    }));

    if (itemPayload.length > 0) {
      const { error: itemError } = await requireSupabase()
        .from("quotation_items")
        .insert(itemPayload);

      if (itemError) {
        throw itemError;
      }
    }

    return (await this.getQuotationById(createdQuotation.id)) as Quotation;
  },

  async updateQuotation(id: string, data: QuotationUpdateInput) {
    const existing = await this.getQuotationById(id);

    if (!existing) {
      return null;
    }
    assertQuotationEditable(existing.status);

    const formData: QuotationFormData = {
      quotation_number: data.quotation_number ?? existing.quotation_number,
      client_id: data.client_id ?? existing.client_id,
      project_id: data.project_id ?? existing.project_id ?? "",
      title: data.title ?? existing.title,
      quotation_date: data.quotation_date ?? existing.quotation_date,
      valid_until: data.valid_until ?? existing.valid_until ?? "",
      status: data.status ?? existing.status,
      discount_rate: data.discount_rate ?? existing.discount_rate,
      tax_rate: data.tax_rate ?? existing.tax_rate,
      project_overview:
        data.project_overview ?? existing.project_overview ?? "",
      scope_of_work: data.scope_of_work ?? existing.scope_of_work ?? "",
      tech_stack: data.tech_stack ?? existing.tech_stack ?? "",
      project_timeline:
        data.project_timeline ?? existing.project_timeline ?? "",
      payment_terms: data.payment_terms ?? existing.payment_terms ?? "",
      support_and_maintenance:
        data.support_and_maintenance ??
        existing.support_and_maintenance ??
        "",
      notes: data.notes ?? existing.notes ?? "",
      terms_and_conditions:
        data.terms_and_conditions ?? existing.terms_and_conditions ?? "",
      items:
        data.items ??
        existing.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
    };
    const { quotation, items } = normalizeQuotationPayload(formData);

    if (!isSupabaseConfigured) {
      const now = new Date().toISOString();
      const updatedQuotation: Quotation = {
        ...existing,
        ...quotation,
        updated_at: now,
        items: createItems(id, items, now)
      };
      writeDemoQuotations(
        readDemoQuotations().map((quotationRecord) =>
          quotationRecord.id === id ? updatedQuotation : quotationRecord
        )
      );
      return updatedQuotation;
    }

    const { error } = await requireSupabase()
      .from("quotations")
      .update({ ...quotation, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw error;
    }

    const { error: deleteError } = await requireSupabase()
      .from("quotation_items")
      .delete()
      .eq("quotation_id", id);

    if (deleteError) {
      throw deleteError;
    }

    if (items.length > 0) {
      const { error: itemError } = await requireSupabase()
        .from("quotation_items")
        .insert(
          items.map((item, index) => ({
            quotation_id: id,
            description: item.description.trim(),
            quantity: toNumber(item.quantity),
            unit_price: toNumber(item.unit_price),
            line_total: toNumber(item.quantity) * toNumber(item.unit_price),
            sort_order: index
          }))
        );

      if (itemError) {
        throw itemError;
      }
    }

    return this.getQuotationById(id);
  },

  async transitionQuotation(id: string, status: Quotation["status"], userId: string | null, reason = "") {
    const existing = await this.getQuotationById(id);
    if (!existing) throw new Error("Quotation not found.");
    assertTransition("quotation", existing.status, status);
    if ((status === "rejected" || status === "draft") && !reason.trim()) throw new Error("A reason is required for this transition.");
    const now = new Date().toISOString();
    const changes = { status, updated_by: userId,
      ...(status === "under_review" ? { reviewed_at: now } : {}),
      ...(status === "approved" ? { approved_at: now } : {}),
      ...(status === "sent" ? { sent_at: now } : {}),
      ...(status === "accepted" ? { accepted_at: now } : {}),
      ...(status === "rejected" ? { rejected_reason: reason.trim() } : {}),
      ...(status === "draft" ? { return_to_draft_reason: reason.trim() } : {}) };
    let result: Quotation;
    if (!isSupabaseConfigured) {
      result = { ...existing, ...changes, updated_at: now };
      writeDemoQuotations(readDemoQuotations().map((item) => item.id === id ? result : item));
    } else {
      const { data, error } = await requireSupabase().from("quotations").update(changes)
        .eq("id", id).eq("status", existing.status).select().single();
      if (error) throw error;
      result = { ...existing, ...data } as Quotation;
    }
    await historyService.record({ entity_type: "quotation", entity_id: id, event_type: "status_changed",
      previous_value: { status: existing.status }, new_value: { status },
      description: `Quotation moved from ${existing.status} to ${status}${reason ? `: ${reason}` : ""}`,
      actor_id: userId, metadata: {} });
    return result;
  },

  async cloneQuotation(id: string, userId: string | null) {
    const source = await this.getQuotationById(id);
    if (!source) throw new Error("Quotation not found.");
    const number = await this.generateQuotationNumber();
    return this.createQuotation({ quotation_number: number, client_id: source.client_id,
      project_id: source.project_id ?? "", title: `${source.title} (Copy)`, quotation_date: new Date().toISOString().slice(0, 10),
      valid_until: source.valid_until ?? "", status: "draft", discount_rate: source.discount_rate,
      tax_rate: source.tax_rate, project_overview: source.project_overview ?? "", scope_of_work: source.scope_of_work ?? "",
      tech_stack: source.tech_stack ?? "", project_timeline: source.project_timeline ?? "", payment_terms: source.payment_terms ?? "",
      support_and_maintenance: source.support_and_maintenance ?? "", notes: source.notes ?? "",
      terms_and_conditions: source.terms_and_conditions ?? "", items: source.items.map((item) => ({ description: item.description,
        quantity: item.quantity, unit_price: item.unit_price, unit: item.unit ?? "", hsn_sac: item.hsn_sac ?? "", discount_rate: item.discount_rate })),
      created_by: userId });
  },

  async createRevision(id: string, userId: string | null) {
    const source = await this.getQuotationById(id);
    if (!source) throw new Error("Quotation not found.");
    const revisionNumber = nextRevision(source);
    const revision = await this.cloneQuotation(id, userId);
    const changes = { parent_quotation_id: source.parent_quotation_id ?? source.id, revision_number: revisionNumber };
    if (!isSupabaseConfigured) {
      writeDemoQuotations(readDemoQuotations().map((item) => item.id === revision.id ? { ...item, ...changes } : item));
    } else {
      const { error } = await requireSupabase().from("quotations").update(changes).eq("id", revision.id);
      if (error) throw error;
    }
    await historyService.record({ entity_type: "quotation", entity_id: revision.id, event_type: "revision_created",
      previous_value: null, new_value: { revision_number: revisionNumber }, description: `Revision ${revisionNumber} created`,
      actor_id: userId, metadata: { source_quotation_id: source.id } });
    return { ...revision, ...changes };
  },

  async convertToContract(id: string, userId: string | null) {
    const source = await this.getQuotationById(id);
    if (!source) throw new Error("Quotation not found.");
    if (source.status !== "accepted") throw new Error("Only accepted quotations can create contracts.");
    if (source.generated_contract_id) return source.generated_contract_id;
    if (isSupabaseConfigured) {
      const { data, error } = await requireSupabase().rpc("convert_accepted_quotation_to_contract", { p_quotation_id: id });
      if (error) throw error;
      return String(data);
    }
    const contract = await contractService.createContract({ contract_number: await contractService.generateContractNumber(),
      client_id: source.client_id, project_id: source.project_id ?? "", quotation_id: source.id, contract_type: "sow",
      title: source.title, start_date: "", end_date: "", status: "draft", contract_value: source.total_amount,
      renewal_required: false, renewal_date: "", content: source.scope_of_work ?? "",
      terms_and_conditions: source.terms_and_conditions ?? "", signed_file_url: "", billing_schedule: source.payment_terms ?? "",
      scope: source.scope_of_work ?? "", deliverables: "", created_by: userId });
    writeDemoQuotations(readDemoQuotations().map((item) => item.id === id ? { ...item, generated_contract_id: contract.id } : item));
    await historyService.record({ entity_type: "quotation", entity_id: id, event_type: "converted_to_contract",
      previous_value: null, new_value: { contract_id: contract.id }, description: "Accepted quotation converted to contract",
      actor_id: userId, metadata: { contract_id: contract.id } });
    return contract.id;
  },

  async convertToInvoice(id: string, userId: string | null) {
    const source = await this.getQuotationById(id);
    if (!source) throw new Error("Quotation not found.");
    if (source.status !== "accepted") throw new Error("Only accepted quotations can create invoices.");

    const invoiceNumber = await invoiceService.generateInvoiceNumber();
    const invoice = await invoiceService.createInvoice({
      invoice_number: invoiceNumber,
      client_id: source.client_id,
      project_id: source.project_id ?? "",
      quotation_id: source.id,
      contract_id: source.generated_contract_id ?? "",
      invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      status: "draft",
      subtotal: source.subtotal,
      discount_amount: source.discount_amount,
      tax_percentage: source.tax_rate,
      notes: `Generated from accepted quotation ${source.quotation_number}`,
      created_by: userId
    });

    if (source.items && source.items.length > 0) {
      const lines: InvoiceLineDraft[] = source.items.map((item) => ({
        description: item.description,
        hsn_sac: item.hsn_sac ?? "",
        unit: item.unit || "unit",
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_rate: item.discount_rate ?? 0,
        tax_rate: source.tax_rate ?? 18
      }));
      await invoiceLineService.saveDraft(invoice, lines, 0, 0);
    }

    await historyService.record({
      entity_type: "quotation",
      entity_id: id,
      event_type: "converted_to_invoice",
      previous_value: null,
      new_value: { invoice_id: invoice.id },
      description: `Accepted quotation converted to invoice ${invoiceNumber}`,
      actor_id: userId,
      metadata: { invoice_id: invoice.id }
    });

    return invoice.id;
  },

  async deleteQuotation(id: string) {
    if (!isSupabaseConfigured) {
      writeDemoQuotations(
        readDemoQuotations().filter((quotation) => quotation.id !== id)
      );
      return;
    }

    const { error } = await requireSupabase()
      .from("quotations")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
};
