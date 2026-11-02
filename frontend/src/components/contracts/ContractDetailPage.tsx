"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/business/StatusPill";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { contractService } from "@/services/contractService";
import { contractVersionService } from "@/services/contractVersionService";
import { historyService } from "@/services/historyService";
import { invoiceService } from "@/services/invoiceService";
import type { Contract } from "@/types/contract";
import type { ContractVersion } from "@/types/contractVersion";
import type { Invoice } from "@/types/invoice";
import type { EntityHistory } from "@/types/workflow";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export function ContractDetailPage({ contractId }: { contractId: string }) {
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<EntityHistory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try {
    const [record, nextVersions, nextInvoices, nextHistory] = await Promise.all([
      contractService.getContractById(contractId), contractVersionService.list(contractId), invoiceService.getInvoices(), historyService.list("contract", contractId)]);
    setContract(record); setVersions(nextVersions); setInvoices(nextInvoices.filter((item) => item.contract_id === contractId)); setHistory(nextHistory);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load contract."); } finally { setLoading(false); } }, [contractId]);
  useEffect(() => { void load(); }, [load]);
  async function transition(status: Contract["status"]) { if (!contract) return; const reason = status === "terminated" ? window.prompt("Termination reason:") : ""; if (status === "terminated" && !reason?.trim()) return;
    try { await contractService.transitionContract(contract.id, status, user?.id ?? null, reason ?? ""); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update contract."); } }
  async function upload(file?: File) { if (!contract || !file) return; try { await contractService.uploadContractVersion(contract, file, user?.id ?? null); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to upload contract."); } }
  if (loading) return <div className="route-placeholder">Loading contract...</div>;
  if (!contract) return <div className="route-placeholder">{error || "Contract not found."}</div>;
  return <section className="module-page"><div className="module-header"><div><p className="eyebrow">Contract</p><h1>{contract.contract_number}</h1><StatusPill value={contract.status} /></div><div className="module-actions"><BackButton fallbackHref="/contracts" />
    <Button variant="secondary" onClick={() => void import("@/utils/pdf/generateContractPdf").then(({ generateContractPdf }) => generateContractPdf(contract))}>Download PDF</Button>
    {allowedTransitions("contract", contract.status).map((status) => <Button key={status} variant="secondary" onClick={() => void transition(status as Contract["status"])}>{status.replace(/_/g, " ")}</Button>)}</div></div>
    {error ? <p className="form-error">{error}</p> : null}
    <Card><div className="detail-grid"><Detail label="Client" value={contract.client?.company_name} /><Detail label="Value" value={formatCurrency(contract.contract_value)} /><Detail label="Start" value={contract.start_date ? formatDate(contract.start_date) : null} /><Detail label="End" value={contract.end_date ? formatDate(contract.end_date) : null} /></div>
      <p>{contract.scope || contract.content || "No scope recorded."}</p><p>{contract.terms_and_conditions || "No terms recorded."}</p></Card>
    <Card><h2>Signed versions</h2><label>Upload a new immutable version<input type="file" onChange={(event) => void upload(event.target.files?.[0])} /></label>
      {versions.length ? <Table><thead><tr><th>Version</th><th>File</th><th>Signed</th></tr></thead><tbody>{versions.map((item) => <tr key={item.id}><td>v{item.version_number}</td><td>{item.file_name || "-"}</td><td>{item.signed_at ? formatDate(item.signed_at) : "-"}</td></tr>)}</tbody></Table> : <p className="muted">No signed versions.</p>}</Card>
    <Card><h2>Related invoices</h2>{invoices.length ? <ul>{invoices.map((item) => <li key={item.id}><Link href={`/invoices/${item.id}`}>{item.invoice_number}</Link> — {formatCurrency(item.total_amount)}</li>)}</ul> : <p className="muted">No invoices.</p>}</Card>
    <Card><h2>History</h2>{history.length ? <ul>{history.map((item) => <li key={item.id}>{formatDate(item.created_at)} — {item.description}</li>)}</ul> : <p className="muted">No events recorded.</p>}</Card>
  </section>;
}
function Detail({ label, value }: { label: string; value?: string | null }) { return <div className="detail-item"><span>{label}</span><strong>{value || "-"}</strong></div>; }
