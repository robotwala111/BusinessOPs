import { ClientDetailPage } from "@/components/clients/ClientDetailPage";

type ClientDetailRouteProps = {
  params: {
    id: string;
  };
};

export default function ClientDetailRoute({ params }: ClientDetailRouteProps) {
  return <ClientDetailPage clientId={params.id} />;
}
