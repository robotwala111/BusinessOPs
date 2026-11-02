import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { formatPdfCurrency } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationSummary({ data }: { data: QuotationPdfData }) {
  const quotation = data.quotation;

  return (
    <section className="pdf-section">
      <h3>Budget Summary</h3>
      <p>Subtotal: {formatPdfCurrency(quotation.subtotal)}</p>
      <p>Discount: {formatPdfCurrency(quotation.discount_amount)}</p>
      <p>Tax: {formatPdfCurrency(quotation.tax_amount)}</p>
      <strong>Total: {formatPdfCurrency(quotation.total_amount)}</strong>
    </section>
  );
}
