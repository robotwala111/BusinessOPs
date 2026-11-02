"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useAuth } from "@/hooks/useAuth";
import { maintenanceService } from "@/services/maintenanceService";
import type { MaintenanceContract, SupportTicket } from "@/types/maintenance";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

export default function MaintenanceDetail({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [item, setItem] = useState<MaintenanceContract | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [hours, setHours] = useState({ consumedHours: 0, remainingHours: 0 });
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setItem(await maintenanceService.getMaintenanceById(params.id));
      setTickets((await maintenanceService.getSupportTickets()).filter((ticket) => ticket.maintenance_contract_id === params.id));
      setHours(await maintenanceService.maintenanceHours(params.id));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load agreement."); }
  }, [params.id]);
  useEffect(() => { void load(); }, [load]);
  if (!item) return <div className="route-placeholder">{error || "Loading maintenance agreement..."}</div>;
  return <section className="module-page">
    <div className="module-header"><div><p className="eyebrow">Maintenance agreement</p><h1>{item.plan_name}</h1><p>{item.status}</p></div>
      <div className="module-actions"><Button variant="secondary" onClick={() => void import("@/utils/pdf/generateMaintenancePdf").then(({ generateMaintenancePdf }) => generateMaintenancePdf(item))}>Download PDF</Button>
        <Button onClick={() => void maintenanceService.renewMaintenance(item, user?.id ?? null).then((next) => location.assign(`/maintenance/${next.id}`)).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to renew."))}>Renew</Button></div>
    </div>
    {error ? <p className="form-error">{error}</p> : null}
    <div className="dashboard-grid"><Card className="metric-card"><span>Fee</span><strong>{formatCurrency(item.yearly_fee || item.monthly_fee)}</strong></Card><Card className="metric-card"><span>Included hours</span><strong>{item.included_hours}</strong></Card><Card className="metric-card"><span>Consumed</span><strong>{hours.consumedHours}</strong></Card><Card className="metric-card"><span>Remaining</span><strong>{hours.remainingHours}</strong></Card></div>
    <Card><p>Start: {item.start_date ? formatDate(item.start_date) : "-"} · End: {item.end_date ? formatDate(item.end_date) : "-"}</p><p>Response SLA: {item.response_sla_hours ?? "-"} hours · Resolution SLA: {item.resolution_sla_hours ?? "-"} hours</p><p>{item.notes || "No notes."}</p></Card>
    <Card><h2>Tickets</h2>{tickets.length ? <Table><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><Link href={`/support/${ticket.id}`}>{ticket.ticket_number}</Link><small>{ticket.title}</small></td><td>{ticket.status}</td><td>{ticket.priority}</td></tr>)}</tbody></Table> : <p className="muted">No tickets.</p>}</Card>
  </section>;
}
