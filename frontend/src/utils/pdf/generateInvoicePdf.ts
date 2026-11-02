import type { Invoice } from "@/types/invoice";
import { settingsService } from "@/services/settingsService";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { createDocumentTheme, ensureDocumentSpace, loadBrandLogo, renderEnterpriseFooters, renderEnterpriseHeader, renderSectionTitle, safeDocumentFilePart } from "@/utils/pdf/documentBranding";

export async function generateInvoicePdf(invoice: Invoice) {
  const [{ jsPDF }, autoTableModule, settings, filenamePrefix] = await Promise.all([
    import("jspdf"), import("jspdf-autotable"), settingsService.getEffectiveCompanySettings(), settingsService.getNumberingPrefix("invoice", "invoice")
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const theme = createDocumentTheme(settings); const logo = await loadBrandLogo(settings);
  let y = renderEnterpriseHeader(doc, settings, theme, logo, invoice.document_type || "Tax Invoice", invoice.invoice_number, `Issued ${formatDate(invoice.issue_date || invoice.invoice_date)}`);

  doc.setTextColor(...theme.primary); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("BILLING DOCUMENT", 16, y + 3);
  doc.setTextColor(...theme.text); doc.setFontSize(19); doc.text(invoice.document_type === "proforma" ? "Proforma Invoice" : "Tax Invoice", 16, y + 14); y += 27;
  renderSectionTitle(doc, theme, "Bill from / Bill to", y); y += 9;
  infoBox(doc, theme, 16, y, "FROM", [settings.legal_name || settings.company_name, settings.address, settings.email, settings.phone, settings.gst_number ? `GSTIN: ${settings.gst_number}` : ""]);
  infoBox(doc, theme, 108, y, "BILL TO", [invoice.client?.company_name || "-", invoice.client?.address || "", invoice.client?.email || "", invoice.client?.phone || "", invoice.client?.gst_number ? `GSTIN: ${invoice.client.gst_number}` : ""]); y += 42;

  renderSectionTitle(doc, theme, "Invoice details", y); y += 9;
  const details = [["Invoice date", formatDate(invoice.invoice_date)], ["Due date", invoice.due_date ? formatDate(invoice.due_date) : "-"], ["Place of supply", invoice.place_of_supply || "-"], ["Tax treatment", (invoice.tax_type || "none").replace("_", " + ").toUpperCase()]];
  details.forEach(([label,value],i)=>{const x=16+i*45;doc.setFillColor(...theme.panel);doc.roundedRect(x,y,40,18,1.5,1.5,"F");doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(6.2);doc.text(label.toUpperCase(),x+3,y+6);doc.setTextColor(...theme.text);doc.setFontSize(7.5);doc.text(doc.splitTextToSize(value,34),x+3,y+12);}); y += 28;

  renderSectionTitle(doc, theme, "Items and services", y);
  const items = invoice.items || [];
  autoTableModule.default(doc, { startY:y+7, margin:{left:16,right:16,bottom:22}, head:[["#","Description","HSN/SAC","Qty","Rate","Disc.","GST","Amount"]], body:items.length?items.map((item,index)=>[String(index+1),item.description,item.hsn_sac||"-",`${item.quantity} ${item.unit||""}`.trim(),formatCurrency(item.unit_price,settings.currency),item.discount_amount?formatCurrency(item.discount_amount,settings.currency):`${item.discount_rate}%`,`${item.tax_rate}%`,formatCurrency(item.line_total,settings.currency)]):[["1",invoice.notes||"Professional services","-","1",formatCurrency(invoice.subtotal,settings.currency),formatCurrency(invoice.discount_amount,settings.currency),`${invoice.tax_percentage}%`,formatCurrency(invoice.total_amount,settings.currency)]], styles:{font:"helvetica",fontSize:7.2,cellPadding:2.5,lineColor:theme.border,lineWidth:0.1,valign:"top"}, headStyles:{fillColor:theme.secondary,textColor:theme.white,fontStyle:"bold"}, alternateRowStyles:{fillColor:theme.panel}, columnStyles:{0:{cellWidth:8},1:{cellWidth:52},2:{cellWidth:19},3:{cellWidth:18},4:{cellWidth:24,halign:"right"},5:{cellWidth:20,halign:"right"},6:{cellWidth:13,halign:"right"},7:{cellWidth:27,halign:"right"}} });
  y=((doc as typeof doc & {lastAutoTable?:{finalY?:number}}).lastAutoTable?.finalY||y+25)+12; y=ensureDocumentSpace(doc,y,65);
  renderSectionTitle(doc,theme,"Commercial summary",y); y+=10;
  if(settings.bank_details){doc.setTextColor(...theme.text);doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("Payment details",16,y+2);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.text(doc.splitTextToSize(settings.bank_details,82),16,y+9);}
  doc.setFillColor(...theme.panel);doc.roundedRect(112,y-2,82,55,2,2,"F");
  let sy=y+7; summaryRow(doc,theme,"Subtotal",formatCurrency(invoice.subtotal,settings.currency),sy);sy+=8;
  if(invoice.discount_amount){summaryRow(doc,theme,"Discount",`- ${formatCurrency(invoice.discount_amount,settings.currency)}`,sy);sy+=8;}
  if(invoice.tax_type==="cgst_sgst"){summaryRow(doc,theme,"CGST",formatCurrency(invoice.tax_amount/2,settings.currency),sy);sy+=8;summaryRow(doc,theme,"SGST",formatCurrency(invoice.tax_amount/2,settings.currency),sy);sy+=8;}else if(invoice.tax_type==="igst"){summaryRow(doc,theme,"IGST",formatCurrency(invoice.tax_amount,settings.currency),sy);sy+=8;}else{summaryRow(doc,theme,"Tax",formatCurrency(invoice.tax_amount,settings.currency),sy);sy+=8;}
  if(invoice.rounding_amount){summaryRow(doc,theme,"Rounding",formatCurrency(invoice.rounding_amount,settings.currency),sy);sy+=8;}
  doc.setFillColor(...theme.secondary);doc.roundedRect(116,sy-5,74,11,1.5,1.5,"F");doc.setTextColor(...theme.primary);doc.setFont("helvetica","bold");doc.setFontSize(7);doc.text("TOTAL",120,sy+2);doc.setTextColor(...theme.white);doc.text(formatCurrency(invoice.total_amount,settings.currency),186,sy+2,{align:"right"});
  y+=66; y=ensureDocumentSpace(doc,y,36); renderSectionTitle(doc,theme,"Payment status",y);y+=10;
  summaryRowAt(doc,theme,"Amount received",formatCurrency(invoice.amount_paid,settings.currency),16,y);summaryRowAt(doc,theme,"TDS / withholding",formatCurrency(invoice.tds_amount,settings.currency),75,y);summaryRowAt(doc,theme,"Balance due",formatCurrency(invoice.balance_due,settings.currency),134,y);
  renderEnterpriseFooters(doc,settings,theme,invoice.invoice_number);doc.save(`${filenamePrefix.toLowerCase()}-${safeDocumentFilePart(invoice.invoice_number)}.pdf`);
}

function infoBox(doc:InstanceType<typeof import("jspdf").jsPDF>,theme:ReturnType<typeof createDocumentTheme>,x:number,y:number,title:string,lines:string[]){doc.setDrawColor(...theme.border);doc.roundedRect(x,y,86,33,2,2);doc.setTextColor(...theme.primary);doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.text(title,x+4,y+7);doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.text(lines.filter(Boolean).slice(0,5),x+4,y+14);}
function summaryRow(doc:InstanceType<typeof import("jspdf").jsPDF>,theme:ReturnType<typeof createDocumentTheme>,label:string,value:string,y:number){doc.setTextColor(...theme.text);doc.setFont("helvetica","normal");doc.setFontSize(7.5);doc.text(label,118,y);doc.setFont("helvetica","bold");doc.text(value,188,y,{align:"right"});}
function summaryRowAt(doc:InstanceType<typeof import("jspdf").jsPDF>,theme:ReturnType<typeof createDocumentTheme>,label:string,value:string,x:number,y:number){doc.setFillColor(...theme.panel);doc.roundedRect(x,y,55,18,1.5,1.5,"F");doc.setTextColor(...theme.muted);doc.setFont("helvetica","bold");doc.setFontSize(6.2);doc.text(label.toUpperCase(),x+3,y+6);doc.setTextColor(...theme.text);doc.setFontSize(8);doc.text(value,x+3,y+13);}
