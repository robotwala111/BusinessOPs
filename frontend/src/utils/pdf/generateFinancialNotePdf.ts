import type { FinancialNote } from "@/types/financialNote";
import type { Invoice } from "@/types/invoice";
import { settingsService } from "@/services/settingsService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { createDocumentTheme, loadBrandLogo, renderEnterpriseFooters, renderEnterpriseHeader, renderSectionTitle, safeDocumentFilePart } from "@/utils/pdf/documentBranding";

export async function generateFinancialNotePdf(note: FinancialNote, invoice: Invoice) {
  const [{ jsPDF }, settings] = await Promise.all([import("jspdf"), settingsService.getEffectiveCompanySettings()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const theme = createDocumentTheme(settings); const logo = await loadBrandLogo(settings);
  let y = renderEnterpriseHeader(doc, settings, theme, logo, note.note_type.replace("_", " "), note.note_number, `Dated ${formatDate(note.note_date)}`);
  renderSectionTitle(doc, theme, "Related invoice", y); y += 12;
  [["Invoice", invoice.invoice_number], ["Client", invoice.client?.company_name || "-"], ["Invoice total", formatCurrency(invoice.total_amount, settings.currency)], ["Invoice date", formatDate(invoice.invoice_date)]].forEach(([label,value],index)=>{const x=16+index*45;doc.setFillColor(...theme.panel);doc.roundedRect(x,y,40,18,1.5,1.5,"F");doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(6);doc.text(label.toUpperCase(),x+3,y+6);doc.setTextColor(...theme.text);doc.setFontSize(7.5);doc.text(doc.splitTextToSize(value,34),x+3,y+12);}); y += 30;
  renderSectionTitle(doc,theme,"Adjustment reason",y);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.text(doc.splitTextToSize(note.reason,178),16,y+12);y+=32;
  renderSectionTitle(doc,theme,"Adjustment summary",y);y+=12;
  const rows=[["Taxable adjustment",note.base_amount],[`Tax (${note.tax_rate}%)`,note.tax_amount],["Total adjustment",note.total_amount]] as const;
  rows.forEach(([label,value],index)=>{const rowY=y+index*11;if(index===2){doc.setFillColor(...theme.secondary);doc.roundedRect(108,rowY-7,86,10,1.5,1.5,"F");doc.setTextColor(...theme.primary);}else doc.setTextColor(...theme.text);doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text(label,112,rowY);doc.text(formatCurrency(value,settings.currency),190,rowY,{align:"right"});});
  renderEnterpriseFooters(doc,settings,theme,note.note_number);doc.save(`${note.note_type}-${safeDocumentFilePart(note.note_number)}.pdf`);
}
