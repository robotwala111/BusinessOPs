import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { formatPdfCurrency } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationMilestones({ data }: { data: QuotationPdfData }) {
  return (
    <section className="pdf-section">
      <h3>Payment Milestones</h3>
      {data.milestones.map((milestone) => (
        <p key={`${milestone.title}-${milestone.amount}`}>
          <strong>{milestone.title}</strong>: {milestone.description} (
          {formatPdfCurrency(milestone.amount)})
        </p>
      ))}
    </section>
  );
}
