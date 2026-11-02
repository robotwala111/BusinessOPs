import { InvoiceDetailPage } from "@/components/invoices/InvoiceDetailPage";
export default function InvoicePage({ params }: { params: { id: string } }) { return <InvoiceDetailPage invoiceId={params.id} />; }

