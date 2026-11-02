import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { formatPdfCurrency } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationItemsTable({ data }: { data: QuotationPdfData }) {
  return (
    <section className="pdf-section">
      <h3>Scope / Modules</h3>
      <table>
        <thead>
          <tr>
            <th>Module</th>
            <th>Description</th>
            <th>Duration</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.modules.map((module) => (
            <tr key={`${module.name}-${module.amount}`}>
              <td>{module.name}</td>
              <td>{module.description}</td>
              <td>{module.duration}</td>
              <td>{formatPdfCurrency(module.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
