import type { MaintenanceContract } from "@/types/maintenance";
import { settingsService } from "@/services/settingsService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { createDocumentTheme, ensureDocumentSpace, loadBrandLogo, renderEnterpriseFooters, renderEnterpriseHeader, renderSectionTitle, safeDocumentFilePart } from "@/utils/pdf/documentBranding";

export async function generateMaintenancePdf(agreement: MaintenanceContract) {
  const [{ jsPDF }, settings] = await Promise.all([import("jspdf"), settingsService.getEffectiveCompanySettings()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const theme = createDocumentTheme(settings); const logo = await loadBrandLogo(settings);
  const reference = agreement.contract?.contract_number || `MAINT-${agreement.id.slice(0, 8).toUpperCase()}`;
  let y = renderEnterpriseHeader(doc, settings, theme, logo, "Maintenance Agreement", reference, agreement.start_date ? `Effective ${formatDate(agreement.start_date)}` : "Draft service plan");
  doc.setTextColor(...theme.primary); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("SERVICE PLAN", 16, y + 3);
  doc.setTextColor(...theme.text); doc.setFontSize(19); doc.text(agreement.plan_name, 16, y + 14); y += 28;
  renderSectionTitle(doc,theme,"Agreement overview",y);y+=10;
  const cards=[["Client",agreement.client?.company_name||"-"],["Project",agreement.project?.project_name||"-"],["Term",`${agreement.start_date?formatDate(agreement.start_date):"-"} to ${agreement.end_date?formatDate(agreement.end_date):"-"}`],["Status",agreement.status.replace(/_/g," ")],["Annual fee",formatCurrency(agreement.yearly_fee,settings.currency)],["Monthly fee",formatCurrency(agreement.monthly_fee,settings.currency)]];
  cards.forEach(([label,value],i)=>{const row=Math.floor(i/2),x=i%2===0?16:108,cy=y+row*18;doc.setFillColor(...theme.panel);doc.roundedRect(x,cy,86,14,1.5,1.5,"F");doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(6.2);doc.text(label.toUpperCase(),x+4,cy+5);doc.setTextColor(...theme.text);doc.setFontSize(8);doc.text(doc.splitTextToSize(value,76),x+4,cy+10);});y+=64;
  renderSectionTitle(doc,theme,"Support entitlement and SLA",y);y+=10;
  const sla=[["Included support hours",`${agreement.included_hours} hours`],["Response SLA",agreement.response_sla_hours==null?"Not specified":`${agreement.response_sla_hours} hours`],["Resolution SLA",agreement.resolution_sla_hours==null?"Not specified":`${agreement.resolution_sla_hours} hours`],["Billing schedule",agreement.billing_schedule||"As agreed"]];
  sla.forEach(([label,value],i)=>{const x=16+i*45;doc.setDrawColor(...theme.border);doc.roundedRect(x,y,40,21,1.5,1.5);doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(6);doc.text(label.toUpperCase(),x+3,y+6,{maxWidth:34});doc.setTextColor(...theme.text);doc.setFontSize(8);doc.text(doc.splitTextToSize(value,34),x+3,y+15);});y+=32;
  if(agreement.notes?.trim()){y=ensureDocumentSpace(doc,y,32);renderSectionTitle(doc,theme,"Service notes",y);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.setFontSize(8.5);const lines=doc.splitTextToSize(agreement.notes,178);doc.text(lines,16,y+11);y+=17+lines.length*4.3;}
  y=ensureDocumentSpace(doc,y,50);renderSectionTitle(doc,theme,"Authorization",y);y+=12;
  signature(doc,theme,16,y,settings.company_name,settings.authorized_signatory_name||"Authorized signatory");signature(doc,theme,108,y,agreement.client?.company_name||"Client",agreement.client?.contact_person||"Authorized signatory");
  renderEnterpriseFooters(doc,settings,theme,reference);doc.save(`maintenance-${safeDocumentFilePart(reference)}.pdf`);
}
function signature(doc:InstanceType<typeof import("jspdf").jsPDF>,theme:ReturnType<typeof createDocumentTheme>,x:number,y:number,party:string,name:string){doc.setDrawColor(...theme.border);doc.roundedRect(x,y,86,36,2,2);doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text(`FOR ${party.toUpperCase()}`,x+4,y+7);doc.line(x+4,y+22,x+78,y+22);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.text(name,x+4,y+28);doc.setTextColor(...theme.muted);doc.text("Signature and date",x+4,y+33);}
