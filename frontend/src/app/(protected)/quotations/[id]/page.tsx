import { QuotationDetailPage } from "@/components/quotations/QuotationDetailPage";

type QuotationDetailRouteProps = {
  params: {
    id: string;
  };
};

export default function QuotationDetailRoute({
  params
}: QuotationDetailRouteProps) {
  return <QuotationDetailPage quotationId={params.id} />;
}
