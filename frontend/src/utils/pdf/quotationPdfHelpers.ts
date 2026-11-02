import type { Quotation, QuotationItem } from "@/types/quotation";
import type { EffectiveCompanySettings } from "@/types/settings";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export type QuotationModule = {
  name: string;
  description: string;
  duration: string;
  amount: number;
};

export type QuotationMilestone = {
  title: string;
  description: string;
  amount: number;
};

export type QuotationPdfData = {
  quotation: Quotation;
  modules: QuotationModule[];
  milestones: QuotationMilestone[];
  deliverables: string[];
  technicalSpecifications: string[];
  preparedBy: string;
  company: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    logoUrl?: string;
  };
};

const COMPANY_DETAILS = {
  name: "Amiro Tech Solutions",
  tagline: "Technology. Delivery. Partnership.",
  email: "",
  phone: "",
  website: "",
  address: ""
};

export function cleanText(value?: string | null, fallback = "-") {
  return value && value.trim() ? value.trim() : fallback;
}

export function splitLines(value?: string | null) {
  return cleanText(value, "")
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function getQuotationPdfFilename(quotationNumber: string, prefix = "quotation") {
  const safeNumber = quotationNumber.replace(/[^\w-]+/g, "-");
  return `${prefix}-${safeNumber || "quotation"}.pdf`;
}

export function getLogoUrl(settings?: EffectiveCompanySettings) {
  return settings?.logo_url || "/assets/amiro-tech-logo.png";
}

function parseItemDescription(item: QuotationItem) {
  const [name, ...details] = item.description.split(/\s+-\s+/);

  return {
    name: cleanText(name, "Module"),
    description: cleanText(details.join(" - "), item.description),
    duration: "As per agreed project plan"
  };
}

function buildModules(items: QuotationItem[]): QuotationModule[] {
  return items.map((item) => {
    const parsed = parseItemDescription(item);

    return {
      ...parsed,
      amount: item.line_total
    };
  });
}

function buildDeliverables(quotation: Quotation) {
  const scopeDeliverables = splitLines(quotation.scope_of_work);

  if (scopeDeliverables.length > 0) {
    return scopeDeliverables;
  }

  const noteDeliverables = splitLines(quotation.notes).filter((line) =>
    /deliver|module|feature|setup|integration|support|training/i.test(line)
  );

  if (noteDeliverables.length > 0) {
    return noteDeliverables;
  }

  return quotation.items.map((item) => parseItemDescription(item).name);
}

function buildTechnicalSpecifications(quotation: Quotation) {
  const techStack = splitLines(quotation.tech_stack);

  if (techStack.length > 0) {
    return techStack;
  }

  return splitLines(quotation.notes).filter((line) =>
    /tech|stack|platform|database|api|hosting|deployment|security|integration/i.test(
      line
    )
  );
}

function buildMilestones(quotation: Quotation): QuotationMilestone[] {
  const paymentLines = splitLines(quotation.payment_terms);

  if (paymentLines.length > 0) {
    const equalAmount = quotation.total_amount / paymentLines.length;

    return paymentLines.map((line, index) => ({
      title: `Milestone ${index + 1}`,
      description: line,
      amount: equalAmount
    }));
  }

  return [
    {
      title: "Project Initiation",
      description: "Advance payment upon quotation acceptance.",
      amount: quotation.total_amount * 0.5
    },
    {
      title: "Final Delivery",
      description: "Balance payment upon completion and handover.",
      amount: quotation.total_amount * 0.5
    }
  ];
}

export function buildQuotationPdfData(
  quotation: Quotation,
  settings?: EffectiveCompanySettings
): QuotationPdfData {
  const companyName = settings?.company_name || COMPANY_DETAILS.name;
  return {
    quotation,
    modules: buildModules(quotation.items),
    milestones: buildMilestones(quotation),
    deliverables: buildDeliverables(quotation),
    technicalSpecifications: buildTechnicalSpecifications(quotation),
    preparedBy: settings?.authorized_signatory_name || companyName,
    company: {
      ...COMPANY_DETAILS,
      name: companyName,
      tagline: settings?.legal_name || COMPANY_DETAILS.tagline,
      email: settings?.email || COMPANY_DETAILS.email,
      phone: settings?.phone || COMPANY_DETAILS.phone,
      website: settings?.website || COMPANY_DETAILS.website,
      address: settings?.address || COMPANY_DETAILS.address,
      logoUrl: getLogoUrl(settings)
    }
  };
}

export function formatPdfCurrency(value: number, currency?: string) {
  return formatCurrency(Number.isFinite(value) ? value : 0, currency);
}

export function formatPdfDate(value?: string | null) {
  return value ? formatDate(value) : "-";
}
