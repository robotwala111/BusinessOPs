import { EditClientPage } from "@/components/clients/EditClientPage";

type EditClientRouteProps = {
  params: {
    id: string;
  };
};

export default function EditClientRoute({ params }: EditClientRouteProps) {
  return <EditClientPage clientId={params.id} />;
}
