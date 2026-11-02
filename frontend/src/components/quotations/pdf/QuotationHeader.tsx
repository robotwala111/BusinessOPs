import Image from "next/image";
import type { QuotationPdfData } from "@/utils/pdf/quotationPdfHelpers";
import { formatPdfDate, getLogoUrl } from "@/utils/pdf/quotationPdfHelpers";

export function QuotationHeader({ data }: { data: QuotationPdfData }) {
  return (
    <header className="pdf-header">
      <div className="pdf-brand-lockup">
        <Image
          className="pdf-brand-logo"
          src={data.company.logoUrl || getLogoUrl() || ""}
          alt={`${data.company.name} logo`}
          width={112}
          height={112}
          priority
        />
        <div>
          <strong>{data.company.name}</strong>
          <span>{data.company.tagline}</span>
        </div>
      </div>
      <div className="pdf-document-control">
        <small>COMMERCIAL QUOTATION</small>
        <strong>{data.quotation.quotation_number}</strong>
        <span>Issued {formatPdfDate(data.quotation.quotation_date)}</span>
      </div>
    </header>
  );
}
