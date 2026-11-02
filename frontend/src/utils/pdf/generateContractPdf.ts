import type { Contract } from "@/types/contract";
import { settingsService } from "@/services/settingsService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { createDocumentTheme, ensureDocumentSpace, loadBrandLogo, renderEnterpriseFooters, renderEnterpriseHeader, renderSectionTitle, safeDocumentFilePart } from "@/utils/pdf/documentBranding";

export async function generateContractPdf(contract: Contract) {
  const [{ jsPDF }, settings, prefix] = await Promise.all([import("jspdf"), settingsService.getEffectiveCompanySettings(), settingsService.getNumberingPrefix("contract", "contract")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const theme = createDocumentTheme(settings); const logo = await loadBrandLogo(settings);
  let y = renderEnterpriseHeader(doc, settings, theme, logo, contract.contract_type.replace(/_/g, " "), contract.contract_number, contract.start_date ? `Effective ${formatDate(contract.start_date)}` : "Draft agreement");
  doc.setTextColor(...theme.primary); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("AGREEMENT TITLE", 16, y + 3);
  doc.setTextColor(...theme.text); doc.setFontSize(19); doc.text(doc.splitTextToSize(contract.title, 178), 16, y + 14); y += 28;
  renderSectionTitle(doc, theme, "Agreement overview", y); y += 9;
  const details = [["Client", contract.client?.company_name || "-"], ["Project", contract.project?.project_name || "-"], ["Contract value", formatCurrency(contract.contract_value, settings.currency)], ["Term", `${contract.start_date ? formatDate(contract.start_date) : "-"} to ${contract.end_date ? formatDate(contract.end_date) : "-"}`], ["Status", contract.status.replace(/_/g, " ")], ["Billing", contract.billing_schedule || "As mutually agreed"]];
  details.forEach(([label,value],i)=>{const x=i%2===0?16:108;if(i>0&&i%2===0)y+=18;doc.setFillColor(...theme.panel);doc.roundedRect(x,y,86,14,1.5,1.5,"F");doc.setTextColor(...theme.muted);doc.setFontSize(6.5);doc.setFont("helvetica","bold");doc.text(label.toUpperCase(),x+4,y+5);doc.setTextColor(...theme.text);doc.setFontSize(8);doc.text(doc.splitTextToSize(value,76),x+4,y+10);}); y+=24;
  y = renderTextSection(doc, theme, "Scope of services", contract.scope || contract.content, y);
  y = renderTextSection(doc, theme, "Deliverables", contract.deliverables, y);
  y = renderTextSection(doc, theme, "Commercial and billing terms", contract.billing_schedule, y);
  y = renderTextSection(doc, theme, "Terms and conditions", contract.terms_and_conditions, y);
  y=ensureDocumentSpace(doc,y,55);renderSectionTitle(doc,theme,"Authorization",y);y+=12;
  signatureBox(doc,theme,16,y,`FOR ${settings.company_name.toUpperCase()}`,settings.authorized_signatory_name||"Authorized signatory");signatureBox(doc,theme,108,y,"FOR THE CLIENT",contract.client?.contact_person||"Authorized signatory");
  renderEnterpriseFooters(doc,settings,theme,contract.contract_number);doc.save(`${prefix.toLowerCase()}-${safeDocumentFilePart(contract.contract_number)}.pdf`);
}

function renderTextSection(doc: InstanceType<typeof import("jspdf").jsPDF>, theme: ReturnType<typeof createDocumentTheme>, title: string, value: string | null | undefined, startY: number) { if(!value?.trim()) return startY; const y=ensureDocumentSpace(doc,startY,30);renderSectionTitle(doc,theme,title,y);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.setFontSize(8.5);const lines=doc.splitTextToSize(value.trim(),178);doc.text(lines,16,y+11);return y+17+lines.length*4.3; }
function signatureBox(doc: InstanceType<typeof import("jspdf").jsPDF>,theme:ReturnType<typeof createDocumentTheme>,x:number,y:number,title:string,name:string){doc.setDrawColor(...theme.border);doc.roundedRect(x,y,86,38,2,2);doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text(title,x+4,y+7);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.text(name,x+4,y+27);doc.line(x+4,y+23,x+78,y+23);doc.text("Name / signature / date",x+4,y+33);}
