import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { splitLines } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationTerms({ data }: { data: QuotationPdfData }) {
  return (
    <section className="pdf-section">
      <h3>Terms and Conditions</h3>
      <ul>
        {splitLines(data.quotation.terms_and_conditions).map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ul>
    </section>
  );
}
