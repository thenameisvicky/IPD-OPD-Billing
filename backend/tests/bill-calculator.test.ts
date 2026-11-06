import { describe, expect, it } from "vitest";
import { calculateBill, calculateLosDays } from "../src/modules/billing/calculator";
import { amountInWordsInr, moneyToString } from "../src/lib/money";

/** Reference bill arithmetic from product brief (synthetic fixture). */
const REFERENCE_LINES = [
  { description: "Room Rent (Single AC Room)", unit: "PER_DAY", rate: "4500", quantity: "4", days: "4" },
  { description: "Nursing & Resident Doctor Charges", unit: "PER_DAY", rate: "1500", quantity: "4", days: "4" },
  { description: "Treating Doctor Consultation Fees", unit: "PER_DAY", rate: "1200", quantity: "4", days: "4" },
  { description: "Specialist Cross-Consultation (Endo)", unit: "PER_VISIT", rate: "1500", quantity: "1" },
  { description: "Cath Lab / Operation Theatre Charges", unit: "LUMP_SUM", rate: "28000", quantity: "1" },
  { description: "Procedure Fee (Interventional Angioplasty)", unit: "LUMP_SUM", rate: "45000", quantity: "1" },
  { description: "Anesthetist Charges", unit: "LUMP_SUM", rate: "8000", quantity: "1" },
  { description: "Coronary Drug-Eluting Stent (DES)", unit: "PER_ITEM", rate: "29600", quantity: "1" },
  { description: "Pharmacy & In-house Consumables (Annex-1)", unit: "AS_BILLED", rate: "18450", quantity: "1" },
  { description: "Laboratory Investigations (Blood, Trop-I)", unit: "AS_BILLED", rate: "6200", quantity: "1" },
  { description: "Radiology / Diagnostics (ECG, 2D Echo)", unit: "AS_BILLED", rate: "4500", quantity: "1" },
  { description: "Medical Record & Documentation Charges", unit: "LUMP_SUM", rate: "500", quantity: "1" },
] as const;

describe("bill calculator — reference invoice", () => {
  it("computes each line total and gross/net totals", () => {
    const bill = calculateBill([...REFERENCE_LINES]);

    const expectedLineTotals = [
      "18000.00",
      "6000.00",
      "4800.00",
      "1500.00",
      "28000.00",
      "45000.00",
      "8000.00",
      "29600.00",
      "18450.00",
      "6200.00",
      "4500.00",
      "500.00",
    ];

    expect(bill.lines.map((l) => l.lineTotal)).toEqual(expectedLineTotals);
    // Line items sum to 170550.00. The sample document's printed gross
    // (162550.00) understates the lines by exactly the anesthetist amount (8000).
    expect(bill.subtotal).toBe("170550.00");
    expect(bill.discountTotal).toBe("0.00");
    expect(bill.taxTotal).toBe("0.00");
    expect(bill.grandTotal).toBe("170550.00");
  });

  it("formats amount in Indian words for net bill", () => {
    const words = amountInWordsInr("170550.00");
    expect(words).toContain("One Lakh");
    expect(words).toContain("Seventy Thousand");
    expect(words).toContain("Five Hundred");
    expect(words).toContain("Fifty");
    expect(words.endsWith("Only")).toBe(true);
  });

  it("settlement math: advance + final payment = net, outstanding nil", () => {
    const net = 170550;
    const advance = 30000;
    const finalPay = 140550;
    expect(advance + finalPay).toBe(net);
    expect(net - advance - finalPay).toBe(0);
    expect(moneyToString(net - advance - finalPay)).toBe("0.00");
  });

  it("handles discounts", () => {
    const bill = calculateBill([
      {
        description: "Room",
        unit: "PER_DAY",
        rate: "4500",
        quantity: "4",
        days: "4",
        discountAmount: "500",
      },
    ]);
    expect(bill.subtotal).toBe("18000.00");
    expect(bill.discountTotal).toBe("500.00");
    expect(bill.grandTotal).toBe("17500.00");
  });

  it("applies tax profiles when configured", () => {
    const bill = calculateBill([
      {
        description: "Taxable service",
        unit: "LUMP_SUM",
        rate: "1000",
        quantity: "1",
        taxProfile: {
          isExempt: false,
          cgstRate: "2.5",
          sgstRate: "2.5",
          igstRate: "0",
        },
      },
    ]);
    expect(bill.taxTotal).toBe("50.00");
    expect(bill.grandTotal).toBe("1050.00");
  });

  it("uses decimal precision — no float drift", () => {
    const bill = calculateBill([
      { description: "A", unit: "PER_ITEM", rate: "0.10", quantity: "3" },
      { description: "B", unit: "PER_ITEM", rate: "0.20", quantity: "3" },
    ]);
    expect(bill.grandTotal).toBe("0.90");
  });
});

describe("length of stay", () => {
  it("exclusive calendar policy matches reference 4-day stay", () => {
    const admitted = new Date("2026-10-24T10:15:00+05:30");
    const discharged = new Date("2026-10-28T14:30:00+05:30");
    expect(calculateLosDays(admitted, discharged, "CALENDAR_DAY_EXCLUSIVE")).toBe(4);
  });

  it("inclusive calendar policy counts both end dates", () => {
    const admitted = new Date("2026-10-24T10:15:00+05:30");
    const discharged = new Date("2026-10-28T14:30:00+05:30");
    expect(calculateLosDays(admitted, discharged, "CALENDAR_DAY")).toBe(5);
  });
});
