import type { jsPDF as JsPdfType } from "jspdf";
import type { EffectiveCompanySettings } from "@/types/settings";

export type Rgb = [number, number, number];
export type DocumentTheme = {
  primary: Rgb;
  secondary: Rgb;
  text: Rgb;
  muted: Rgb;
  panel: Rgb;
  border: Rgb;
  white: Rgb;
};

export const DEFAULT_BRAND_LOGO = "/assets/amiro-tech-logo.png";

export function createDocumentTheme(settings: EffectiveCompanySettings): DocumentTheme {
  return {
    primary: hexToRgb(settings.primary_color, [244, 176, 0]),
    secondary: hexToRgb(settings.secondary_color, [17, 17, 17]),
    text: [32, 33, 36], muted: [98, 100, 106], panel: [247, 248, 250],
    border: [218, 222, 229], white: [255, 255, 255]
  };
}

export function resolveBrandLogoUrl(settings: EffectiveCompanySettings) {
  return settings.logo_url || DEFAULT_BRAND_LOGO;
}

export async function loadBrandLogo(settings: EffectiveCompanySettings) {
  try {
    const response = await fetch(resolveBrandLogoUrl(settings));
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function renderEnterpriseHeader(
  doc: JsPdfType,
  settings: EffectiveCompanySettings,
  theme: DocumentTheme,
  logo: string | null,
  documentType: string,
  documentNumber: string,
  meta: string
) {
  doc.setFillColor(...theme.secondary); doc.rect(0, 0, 210, 52, "F");
  doc.setFillColor(...theme.primary); doc.rect(0, 0, 210, 2.2, "F"); doc.rect(0, 50.8, 210, 1.2, "F");
  if (logo) doc.addImage(logo, "PNG", 14, 7, 36, 36, undefined, "FAST");
  else { doc.setFillColor(...theme.primary); doc.roundedRect(16, 11, 30, 30, 2, 2, "F"); doc.setTextColor(...theme.secondary); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("ATS", 31, 29, { align: "center" }); }
  doc.setTextColor(...theme.white); doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.text(settings.company_name, 55, 20);
  doc.setTextColor(190, 194, 202); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text((settings.legal_name || "Technology. Delivery. Partnership.").toUpperCase(), 55, 27);
  doc.setDrawColor(...theme.primary); doc.setLineWidth(0.6); doc.line(145, 10, 145, 41);
  doc.setTextColor(...theme.primary); doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.text(documentType.toUpperCase(), 151, 15);
  doc.setTextColor(...theme.white); doc.setFontSize(10); doc.text(documentNumber, 151, 24);
  doc.setTextColor(190, 194, 202); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(meta, 151, 31); doc.text("CONFIDENTIAL", 151, 38);
  return 62;
}

export function renderSectionTitle(doc: JsPdfType, theme: DocumentTheme, label: string, y: number) {
  doc.setTextColor(...theme.secondary); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text(label.toUpperCase(), 20, y);
  doc.setFillColor(...theme.primary); doc.rect(16, y - 4, 1.5, 5, "F"); doc.setDrawColor(...theme.primary); doc.setLineWidth(0.35); doc.line(16, y + 3, 194, y + 3);
}

export function ensureDocumentSpace(doc: JsPdfType, y: number, height: number) {
  if (y + height <= 276) return y;
  doc.addPage(); return 22;
}

export function renderEnterpriseFooters(doc: JsPdfType, settings: EffectiveCompanySettings, theme: DocumentTheme, reference: string) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page); doc.setDrawColor(...theme.border); doc.line(16, 282, 194, 282);
    doc.setTextColor(...theme.muted); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(settings.default_footer_text || `Confidential document issued by ${settings.company_name}.`, 16, 287, { maxWidth: 135 });
    doc.text(reference, 16, 292); doc.text(`Page ${page} of ${pages}`, 194, 292, { align: "right" });
  }
}

export function safeDocumentFilePart(value: string) { return value.replace(/[^\w-]+/g, "-") || "document"; }

function hexToRgb(value: string, fallback: Rgb): Rgb {
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : fallback;
}
