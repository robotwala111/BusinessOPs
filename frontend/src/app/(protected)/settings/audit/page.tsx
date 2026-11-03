"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { historyService } from "@/services/historyService";
import { formatDate } from "@/utils/formatDate";
import type { EntityHistory } from "@/types/workflow";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<EntityHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await historyService.listAll(100);
        setLogs(data);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const filteredLogs = typeFilter === "all" ? logs : logs.filter((l) => l.entity_type === typeFilter);

  return (
    <ModuleScaffold
      title="System Audit Trail & Compliance"
      eyebrow="Security & Governance"
      description="Immutable event log of client modifications, financial authorizations, document status transitions, and user actions."
      isLoading={isLoading}
      isEmpty={false}
    >
      <div className="wizard-hero-banner" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Enterprise Security Audit Trail</h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
            Real-time regulatory compliance trail tracking user actor IDs, timestamped entity events, and state mutations.
          </p>
        </div>
        <select
          className="input-base"
          style={{ width: "auto" }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Entity Types</option>
          <option value="client">Client Accounts</option>
          <option value="quotation">Quotations</option>
          <option value="invoice">Invoices</option>
          <option value="payment">Payments</option>
          <option value="contract">Contracts</option>
          <option value="project">Projects</option>
        </select>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Entity</th>
              <th>Action / Event</th>
              <th>Description</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="table-empty-cell">
                  No audit log entries recorded matching your filter.
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}
                    </span>
                  </td>
                  <td>
                    <span className="count-pill uppercase">{entry.entity_type}</span>
                  </td>
                  <td>
                    <strong>{entry.event_type.replace(/_/g, " ")}</strong>
                  </td>
                  <td>
                    <span>{entry.description || "State updated"}</span>
                  </td>
                  <td>
                    <span className="code-tag">{entry.entity_id.slice(0, 8)}...</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </ModuleScaffold>
  );
}

