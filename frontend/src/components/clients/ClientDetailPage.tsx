"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClientStatusBadge } from "@/components/clients/ClientStatusBadge";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { StatCard } from "@/components/ui/StatCard";
import { activityService } from "@/services/activityService";
import { clientService } from "@/services/clientService";
import { contactService } from "@/services/contactService";
import { projectService } from "@/services/projectService";
import { client360Service } from "@/services/client360Service";
import { useAuth } from "@/hooks/useAuth";
import type { Activity } from "@/types/activity";
import type { Client } from "@/types/client";
import type { Contact } from "@/types/contact";
import type { Project } from "@/types/project";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

type ClientDetailPageProps = {
  clientId: string;
};

export function ClientDetailPage({ clientId }: ClientDetailPageProps) {
  const { user } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState({ totalQuoted: 0, acceptedQuoted: 0,
    contractValue: 0, totalInvoiced: 0, totalCollected: 0, outstanding: 0,
    approvedExpenses: 0, grossMargin: 0, grossMarginPercentage: 0 });
  const [relatedCounts, setRelatedCounts] = useState({ quotations: 0, contracts: 0,
    invoices: 0, expenses: 0, maintenance: 0, tickets: 0 });

  useEffect(() => {
    async function loadClient() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        setClient(await clientService.getClientById(clientId));
        const [nextProjects, nextContacts, nextActivities, commercial] = await Promise.all([
          projectService.getProjectsByClient(clientId),
          contactService.getContactsByClient(clientId),
          activityService.getActivitiesByClient(clientId, 5),
          client360Service.load(clientId)
        ]);
        setProjects(nextProjects);
        setContacts(nextContacts);
        setActivities(nextActivities);
        setSummary(commercial.summary);
        setRelatedCounts({ quotations: commercial.quotations.length, contracts: commercial.contracts.length,
          invoices: commercial.invoices.length, expenses: commercial.expenses.length,
          maintenance: commercial.maintenance.length, tickets: commercial.tickets.length });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load client."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadClient();
  }, [clientId]);

  if (isLoading) {
    return <div className="route-placeholder">Loading client...</div>;
  }

  if (errorMessage) {
    return <div className="form-error">{errorMessage}</div>;
  }

  if (!client) {
    return <div className="route-placeholder">Client not found.</div>;
  }

  async function archiveClient() {
    const currentClient = client;
    if (!currentClient) return;
    if (!window.confirm("Archive this client? Related commercial records will remain available.")) return;
    try {
      await clientService.archiveClient(currentClient.id, user?.id ?? null);
      setClient({ ...currentClient, status: "archived", archived_at: new Date().toISOString() });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to archive client.");
    }
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Client Details</p>
          <h1>{client.company_name}</h1>
          <ClientStatusBadge status={client.status} />
        </div>
        <div className="module-actions">
          <BackButton fallbackHref="/clients" />
          <Link href="/contacts">
            <Button type="button" variant="secondary">Add Contact</Button>
          </Link>
          <Link href="/activities">
            <Button type="button" variant="secondary">Add Activity</Button>
          </Link>
          <Link href="/activities">
            <Button type="button" variant="secondary">View All</Button>
          </Link>
          <Link href={`/clients/${client.id}/edit`}>
            <Button type="button">Edit Client</Button>
          </Link>
          {client.status !== "archived" ? <Button type="button" variant="danger" onClick={() => void archiveClient()}>Archive</Button> : null}
        </div>
      </div>

      <Card>
        <div className="detail-grid">
          <DetailItem label="Short name" value={client.client_short_name} />
          <DetailItem label="Contact person" value={client.contact_person} />
          <DetailItem label="Email" value={client.email} />
          <DetailItem label="Phone" value={client.phone} />
          <DetailItem label="GST number" value={client.gst_number} />
          <DetailItem label="PAN number" value={client.pan_number} />
          <DetailItem label="City" value={client.city} />
          <DetailItem label="State" value={client.state} />
          <DetailItem label="Country" value={client.country} />
          <DetailItem label="Industry" value={client.industry} />
          <DetailItem label="Lead source" value={client.lead_source} />
          <DetailItem label="Created" value={formatDate(client.created_at)} />
        </div>
      </Card>

      <div className="dashboard-grid">
        <StatCard label="Total quoted" value={formatCurrency(summary.totalQuoted)} />
        <StatCard label="Accepted quotations" value={formatCurrency(summary.acceptedQuoted)} />
        <StatCard label="Contract value" value={formatCurrency(summary.contractValue)} />
        <StatCard label="Total invoiced" value={formatCurrency(summary.totalInvoiced)} />
        <StatCard label="Total collected" value={formatCurrency(summary.totalCollected)} />
        <StatCard label="Outstanding" value={formatCurrency(summary.outstanding)} />
        <StatCard label="Approved expenses" value={formatCurrency(summary.approvedExpenses)} />
        <StatCard label="Gross margin" value={`${formatCurrency(summary.grossMargin)} (${summary.grossMarginPercentage}%)`} />
      </div>

      <Card>
        <h2>Commercial relationships</h2>
        <div className="detail-grid">
          <DetailItem label="Quotations" value={String(relatedCounts.quotations)} />
          <DetailItem label="Contracts" value={String(relatedCounts.contracts)} />
          <DetailItem label="Invoices" value={String(relatedCounts.invoices)} />
          <DetailItem label="Expenses" value={String(relatedCounts.expenses)} />
          <DetailItem label="Maintenance" value={String(relatedCounts.maintenance)} />
          <DetailItem label="Support tickets" value={String(relatedCounts.tickets)} />
        </div>
      </Card>

      <Card>
        <h2>Address</h2>
        <p>{client.address || "-"}</p>
      </Card>

      <Card>
        <h2>Notes</h2>
        <p>{client.notes || "-"}</p>
      </Card>

      <Card>
        <h2>Contacts</h2>
        {contacts.length === 0 ? (
          <p className="muted">No contacts linked to this client yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Department</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  <td>{contact.full_name}<small>{contact.designation || "-"}</small></td>
                  <td>{contact.department || "-"}</td>
                  <td>{contact.email || "-"}</td>
                  <td>{contact.phone || contact.whatsapp || "-"}</td>
                  <td>{contact.is_primary ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2>Recent Activities</h2>
        {activities.length === 0 ? (
          <p className="muted">No activities linked to this client yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.subject}<small>{activity.activity_type.replace(/_/g, " ")}</small></td>
                  <td>{activity.contact?.full_name || "-"}</td>
                  <td>{activity.status}</td>
                  <td>{activity.priority}</td>
                  <td>{activity.due_date ? formatDate(activity.due_date) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2>Related Projects</h2>
        {projects.length === 0 ? (
          <p className="muted">No projects linked to this client yet.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td><Link href={`/projects/${project.id}`}>{project.project_code}</Link><small>{project.project_name}</small></td>
                  <td>{project.status}</td>
                  <td>{project.priority}</td>
                  <td>{formatCurrency(project.project_value)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
