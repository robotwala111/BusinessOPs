import { describe, expect, it } from "vitest";
import { calculateMonthlyFinancials, detectCopilotIntent, estimateAiCostUsd } from "./copilotTools";

describe("copilot read-only business tools", () => {
  it("maps supported questions to predefined intents", () => {
    expect(detectCopilotIntent("Show overdue invoices")).toBe("overdue_invoices");
    expect(detectCopilotIntent("Which projects are delayed?")).toBe("delayed_projects");
    expect(detectCopilotIntent("can you please give me brief on amiro")).toBe("company_brief");
    expect(detectCopilotIntent("what are you doing")).toBe("assistant_status");
    expect(detectCopilotIntent("show all clients")).toBe("clients_overview");
    expect(detectCopilotIntent("show active projects")).toBe("active_projects");
    expect(detectCopilotIntent("Tell me a joke")).toBeNull();
  });

  it("calculates revenue and expenses from records and excludes reversed payments", () => {
    expect(calculateMonthlyFinancials(
      [
        { amount: "100.25", withholding_amount: "10", adjustment_amount: "2" },
        { amount: 50, reversed_at: "2026-11-02T00:00:00Z" }
      ],
      [
        { total_amount: "30", approval_status: "approved" },
        { total_amount: 15, approval_status: "pending" }
      ]
    )).toEqual({ revenue: 112.25, expenses: 45, approvedExpenses: 30 });
  });

  it("leaves cost unknown unless both provider rates are configured", () => {
    expect(estimateAiCostUsd(100, 50, "2", "8")).toBe(0.0006);
    expect(estimateAiCostUsd(100, 50, undefined, "8")).toBeNull();
  });
});
