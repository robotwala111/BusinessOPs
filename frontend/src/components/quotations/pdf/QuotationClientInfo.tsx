import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { cleanText } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationClientInfo({ data }: { data: QuotationPdfData }) {
  return (
    <section className="pdf-section pdf-two-column">
      <div>
        <h3>From</h3>
        <p>{data.company.name}</p>
        <p>{data.company.email}</p>
        <p>{data.company.phone}</p>
      </div>
      <div>
        <h3>To</h3>
        <p>{cleanText(data.quotation.client?.company_name)}</p>
        <p>{cleanText(data.quotation.client?.contact_person)}</p>
        <p>{cleanText(data.quotation.client?.email)}</p>
      </div>
    </section>
  );
}
