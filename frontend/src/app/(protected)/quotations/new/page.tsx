import { Suspense } from "react";
import { NewQuotationPage } from "@/components/quotations/NewQuotationPage";

export default function NewQuotationRoute() {
  return (
    <Suspense fallback={<div className="module-page"><p className="muted">Loading Quotation Form...</p></div>}>
      <NewQuotationPage />
    </Suspense>
  );
}
