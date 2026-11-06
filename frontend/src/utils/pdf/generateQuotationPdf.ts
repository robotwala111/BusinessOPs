import type { jsPDF as JsPdfType } from "jspdf";
import type { Quotation } from "@/types/quotation";
import { settingsService } from "@/services/settingsService";
import {
  buildQuotationPdfData,
  cleanText,
  formatPdfCurrency,
  formatPdfDate,
  getLogoUrl,
  getQuotationPdfFilename,
  splitLines,
  type QuotationPdfData
} from "@/utils/pdf/quotationPdfHelpers";

type AutoTableModule = typeof import("jspdf-autotable");
type JsPdfConstructor = typeof import("jspdf").jsPDF;

const theme = {
  primary: [244, 176, 0] as [number, number, number],
  secondary: [17, 17, 17] as [number, number, number],
  text: [32, 33, 36] as [number, number, number],
  muted: [98, 100, 106] as [number, number, number],
  panel: [247, 247, 247] as [number, number, number],
  border: [222, 222, 222] as [number, number, number],
  white: [255, 255, 255] as [number, number, number]
};

export async function createQuotationPdfAttachment(quotation: Quotation): Promise<{ blob: Blob; filename: string }> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  const autoTable = autoTableModule.default as AutoTableModule["default"];
  const settings = await settingsService.getEffectiveCompanySettings();
  const filenamePrefix = await settingsService.getNumberingPrefix("quotation", "quotation");
  theme.primary = hexToRgb(settings.primary_color, theme.primary);
  theme.secondary = hexToRgb(settings.secondary_color, theme.secondary);
  const data = buildQuotationPdfData(quotation, settings);
  const doc = new (jsPDF as JsPdfConstructor)({
    unit: "mm",
    format: "a4",
    orientation: "portrait"
  });

  const logo = await loadLogoDataUrl(getLogoUrl(settings));
  renderDocument(doc, autoTable, data, logo);
  return {
    blob: doc.output("blob"),
    filename: getQuotationPdfFilename(quotation.quotation_number, filenamePrefix.toLowerCase())
  };
}

export async function generateQuotationPdf(quotation: Quotation) {
  const { blob, filename } = await createQuotationPdfAttachment(quotation);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hexToRgb(value: string, fallback: [number, number, number]): [number, number, number] {
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

  if (!match) {
    return fallback;
  }

  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16)
  ];
}

async function loadLogoDataUrl(url?: string) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function renderDocument(
  doc: JsPdfType,
  autoTable: AutoTableModule["default"],
  data: QuotationPdfData,
  logo: string | null
) {
  let cursorY = renderHeader(doc, data, logo);
  cursorY = renderClientInfo(doc, data, cursorY);
  cursorY = renderQuotationDetails(doc, data, cursorY);
  cursorY = renderIntro(doc, data, cursorY);
  cursorY = renderProjectOverview(doc, data, cursorY);
  cursorY = renderBulletSection(
    doc,
    "Scope of Work",
    splitLines(data.quotation.scope_of_work),
    cursorY
  );
  cursorY = renderItemsTable(doc, autoTable, data, cursorY);
  cursorY = renderBulletSection(
    doc,
    "Tech Stack",
    data.technicalSpecifications,
    cursorY
  );
  cursorY = renderSummary(doc, data, cursorY);
  cursorY = renderTextSection(
    doc,
    "Project Timeline",
    data.quotation.project_timeline,
    cursorY
  );
  cursorY = renderMilestones(doc, data, cursorY);
  cursorY = renderTextSection(
    doc,
    "Support and Maintenance",
    data.quotation.support_and_maintenance,
    cursorY
  );
  cursorY = renderTerms(doc, data, cursorY);
  renderAcceptance(doc, data, cursorY);
  renderFooters(doc, data);
}

