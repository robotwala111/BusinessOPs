import { ContractDetailPage } from "@/components/contracts/ContractDetailPage";
export default function ContractPage({ params }: { params: { id: string } }) { return <ContractDetailPage contractId={params.id} />; }

