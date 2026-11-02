"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { ProjectSelect } from "@/components/projects/ProjectSelect";
import { AutocompleteInput } from "@/components/ui/AutocompleteInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { paymentModeOptions } from "@/data/dropdownOptions";
import { useClients } from "@/hooks/useClients";
import { useExpenses } from "@/hooks/useExpenses";
import { expenseService } from "@/services/expenseService";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseFormData,
} from "@/types/expense";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { useAuth } from "@/hooks/useAuth";
import { allowedTransitions } from "@/lib/workflowRules";
import type { ExpenseStatus } from "@/types/expense";

const defaultForm: ExpenseFormData = {
  expense_number: "",
  expense_date: new Date().toISOString().slice(0, 10),
  category: "cloud",
  vendor_name: "",
  client_id: "",
  project_id: "",
  project_or_reference: "",
  amount: 0,
  tax_amount: 0,
  payment_mode: "",
  receipt_file_url: "",
  billable_to_client: false,
  reimbursable: false,
  approval_status: "pending",
  notes: "",
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const {
    filteredExpenses,
    expenses,
    isLoading,
    errorMessage,
    searchTerm,
    categoryFilter,
    setSearchTerm,
    setCategoryFilter,
    saveExpense,
    deleteExpense,
    loadExpenses,
  } = useExpenses();
  const { clients } = useClients();
  const [form, setForm] = useState<ExpenseFormData>(defaultForm);
  const [editing, setEditing] = useState<Expense | null>(null);
  const monthlyTotal = useMemo(
    () =>
      expenses
        .filter((expense) =>
          expense.expense_date.startsWith(new Date().toISOString().slice(0, 7)),
        )
        .reduce((sum, expense) => sum + expense.total_amount, 0),
    [expenses],
  );
  async function transition(expense: Expense, status: ExpenseStatus) {
    const comments = ["approved", "rejected"].includes(status)
      ? window.prompt("Approval comments:")
      : "";
    if (["approved", "rejected"].includes(status) && !comments?.trim()) return;
    await expenseService.transitionExpense(
      expense.id,
      status,
      user?.id ?? null,
      comments ?? "",
    );
    await loadExpenses();
  }

  useEffect(() => {
    if (!editing)
      void expenseService
        .generateExpenseNumber()
        .then((number) =>
          setForm((current) => ({ ...current, expense_number: number })),
        );
  }, [editing]);

  function edit(expense: Expense) {
    setEditing(expense);
    setForm({
      expense_number: expense.expense_number,
      expense_date: expense.expense_date,
      category: expense.category,
      vendor_name: expense.vendor_name ?? "",
      client_id: expense.client_id ?? "",
      project_id: expense.project_id ?? "",
      project_or_reference: expense.project_or_reference ?? "",
      amount: expense.amount,
      tax_amount: expense.tax_amount,
      payment_mode: expense.payment_mode ?? "",
      receipt_file_url: expense.receipt_file_url ?? "",
      billable_to_client: expense.billable_to_client,
      reimbursable: expense.reimbursable,
      approval_status: expense.approval_status,
      notes: expense.notes ?? "",
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveExpense(form, editing?.id);
    setEditing(null);
    setForm(defaultForm);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm);
  }

  return (
    <ModuleScaffold
      title="Expenses"
      eyebrow="Expense Tracking"
      description="Track operational, project, and client-related expenses."
      errorMessage={errorMessage}
      isLoading={isLoading}
      isEmpty={false}
    >
      <Card className="quote-total-card">
        <span>Monthly expense summary</span>
        <strong>{formatCurrency(monthlyTotal)}</strong>
      </Card>
      <Card>
        <form className="client-form" onSubmit={submit}>
          <div className="form-grid two-columns">
            <label>
              Expense number
              <Input
                value={form.expense_number}
                onChange={(e) =>
                  setForm({ ...form, expense_number: e.target.value })
                }
              />
            </label>
            <label>
              Date
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) =>
                  setForm({ ...form, expense_date: e.target.value })
                }
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as ExpenseFormData["category"],
                  })
                }
              >
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client
              <select
                value={form.client_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    client_id: e.target.value,
                    project_id: "",
                  })
                }
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project
              <ProjectSelect
                clientId={form.client_id}
                value={form.project_id}
                onChange={(projectId) =>
                  setForm({ ...form, project_id: projectId })
                }
              />
            </label>
            <label>
              Vendor
              <Input
                value={form.vendor_name}
                onChange={(e) =>
                  setForm({ ...form, vendor_name: e.target.value })
                }
              />
            </label>
            <label>
              Reference
              <Input
                value={form.project_or_reference}
                onChange={(e) =>
                  setForm({ ...form, project_or_reference: e.target.value })
                }
              />
            </label>
            <label>
              Amount
              <Input
                type="number"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Tax
              <Input
                type="number"
                value={form.tax_amount}
                onChange={(e) =>
                  setForm({ ...form, tax_amount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Payment mode
              <AutocompleteInput
                value={form.payment_mode}
                onChange={(e) =>
                  setForm({ ...form, payment_mode: e.target.value })
                }
                options={paymentModeOptions}
                placeholder="Search payment mode"
              />
            </label>
            <label>
              Receipt file
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void expenseService
                      .uploadReceipt(file)
                      .then((url) =>
                        setForm((current) => ({
                          ...current,
                          receipt_file_url: url,
                        })),
                      );
                }}
              />
            </label>
          </div>
          <label>
            Notes
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <div className="form-actions">
            {editing ? (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit">
              {editing ? "Save Expense" : "Add Expense"}
            </Button>
          </div>
        </form>
      </Card>
      <Card className="toolbar-card">
        <div className="clients-toolbar">
          <Input
            placeholder="Search expenses"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as typeof categoryFilter)
            }
          >
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </Card>
      <Table>
        <thead>
          <tr>
            <th>Expense</th>
            <th>Date</th>
            <th>Category</th>
            <th>Client</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredExpenses.map((expense) => (
            <tr key={expense.id}>
                  <td>
                    <Link href={`/expenses/${expense.id}`}>{expense.expense_number}</Link>
                <small>
                  {expense.vendor_name || expense.project_or_reference || "-"}
                </small>
              </td>
              <td>{formatDate(expense.expense_date)}</td>
              <td>{expense.category}</td>
              <td>{expense.client?.company_name || "-"}</td>
              <td>{formatCurrency(expense.total_amount)}</td>
              <td>{expense.status || "draft"}</td>
              <td>
                <div className="table-actions">
                  {(expense.status || "draft") === "draft" ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => edit(expense)}
                    >
                      Edit
                    </button>
                  ) : null}
                  {allowedTransitions("expense", expense.status || "draft").map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        className="link-button"
                        onClick={() =>
                          void transition(expense, status as ExpenseStatus)
                        }
                      >
                        {status.replace(/_/g, " ")}
                      </button>
                    ),
                  )}
                    <Link href={`/expenses/${expense.id}`}>View</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </ModuleScaffold>
  );
}
