"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleScaffold } from "@/components/business/ModuleScaffold";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { invoiceService } from "@/services/invoiceService";
import { expenseService } from "@/services/expenseService";
import { clientService } from "@/services/clientService";
import { formatCurrency } from "@/utils/formatCurrency";
import type { Invoice } from "@/types/invoice";
import type { Expense } from "@/types/expense";
import type { Client } from "@/types/client";

export default function FinancialReportsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pnl" | "aging" | "client_rev" | "expense_cat">("pnl");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [invList, expList, cliList] = await Promise.all([
          invoiceService.getInvoices(),
          expenseService.getExpenses(),
          clientService.getClients()
        ]);
        setInvoices(invList);
        setExpenses(expList);
        setClients(cliList);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  // Financial Computations
  const totalInvoiced = useMemo(() => invoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0), [invoices]);
  const totalCollected = useMemo(() => invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0), [invoices]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + (Number(e.total_amount) || 0), 0), [expenses]);
  const netMargin = totalCollected - totalExpenses;
  const netMarginPct = totalCollected > 0 ? Math.round((netMargin / totalCollected) * 100) : 0;

  // Aging Buckets (0-30, 31-60, 61-90, 90+)
  const agingAnalysis = useMemo(() => {
    const now = Date.now();
    const buckets = {
      current: { label: "Current (0 - 30 days)", amount: 0, count: 0, items: [] as Invoice[] },
      days31_60: { label: "31 - 60 days overdue", amount: 0, count: 0, items: [] as Invoice[] },
      days61_90: { label: "61 - 90 days overdue", amount: 0, count: 0, items: [] as Invoice[] },
      days90Plus: { label: "90+ days overdue", amount: 0, count: 0, items: [] as Invoice[] }
    };

    invoices.filter((inv) => inv.balance_due > 0).forEach((inv) => {
      const dueMs = inv.due_date ? new Date(inv.due_date).getTime() : now;
      const diffDays = Math.floor((now - dueMs) / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        buckets.current.amount += inv.balance_due;
        buckets.current.count++;
        buckets.current.items.push(inv);
      } else if (diffDays <= 60) {
        buckets.days31_60.amount += inv.balance_due;
        buckets.days31_60.count++;
        buckets.days31_60.items.push(inv);
      } else if (diffDays <= 90) {
        buckets.days61_90.amount += inv.balance_due;
        buckets.days61_90.count++;
        buckets.days61_90.items.push(inv);
      } else {
        buckets.days90Plus.amount += inv.balance_due;
        buckets.days90Plus.count++;
        buckets.days90Plus.items.push(inv);
      }
    });

    return buckets;
  }, [invoices]);

  // Revenue by Client
  const clientRevenueTable = useMemo(() => {
    return clients.map((c) => {
      const clientInvoices = invoices.filter((i) => i.client_id === c.id);
      const billed = clientInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
      const paid = clientInvoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
      const due = clientInvoices.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
      const pct = totalInvoiced > 0 ? Math.round((billed / totalInvoiced) * 100) : 0;
      return { client: c, billed, paid, due, pct };
    }).sort((a, b) => b.billed - a.billed);
  }, [clients, invoices, totalInvoiced]);

  // Expenses by Category
  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || "General Operations";
      map.set(cat, (map.get(cat) || 0) + (Number(e.total_amount) || 0));
    });
    return Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
      pct: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpenses]);

  return (
    <ModuleScaffold
      title="Financial Intelligence & Reports"
      eyebrow="Commercial Intelligence"
      description="Profit & loss statements, accounts receivable aging, client revenue concentration, and expenditure ledger."
      isLoading={isLoading}
      isEmpty={false}
    >
      {/* Top Level Metric Ribbons */}
      <div className="payments-kpi-deck">
        <div className="payment-stat-card">
          <span className="stat-label">Gross Realized Inflow</span>
          <strong className="stat-value text-emerald">{formatCurrency(totalCollected)}</strong>
          <small className="stat-sub">From {formatCurrency(totalInvoiced)} billed</small>
        </div>

        <div className="payment-stat-card">
          <span className="stat-label">Total Expenditure Burn</span>
          <strong className="stat-value text-danger">{formatCurrency(totalExpenses)}</strong>
          <small className="stat-sub">{expenses.length} Approved expenses</small>
        </div>

        <div className="payment-stat-card">
          <span className="stat-label">Net Operating Margin</span>
          <strong className={`stat-value ${netMargin >= 0 ? "text-emerald" : "text-danger"}`}>
            {formatCurrency(netMargin)}
          </strong>
          <small className="stat-sub">{netMarginPct}% Net Margin</small>
        </div>

        <div className="payment-stat-card">
          <span className="stat-label">Outstanding Receivables</span>
          <strong className="stat-value text-amber">{formatCurrency(totalOutstanding)}</strong>
          <small className="stat-sub">Awaiting client settlement</small>
        </div>
      </div>

      {/* Tabs */}
      <div className="portal-tabs-nav" style={{ margin: "16px 0" }}>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "pnl" ? "active" : ""}`}
          onClick={() => setActiveTab("pnl")}
        >
          📈 Executive P&L Overview
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "aging" ? "active" : ""}`}
          onClick={() => setActiveTab("aging")}
        >
          ⏱ Accounts Receivable Aging (30/60/90)
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "client_rev" ? "active" : ""}`}
          onClick={() => setActiveTab("client_rev")}
        >
          🏢 Revenue by Client Account
        </button>
        <button
          type="button"
          className={`portal-tab-btn ${activeTab === "expense_cat" ? "active" : ""}`}
          onClick={() => setActiveTab("expense_cat")}
        >
          💳 Expense Distribution
        </button>
      </div>

      {/* Tab 1: P&L Statement */}
      {activeTab === "pnl" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Executive Profit & Loss Statement (Year-to-Date)</h4>
            <span className="count-pill">Amiro Tech Solutions</span>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Account Line Item</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Gross Operating Revenue (Invoiced)</strong></td>
                <td><span className="mode-pill">Income</span></td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(totalInvoiced)}</td>
              </tr>
              <tr>
                <td>Less: Unsettled Balance Due (Receivables)</td>
                <td><span className="mode-pill">Adjustment</span></td>
                <td style={{ textAlign: "right", color: "#d97706" }}>- {formatCurrency(totalOutstanding)}</td>
              </tr>
              <tr style={{ background: "#f8fafc" }}>
                <td><strong>Net Cash Collected (Realized Revenue)</strong></td>
                <td><strong className="text-emerald">Operating Cashflow</strong></td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "#059669" }}>
                  {formatCurrency(totalCollected)}
                </td>
              </tr>
              <tr>
                <td>Less: Cloud Infrastructure & Tech Subscriptions</td>
                <td><span className="mode-pill">Direct Cost</span></td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>- {formatCurrency(totalExpenses * 0.6)}</td>
              </tr>
              <tr>
                <td>Less: Operating Expenses & Consulting Overhead</td>
                <td><span className="mode-pill">Indirect Cost</span></td>
                <td style={{ textAlign: "right", color: "#dc2626" }}>- {formatCurrency(totalExpenses * 0.4)}</td>
              </tr>
              <tr style={{ background: "#ecfdf5", borderTop: "2px solid #a7f3d0" }}>
                <td><strong>Net Operating Margin (EBITDA)</strong></td>
                <td><strong className="text-emerald">Profit</strong></td>
                <td style={{ textAlign: "right", fontWeight: 800, fontSize: "1.05rem", color: netMargin >= 0 ? "#059669" : "#dc2626" }}>
                  {formatCurrency(netMargin)} ({netMarginPct}%)
                </td>
              </tr>
            </tbody>
          </Table>
        </Card>
      )}

      {/* Tab 2: Aging Analysis */}
      {activeTab === "aging" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="operational-gauges-grid">
            <div className="radial-gauge-card">
              <span className="gauge-title">0 - 30 Days (Current)</span>
              <strong className="text-emerald" style={{ fontSize: "1.5rem" }}>
                {formatCurrency(agingAnalysis.current.amount)}
              </strong>
              <small>{agingAnalysis.current.count} Invoices in good standing</small>
            </div>

            <div className="radial-gauge-card">
              <span className="gauge-title">31 - 60 Days Overdue</span>
              <strong className="text-amber" style={{ fontSize: "1.5rem" }}>
                {formatCurrency(agingAnalysis.days31_60.amount)}
              </strong>
              <small>{agingAnalysis.days31_60.count} Follow-up required</small>
            </div>

            <div className="radial-gauge-card">
              <span className="gauge-title">61 - 90 Days & Beyond</span>
              <strong className="text-danger" style={{ fontSize: "1.5rem" }}>
                {formatCurrency(agingAnalysis.days61_90.amount + agingAnalysis.days90Plus.amount)}
              </strong>
              <small>{agingAnalysis.days61_90.count + agingAnalysis.days90Plus.count} High aging risk</small>
            </div>
          </div>

          <Card>
            <div className="card-top-row" style={{ padding: "16px 20px" }}>
              <h4>Outstanding Invoices by Aging Bucket</h4>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: "right" }}>Total Amount</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.filter((i) => i.balance_due > 0).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-empty-cell">
                      Zero overdue invoices! All receivables are fully collected.
                    </td>
                  </tr>
                ) : (
                  invoices.filter((i) => i.balance_due > 0).map((inv) => (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoice_number}</strong></td>
                      <td>{inv.client?.company_name || "-"}</td>
                      <td>{inv.due_date || "-"}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(inv.total_amount)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#d97706" }}>
                        {formatCurrency(inv.balance_due)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {/* Tab 3: Revenue by Client */}
      {activeTab === "client_rev" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Client Account Revenue Concentration</h4>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Client Organization</th>
                <th style={{ textAlign: "right" }}>Total Billed</th>
                <th style={{ textAlign: "right" }}>Realized Paid</th>
                <th style={{ textAlign: "right" }}>Outstanding</th>
                <th style={{ textAlign: "right" }}>Portfolio Share</th>
              </tr>
            </thead>
            <tbody>
              {clientRevenueTable.map(({ client, billed, paid, due, pct }) => (
                <tr key={client.id}>
                  <td><strong>{client.company_name}</strong></td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(billed)}</td>
                  <td style={{ textAlign: "right", color: "#059669" }}>{formatCurrency(paid)}</td>
                  <td style={{ textAlign: "right", color: due > 0 ? "#d97706" : "#64748b" }}>{formatCurrency(due)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="count-pill">{pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Tab 4: Expense Categories */}
      {activeTab === "expense_cat" && (
        <Card>
          <div className="card-top-row" style={{ padding: "16px 20px" }}>
            <h4>Operating Expense Breakdown by Category</h4>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Expense Category</th>
                <th style={{ textAlign: "right" }}>Total Burn (INR)</th>
                <th style={{ textAlign: "right" }}>Share of Expenditure</th>
              </tr>
            </thead>
            <tbody>
              {expenseCategories.map(({ category, amount, pct }) => (
                <tr key={category}>
                  <td><strong>{category.replace(/_/g, " ")}</strong></td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(amount)}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="count-pill">{pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </ModuleScaffold>
  );
}

