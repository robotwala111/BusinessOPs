"use client";

import { FormEvent, useEffect, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { StatusPill } from "@/components/business/StatusPill";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { useClients } from "@/hooks/useClients";
import { useContracts } from "@/hooks/useContracts";
import { contractService } from "@/services/contractService";
import { CONTRACT_STATUSES, CONTRACT_TYPES, type Contract, type ContractFormData } from "@/types/contract";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";

const defaultForm: ContractFormData = {
  contract_number: "",
  client_id: "",
  project_id: "",
  quotation_id: "",
  contract_type: "onboarding",
  title: "",
  start_date: "",
  end_date: "",
  status: "draft",
  contract_value: 0,
  renewal_required: false,
  renewal_date: "",
  content: "",
  terms_and_conditions: "",
  signed_file_url: ""
};

export default function ContractsPage() {
  const { filteredContracts, isLoading, errorMessage, searchTerm, statusFilter, typeFilter, setSearchTerm, setStatusFilter, setTypeFilter, saveContract, deleteContract } = useContracts();
  const { clients } = useClients();
  const [form, setForm] = useState<ContractFormData>(defaultForm);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!editing) void contractService.generateContractNumber().then((number) => setForm((current) => ({ ...current, contract_number: number })));
  }, [editing]);

  function edit(contract: Contract) {
    setEditing(contract);
    setForm({
      contract_number: contract.contract_number,
      client_id: contract.client_id,
      project_id: contract.project_id ?? "",
      quotation_id: contract.quotation_id ?? "",
      contract_type: contract.contract_type,
      title: contract.title,
      start_date: contract.start_date ?? "",
      end_date: contract.end_date ?? "",
      status: contract.status,
      contract_value: contract.contract_value,
      renewal_required: contract.renewal_required,
      renewal_date: contract.renewal_date ?? "",
      content: contract.content ?? "",
      terms_and_conditions: contract.terms_and_conditions ?? "",
      signed_file_url: contract.signed_file_url ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!form.client_id || !form.title.trim()) {
      setFormError("Client and title are required.");
      return;
    }
    await saveContract(form, editing?.id);
    setEditing(null);
    setForm(defaultForm);
  }

  function cancelEdit() {
    setFormError("");
    setEditing(null);
    setForm(defaultForm);
  }

  return (
    <ModuleScaffold title="Contracts" eyebrow="Contract Management" description="Track SOWs, NDAs, onboarding, maintenance, change requests, and acceptance documents." errorMessage={errorMessage || formError} isLoading={isLoading} isEmpty={false}>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>Contract number<Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} /></label>
            <label>Client<select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, project_id: "" })}><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label>
            <label>Project<ProjectSelect clientId={form.client_id} value={form.project_id} onChange={(projectId) => setForm({ ...form, project_id: projectId })} /></label>
            <label>Type<select value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value as ContractFormData["contract_type"] })}>{CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}</select></label>
            <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContractFormData["status"] })}>{CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Title<Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label>Value<Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: Number(e.target.value) })} /></label>
            <label>Start date<Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
            <label>End date<Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
            <label>Renewal date<Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} /></label>
            <label>Signed file<input type="file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void contractService.uploadSignedFile(file).then((url) => setForm((current) => ({ ...current, signed_file_url: url }))); }} /></label>
          </div>
          <label><input type="checkbox" checked={form.renewal_required} onChange={(e) => setForm({ ...form, renewal_required: e.target.checked })} /> Renewal required</label>
          <label>Content<textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label>
          <label>Terms and conditions<textarea rows={4} value={form.terms_and_conditions} onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })} /></label>
          <div className="form-actions">{editing ? <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button> : null}<Button type="submit">{editing ? "Save Contract" : "Create Contract"}</Button></div>
        </form>
      </Card>
      <Card className="toolbar-card"><div className="clients-toolbar"><Input placeholder="Search contracts" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option>{CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}><option value="all">All types</option>{CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div></Card>
      <Table><thead><tr><th>Contract</th><th>Client</th><th>Type</th><th>Status</th><th>Value</th><th>Renewal</th><th>Actions</th></tr></thead><tbody>{filteredContracts.map((contract) => <tr key={contract.id}><td>{contract.contract_number}<small>{contract.title}</small></td><td>{contract.client?.company_name || "-"}</td><td>{contract.contract_type}</td><td><StatusPill value={contract.status} /></td><td>{formatCurrency(contract.contract_value)}</td><td>{contract.renewal_date ? formatDate(contract.renewal_date) : "-"}</td><td><div className="table-actions"><button className="link-button" type="button" onClick={() => edit(contract)}>Edit</button>{contract.signed_file_url ? <a href={contract.signed_file_url} target="_blank">File</a> : null}<button className="link-button danger-link" type="button" onClick={() => void deleteContract(contract.id)}>Delete</button></div></td></tr>)}</tbody></Table>
    </ModuleScaffold>
  );
}