function renderHeader(doc: JsPdfType, data: QuotationPdfData, logo: string | null) {
  doc.setFillColor(...theme.secondary);
  doc.rect(0, 0, 210, 52, "F");
  doc.setFillColor(...theme.primary);
  doc.rect(0, 0, 210, 2.2, "F");
  doc.rect(0, 50.8, 210, 1.2, "F");

  if (logo) {
    doc.addImage(logo, "PNG", 14, 7, 36, 36, undefined, "FAST");
  } else {
    doc.setFillColor(...theme.primary);
    doc.roundedRect(16, 11, 30, 30, 2, 2, "F");
    doc.setTextColor(...theme.secondary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("ATS", 31, 29, { align: "center" });
  }

  doc.setTextColor(...theme.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(data.company.name, 55, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(190, 194, 202);
  doc.text(data.company.tagline.toUpperCase(), 55, 27);

  doc.setDrawColor(...theme.primary);
  doc.setLineWidth(0.6);
  doc.line(145, 10, 145, 41);
  doc.setTextColor(...theme.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("COMMERCIAL QUOTATION", 151, 15);
  doc.setTextColor(...theme.white);
  doc.setFontSize(11);
  doc.text(data.quotation.quotation_number, 151, 24);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(190, 194, 202);
  doc.setFontSize(7.5);
  doc.text(`Issued ${formatPdfDate(data.quotation.quotation_date)}`, 151, 31);
  doc.text("CONFIDENTIAL", 151, 38);

  doc.setTextColor(...theme.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PROPOSAL FOR", 16, 65);
  doc.setTextColor(...theme.text);
  doc.setFontSize(19);
  doc.text(wrap(doc, data.quotation.title, 175), 16, 76);

  doc.setTextColor(...theme.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Prepared exclusively for ${cleanText(data.quotation.client?.company_name, "the client")}`, 16, 86);

  return 97;
}

function renderClientInfo(doc: JsPdfType, data: QuotationPdfData, startY: number) {
  const boxWidth = 86;
  const client = data.quotation.client;

  sectionLabel(doc, "From / To", startY);
  infoBox(doc, 16, startY + 8, boxWidth, "From", [
    data.company.name,
    data.company.address,
    data.company.email,
    data.company.phone,
    data.company.website
  ]);
  infoBox(doc, 108, startY + 8, boxWidth, "To", [
    cleanText(client?.company_name),
    cleanText(client?.contact_person),
    cleanText(client?.email),
    cleanText(client?.phone),
    cleanText(client?.address)
  ]);

  return startY + 48;
}

function renderQuotationDetails(
  doc: JsPdfType,
  data: QuotationPdfData,
  startY: number
) {
  sectionLabel(doc, "Quotation Details", startY);
  const cells = [
    ["Quotation No.", data.quotation.quotation_number],
    ["Date", formatPdfDate(data.quotation.quotation_date)],
    ["Valid Until", formatPdfDate(data.quotation.valid_until)],
    ["Prepared By", data.preparedBy]
  ];

  cells.forEach(([label, value], index) => {
    const x = 16 + index * 45;
    doc.setDrawColor(...theme.border);
    doc.roundedRect(x, startY + 8, 40, 20, 2, 2);
    doc.setTextColor(...theme.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), x + 3, startY + 15);
    doc.setTextColor(...theme.text);
    doc.setFontSize(8);
    doc.text(wrap(doc, value, 34), x + 3, startY + 22);
  });

  return startY + 38;
}

function renderIntro(doc: JsPdfType, data: QuotationPdfData, startY: number) {
  const clientName = cleanText(data.quotation.client?.company_name, "Client");
  sectionLabel(doc, "Introduction", startY);
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const message = `Dear ${clientName}, thank you for considering ${data.company.name}. Based on the discussed requirements, we are pleased to submit this quotation for ${data.quotation.title}. The proposal below outlines the scope, commercial summary, payment milestones, and terms for your review and approval.`;
  const lines = doc.splitTextToSize(message, 178);
  doc.text(lines, 16, startY + 11);
  return startY + 16 + lines.length * 4.4;
}

function renderProjectOverview(
  doc: JsPdfType,
  data: QuotationPdfData,
  startY: number
) {
  return renderTextSection(
    doc,
    "Project Overview",
    data.quotation.project_overview,
    startY
  );
}

function renderItemsTable(
  doc: JsPdfType,
  autoTable: AutoTableModule["default"],
  data: QuotationPdfData,
  startY: number
) {
  sectionLabel(doc, "Scope / Modules", startY);
  autoTable(doc, {
    startY: startY + 7,
    margin: { left: 16, right: 16 },
    head: [["Module", "Description", "Duration", "Amount"]],
    body: data.modules.map((module) => [
      module.name,
      module.description,
      module.duration,
      formatPdfCurrency(module.amount)
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 3,
      lineColor: theme.border,
      lineWidth: 0.1,
      valign: "top"
    },
    headStyles: {
      fillColor: theme.secondary,
      textColor: theme.white,
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 78 },
      2: { cellWidth: 32 },
      3: { cellWidth: 34, halign: "right" }
    }
  });

  return getFinalY(doc) + 12;
}

function renderSummary(doc: JsPdfType, data: QuotationPdfData, startY: number) {
  const y = ensureSpace(doc, startY, 55);
  sectionLabel(doc, "Budget Summary", y);
  doc.setFillColor(...theme.panel);
  doc.roundedRect(118, y + 8, 76, 45, 2, 2, "F");
  summaryRow(doc, "Subtotal", formatPdfCurrency(data.quotation.subtotal), y + 17);
  summaryRow(
    doc,
    `Discount (${data.quotation.discount_rate}%)`,
    formatPdfCurrency(data.quotation.discount_amount),
    y + 25
  );
  summaryRow(
    doc,
    `Tax (${data.quotation.tax_rate}%)`,
    formatPdfCurrency(data.quotation.tax_amount),
    y + 33
  );
  doc.setFillColor(...theme.secondary);
  doc.roundedRect(122, y + 39, 68, 11, 2, 2, "F");
  doc.setTextColor(...theme.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FINAL TOTAL", 126, y + 46);
  doc.setTextColor(...theme.white);
  doc.text(formatPdfCurrency(data.quotation.total_amount), 190, y + 46, {
    align: "right"
  });

  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Payment Terms", 16, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    doc.splitTextToSize(cleanText(data.quotation.payment_terms), 88),
    16,
    y + 24
  );

  return y + 62;
}

function renderBulletSection(
  doc: JsPdfType,
  title: string,
  items: string[],
  startY: number
) {
  if (items.length === 0) {
    return startY;
  }

  let y = ensureSpace(doc, startY, 34);
  sectionLabel(doc, title, y);
  y += 10;

  items.forEach((item) => {
    y = bullet(doc, item, y);
  });

  return y + 6;
}

function renderTextSection(
  doc: JsPdfType,
  title: string,
  text: string | null | undefined,
  startY: number
) {
  if (!text?.trim()) {
    return startY;
  }

  const y = ensureSpace(doc, startY, 28);
  sectionLabel(doc, title, y);
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(text.trim(), 178);
  doc.text(lines, 16, y + 11);

  return y + 16 + lines.length * 4.4;
}

function renderMilestones(
  doc: JsPdfType,
  data: QuotationPdfData,
  startY: number
) {
  let y = ensureSpace(doc, startY, 42);
  sectionLabel(doc, "Payment Milestones", y);
  y += 10;

  data.milestones.forEach((milestone, index) => {
    if (index % 2 === 0 && index > 0) {
      y += 30;
    }

    y = ensureSpace(doc, y, 30);
    const x = index % 2 === 0 ? 16 : 108;
    doc.setDrawColor(...theme.border);
    doc.setFillColor(...theme.white);
    doc.roundedRect(x, y, 86, 24, 2, 2, "FD");
    doc.setFillColor(...theme.primary);
    doc.rect(x, y, 2, 24, "F");
    doc.setTextColor(...theme.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(milestone.title, x + 6, y + 7);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(milestone.description, 58), x + 6, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text(formatPdfCurrency(milestone.amount), x + 82, y + 21, {
      align: "right"
    });
  });

  return y + 32;
}

function renderTerms(doc: JsPdfType, data: QuotationPdfData, startY: number) {
  let y = ensureSpace(doc, startY, 38);
  const terms = splitLines(data.quotation.terms_and_conditions);

  sectionLabel(doc, "Terms and Conditions", y);
  y += 10;

  if (terms.length === 0) {
    return bullet(
      doc,
      "Terms will be governed by the mutually approved project scope and commercial agreement.",
      y
    );
  }

  terms.forEach((term) => {
    y = bullet(doc, term, y);
  });

  return y + 6;
}

function renderAcceptance(doc: JsPdfType, data: QuotationPdfData, startY: number) {
  const y = ensureSpace(doc, startY, 58);
  sectionLabel(doc, "Acceptance", y);
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "By signing below, the client confirms acceptance of this quotation, including the project scope, commercial terms, payment milestones, and terms and conditions.",
    16,
    y + 11,
    { maxWidth: 178 }
  );
  systemGeneratedBox(doc, 16, y + 24, data.company.name);
  clientSignatureBox(doc, 108, y + 24);
}

function renderFooters(doc: JsPdfType, data: QuotationPdfData) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...theme.border);
    doc.line(16, 282, 194, 282);
    doc.setTextColor(...theme.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "Confidential quotation prepared for the named client. Do not distribute without written permission.",
      16,
      287
    );
    doc.text(`© ${new Date().getFullYear()} ${data.company.name}`, 16, 291);
    doc.text(`Page ${page} of ${pageCount}`, 194, 291, { align: "right" });
  }
}

function sectionLabel(doc: JsPdfType, label: string, y: number) {
  doc.setTextColor(...theme.secondary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(label.toUpperCase(), 20, y);
  doc.setFillColor(...theme.primary);
  doc.rect(16, y - 4, 1.5, 5, "F");
  doc.setDrawColor(...theme.primary);
  doc.setLineWidth(0.35);
  doc.line(16, y + 3, 194, y + 3);
}

function infoBox(
  doc: JsPdfType,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[]
) {
  doc.setDrawColor(...theme.border);
  doc.roundedRect(x, y, width, 33, 2, 2);
  doc.setTextColor(...theme.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(title.toUpperCase(), x + 4, y + 7);
  doc.setTextColor(...theme.text);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(lines.filter(Boolean).slice(0, 5), x + 4, y + 13);
}

function summaryRow(doc: JsPdfType, label: string, value: string, y: number) {
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(label, 122, y);
  doc.setFont("helvetica", "bold");
  doc.text(value, 190, y, { align: "right" });
}

function bullet(doc: JsPdfType, text: string, y: number) {
  const nextY = ensureSpace(doc, y, 12);
  const lines = doc.splitTextToSize(text, 170);
  doc.setFillColor(...theme.primary);
  doc.circle(18, nextY - 1.5, 1, "F");
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(lines, 22, nextY);
  return nextY + lines.length * 4.4 + 2;
}

function systemGeneratedBox(doc: JsPdfType, x: number, y: number, companyName: string) {
  doc.setDrawColor(...theme.border);
  doc.setFillColor(...theme.panel);
  doc.roundedRect(x, y, 86, 42, 2, 2, "FD");
  doc.setTextColor(...theme.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`FOR ${companyName}`.toUpperCase(), x + 4, y + 7);
  doc.setTextColor(...theme.text);
  doc.setFontSize(8);
  doc.text("System Generated Quotation", x + 4, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...theme.muted);
  doc.text(
    doc.splitTextToSize("This quotation is generated electronically by the business operations system and does not require a physical company signature.", 76),
    x + 4,
    y + 25
  );
}

function clientSignatureBox(doc: JsPdfType, x: number, y: number) {
  doc.setDrawColor(...theme.border);
  doc.roundedRect(x, y, 86, 42, 2, 2);
  doc.setTextColor(...theme.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CLIENT ACCEPTANCE", x + 4, y + 7);
  doc.setTextColor(...theme.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Authorized Name", x + 6, y + 18);
  doc.line(x + 32, y + 18, x + 80, y + 18);
  doc.text("Signature", x + 6, y + 29);
  doc.line(x + 32, y + 29, x + 80, y + 29);
  doc.text("Date", x + 6, y + 38);
  doc.line(x + 32, y + 38, x + 80, y + 38);
}

function ensureSpace(doc: JsPdfType, y: number, height: number) {
  if (y + height <= 276) {
    return y;
  }

  doc.addPage();
  return 22;
}

function wrap(doc: JsPdfType, text: string, width: number) {
  return doc.splitTextToSize(text, width);
}

function getFinalY(doc: JsPdfType) {
  const typedDoc = doc as JsPdfType & {
    lastAutoTable?: {
      finalY?: number;
    };
  };

  return typedDoc.lastAutoTable?.finalY ?? 120;
}
