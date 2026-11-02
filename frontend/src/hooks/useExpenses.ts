"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { expenseService } from "@/services/expenseService";
import type { Expense, ExpenseCategory, ExpenseFormData } from "@/types/expense";

export function useExpenses() {
  const { user, profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");

  async function loadExpenses() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setExpenses(await expenseService.getExpenses());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load expenses.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses();
  }, []);

  const filteredExpenses = useMemo(() => expenses.filter((expense) => {
    const q = searchTerm.toLowerCase();
    return (categoryFilter === "all" || expense.category === categoryFilter)
      && (!q || [expense.expense_number, expense.vendor_name, expense.project_or_reference, expense.client?.company_name].some((value) => value?.toLowerCase().includes(q)));
  }), [expenses, searchTerm, categoryFilter]);

  async function saveExpense(data: ExpenseFormData, id?: string) {
    const record = id
      ? await expenseService.updateExpense(id, data)
      : await expenseService.createExpense({ ...data, created_by: user?.id ?? null });
    await loadExpenses();
    return record;
  }

  async function deleteExpense(id: string) {
    if (profile?.role !== "admin") throw new Error("Only admin users can delete expenses.");
    await expenseService.deleteExpense(id);
    setExpenses((current) => current.filter((expense) => expense.id !== id));
  }

  return { expenses, filteredExpenses, isLoading, errorMessage, searchTerm, categoryFilter, setSearchTerm, setCategoryFilter, saveExpense, deleteExpense, loadExpenses };
}
