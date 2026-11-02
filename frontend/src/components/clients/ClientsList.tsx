"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientStatusBadge } from "@/components/clients/ClientStatusBadge";
import { clientStatusLabels } from "@/components/clients/clientLabels";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { CLIENT_STATUSES, type Client } from "@/types/client";

export function ClientsList() {
  const {
    clients,
    filteredClients,
    isLoading,
    errorMessage,
    searchTerm,
    statusFilter,
    setSearchTerm,
    setStatusFilter,
    deleteClient
  } = useClients();
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!clientToDelete) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteClient(clientToDelete.id);
      setClientToDelete(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Unable to delete client."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <p className="eyebrow">Client Management</p>
          <h1>Clients</h1>
          <p className="muted">
            Manage leads, active accounts, and client contact records.
          </p>
        </div>
        <Link href="/clients/new">
          <Button type="button">New Client</Button>
        </Link>
      </div>

      <Card className="toolbar-card">
        <div className="clients-toolbar">
          <Input
            placeholder="Search company, contact, email, or phone"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as typeof statusFilter)
            }
          >
            <option value="all">All statuses</option>
            {CLIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {clientStatusLabels[status]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      {isLoading ? (
        <Card>
          <div className="loading-state">Loading clients...</div>
        </Card>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients yet"
            description="Create the first client record to start building the account database."
            action={
              <Link href="/clients/new">
                <Button type="button">New Client</Button>
              </Link>
            }
          />
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card>
          <EmptyState
            title="No matching clients"
            description="Adjust the search term or status filter."
          />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>City</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td>
                  <Link className="table-link" href={`/clients/${client.id}`}>
                    {client.company_name}
                  </Link>
                  {client.client_short_name ? (
                    <small>{client.client_short_name}</small>
                  ) : null}
                </td>
                <td>{client.contact_person || "-"}</td>
                <td>{client.email || "-"}</td>
                <td>{client.phone || "-"}</td>
                <td>
                  <ClientStatusBadge status={client.status} />
                </td>
                <td>{client.city || "-"}</td>
                <td>
                  <div className="table-actions">
                    <Link href={`/clients/${client.id}/edit`}>Edit</Link>
                    <button
                      type="button"
                      className="link-button danger-link"
                      onClick={() => setClientToDelete(client)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {clientToDelete ? (
        <Modal>
          <h2>Delete client?</h2>
          <p className="muted">
            This will remove {clientToDelete.company_name} from the client list.
          </p>
          {deleteError ? <div className="form-error">{deleteError}</div> : null}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setClientToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
