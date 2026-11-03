"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/business/StatusPill";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import { historyService } from "@/services/historyService";
import { maintenanceService } from "@/services/maintenanceService";
import { ticketTimeEntryService } from "@/services/ticketTimeEntryService";
import type { SupportTicket } from "@/types/maintenance";
import type { TicketTimeEntry } from "@/types/ticketTimeEntry";
import type { EntityHistory } from "@/types/workflow";
import { formatDate } from "@/utils/formatDate";

export default function TicketDetail({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [entries, setEntries] = useState<TicketTimeEntry[]>([]);
  const [history, setHistory] = useState<EntityHistory[]>([]);
  const [hours, setHours] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmittingTime, setIsSubmittingTime] = useState(false);

  const load = useCallback(async () => {
    try {
      const [fetchedTicket, fetchedEntries, fetchedHistory] = await Promise.all([
        maintenanceService.getTicketById(params.id),
        ticketTimeEntryService.list(params.id),
        historyService.list("ticket", params.id)
      ]);
      setTicket(fetchedTicket);
      setEntries(fetchedEntries);
      setHistory(fetchedHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load ticket.");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTime(e: FormEvent) {
    e.preventDefault();
    if (hours <= 0) return;
    setIsSubmittingTime(true);

    try {
      await ticketTimeEntryService.add({
        ticket_id: params.id,
        user_id: user?.id ?? null,
        entry_date: new Date().toISOString().slice(0, 10),
        hours,
        notes: notes || null,
        eligible_for_maintenance: true,
        created_by: user?.id ?? null
      });
      setHours(0);
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record time entry.");
    } finally {
      setIsSubmittingTime(false);
    }
  }

  if (!ticket) return <div className="route-placeholder">{error || "Loading ticket..."}</div>;

  const remaining = ticket.resolution_deadline
    ? new Date(ticket.resolution_deadline).getTime() - Date.now()
    : null;
  const isClosed = ["resolved", "closed", "cancelled"].includes(ticket.status);
  const totalLoggedHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <section className="module-page">
      <div style={{ marginBottom: "8px" }}>
        <Link href="/support" className="back-button" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.88rem", fontWeight: 600 }}>
          &larr; Back to Support Tickets
        </Link>
      </div>

      <div className="module-header">
        <div>
          <p className="eyebrow">Support Ticket</p>
          <h1>{ticket.ticket_number}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
            <StatusPill value={ticket.status} />
            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
              Priority: <strong style={{ textTransform: "uppercase" }}>{ticket.priority}</strong>
            </span>
            {ticket.client && (
              <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Client: <strong>{ticket.client.company_name}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="module-actions">
          {allowedTransitions("ticket", ticket.status).map((s) => (
            <Button
              key={s}
              variant="secondary"
              onClick={() => {
                const reason = s === "reopened" ? prompt("Please provide a reason for reopening this ticket:") ?? "" : "";
                if (s !== "reopened" || reason.trim()) {
                  void maintenanceService
                    .transitionTicket(ticket, s as SupportTicket["status"], user?.id ?? null, reason)
                    .then(load)
                    .catch((e) => setError(e instanceof Error ? e.message : "Unable to update status."));
                }
              }}
            >
              Mark {s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="quotation-section-grid">
        <Card>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "12px" }}>Ticket Overview</h2>
          <p style={{ fontWeight: 600, fontSize: "1rem", color: "#0f172a", marginBottom: "8px" }}>{ticket.title}</p>
          <p style={{ color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ticket.description || "No description provided."}</p>

          <div className="detail-grid" style={{ marginTop: "20px" }}>
            <div className="detail-item">
              <span>Client</span>
              <strong>{ticket.client?.company_name || "-"}</strong>
            </div>
            <div className="detail-item">
              <span>Assigned To</span>
              <strong>{ticket.assigned_to || "Unassigned"}</strong>
            </div>
            <div className="detail-item">
              <span>Opened At</span>
              <strong>{formatDate(ticket.opened_at)}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "12px" }}>SLA & Response Benchmarks</h2>
          <div style={{ display: "grid", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Response Target:</span>
              <strong>{ticket.response_deadline ? formatDate(ticket.response_deadline) : "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Resolution Target:</span>
              <strong>{ticket.resolution_deadline ? formatDate(ticket.resolution_deadline) : "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>SLA Status:</span>
              {remaining !== null && !isClosed ? (
                remaining < 0 ? (
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ Breached</span>
                ) : (
                  <span style={{ color: "#059669", fontWeight: 700 }}>
                    {Math.ceil(remaining / 3600000)} hours remaining
                  </span>
                )
              ) : (
                <span style={{ color: "#059669" }}>{isClosed ? "Completed" : "On schedule"}</span>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Total Logged Hours:</span>
              <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>{totalLoggedHours} hrs</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 style={{ fontSize: "1.15rem", marginBottom: "16px" }}>Service Time Entries ({totalLoggedHours}h total)</h2>
        <form onSubmit={addTime} className="client-form" style={{ marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid #e2e8f0" }}>
          <div className="form-grid two-columns">
            <label>
              Logged Hours (Decimal)
              <Input
                type="number"
                step="0.25"
                min="0.25"
                placeholder="e.g. 1.5"
                value={hours || ""}
                onChange={(e) => setHours(Number(e.target.value))}
                required
              />
            </label>
            <label>
              Work Log / Activity Notes
              <Input
                placeholder="Description of work completed..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <div className="form-actions" style={{ marginTop: "12px" }}>
            <Button type="submit" disabled={isSubmittingTime || hours <= 0}>
              {isSubmittingTime ? "Logging..." : "Log Time"}
            </Button>
          </div>
        </form>

        {entries.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div>
                  <strong style={{ color: "#0f172a" }}>{e.hours} hours</strong>
                  <span style={{ color: "#64748b", marginLeft: "10px" }}>{e.notes || "No notes"}</span>
                </div>
                <small style={{ color: "#94a3b8" }}>{formatDate(e.entry_date)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#94a3b8", fontStyle: "italic", margin: "10px 0" }}>No time entries recorded yet for this ticket.</p>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: "1.15rem", marginBottom: "14px" }}>Lifecycle Audit Trail</h2>
        {history.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "10px" }}>
            {history.map((h) => (
              <li key={h.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start", fontSize: "0.875rem" }}>
                <span style={{ color: "#94a3b8", minWidth: "140px" }}>{formatDate(h.created_at)}</span>
                <span style={{ color: "#334155" }}>{h.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#94a3b8", fontStyle: "italic", margin: "10px 0" }}>No history recorded yet.</p>
        )}
      </Card>
    </section>
  );
}
