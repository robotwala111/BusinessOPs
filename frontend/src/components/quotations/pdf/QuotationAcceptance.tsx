import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationAcceptance({ data }: { data: QuotationPdfData }) {
  return (
    <section className="pdf-section pdf-two-column">
      <div>
        <h3>For {data.company.name}</h3>
        <strong>System Generated Quotation</strong>
        <p>
          This quotation is generated electronically by the business operations
          system and does not require a physical company signature.
        </p>
      </div>
      <div>
        <h3>Client Acceptance</h3>
        <p>Authorized name: __________________________</p>
        <p>Signature: ________________________________</p>
        <p>Date: _____________________________________</p>
      </div>
    </section>
  );
}
