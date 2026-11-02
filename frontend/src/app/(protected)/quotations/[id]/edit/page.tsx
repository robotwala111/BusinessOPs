import { EditQuotationPage } from "@/components/quotations/EditQuotationPage";

type EditQuotationRouteProps = {
  params: {
    id: string;
  };
};

export default function EditQuotationRoute({ params }: EditQuotationRouteProps) {
  return <EditQuotationPage quotationId={params.id} />;
}
