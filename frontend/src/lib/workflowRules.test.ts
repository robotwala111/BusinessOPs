import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./workflowRules";

describe("workflow transitions", () => {
  it("allows the intended quotation and milestone paths", () => {
    expect(canTransition("quotation", "draft", "under_review")).toBe(true);
    expect(canTransition("milestone", "ready_for_review", "accepted")).toBe(true);
  });

  it("locks terminal commercial states", () => {
    expect(canTransition("quotation", "accepted", "draft")).toBe(false);
    expect(canTransition("invoice", "paid", "draft")).toBe(false);
    expect(() => assertTransition("quotation", "accepted", "draft")).toThrow(/Invalid quotation status transition/);
  });
});

