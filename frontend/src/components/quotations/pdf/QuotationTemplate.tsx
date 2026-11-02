import { QuotationAcceptance } from "@/components/quotations/pdf/QuotationAcceptance";
import { QuotationClientInfo } from "@/components/quotations/pdf/QuotationClientInfo";
import { QuotationFooter } from "@/components/quotations/pdf/QuotationFooter";
import { QuotationHeader } from "@/components/quotations/pdf/QuotationHeader";
import { QuotationItemsTable } from "@/components/quotations/pdf/QuotationItemsTable";
import { QuotationMilestones } from "@/components/quotations/pdf/QuotationMilestones";
import { QuotationSummary } from "@/components/quotations/pdf/QuotationSummary";
import { QuotationTerms } from "@/components/quotations/pdf/QuotationTerms";
import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationTemplate({ data }: { data: QuotationPdfData }) {
  return (
    <article className="quotation-template-reference">
      <QuotationHeader data={data} />
      <QuotationClientInfo data={data} />
      <QuotationItemsTable data={data} />
      <QuotationSummary data={data} />
      <QuotationMilestones data={data} />
      <QuotationTerms data={data} />
      <QuotationAcceptance data={data} />
      <QuotationFooter data={data} />
    </article>
  );
}
