import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationFooter({ data }: { data: QuotationPdfData }) {
  return (
    <footer className="pdf-section">
      Confidential quotation. © {new Date().getFullYear()} {data.company.name}
    </footer>
  );
}
