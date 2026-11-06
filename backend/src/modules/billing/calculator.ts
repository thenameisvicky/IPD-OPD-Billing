import type { ChargeUnit, ServiceCategory } from "@prisma/client";
import {
  amountInWordsInr,
  calcLineTotal,
  calcTaxAmount,
  money,
  moneyToString,
  roundMoney,
  type MoneyInput,
} from "../../lib/money";

export type ChargeLineInput = {
  id?: string;
  description: string;
  category?: ServiceCategory | null;
  unit: ChargeUnit | string;
  rate: MoneyInput;
  quantity: MoneyInput;
  days?: MoneyInput | null;
  discountAmount?: MoneyInput;
  taxProfile?: {
    isExempt: boolean;
    cgstRate: MoneyInput;
    sgstRate: MoneyInput;
    igstRate: MoneyInput;
  } | null;
  serviceItemId?: string | null;
  sourceChargeId?: string | null;
};

export type BillTotals = {
  lines: Array<{
    description: string;
    category?: ServiceCategory | null;
    unitLabel: string;
    rate: string;
    quantity: string;
    discountAmount: string;
    taxAmount: string;
    lineTotal: string;
    serviceItemId?: string | null;
    sourceChargeId?: string | null;
    taxSnapshot?: Record<string, string> | null;
  }>;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  amountInWords: string;
};

export function unitLabel(unit: ChargeUnit | string, quantity: MoneyInput, days?: MoneyInput | null): string {
  const qty = money(days ?? quantity);
  const q = qty.toString();
  switch (unit) {
    case "PER_DAY":
      return `${q} Day${qty.eq(1) ? "" : "s"}`;
    case "PER_VISIT":
      return `${q} Visit${qty.eq(1) ? "" : "s"}`;
    case "PER_PROCEDURE":
      return `${q} Procedure${qty.eq(1) ? "" : "s"}`;
    case "PER_ITEM":
      return `${q} No.`;
    case "PER_UNIT":
      return `${q} Unit${qty.eq(1) ? "" : "s"}`;
    case "LUMP_SUM":
      return "1 L.S.";
    case "AS_BILLED":
      return "As billed";
    default:
      return String(unit);
  }
}

export function calculateBill(lines: ChargeLineInput[]): BillTotals {
  let subtotal = money(0);
  let discountTotal = money(0);
  let taxTotal = money(0);

  const computed = lines.map((line) => {
    const qty = money(line.days != null && line.unit === "PER_DAY" ? line.days : line.quantity);
    const rate = money(line.rate);
    const discount = money(line.discountAmount || 0);
    const taxableBase = roundMoney(rate.mul(qty).minus(discount));

    const taxAmount = line.taxProfile
      ? calcTaxAmount({
          taxableBase,
          isExempt: line.taxProfile.isExempt,
          cgstRate: line.taxProfile.cgstRate,
          sgstRate: line.taxProfile.sgstRate,
          igstRate: line.taxProfile.igstRate,
        })
      : money(0);

    const lineTotal = calcLineTotal({
      rate,
      quantity: qty,
      discountAmount: discount,
      taxAmount,
    });

    // Gross before tax for subtotal reporting (rate * qty)
    subtotal = subtotal.plus(rate.mul(qty));
    discountTotal = discountTotal.plus(discount);
    taxTotal = taxTotal.plus(taxAmount);

    const taxSnapshot = line.taxProfile
      ? {
          cgstRate: moneyToString(line.taxProfile.cgstRate),
          sgstRate: moneyToString(line.taxProfile.sgstRate),
          igstRate: moneyToString(line.taxProfile.igstRate),
          isExempt: String(line.taxProfile.isExempt),
          taxAmount: moneyToString(taxAmount),
        }
      : null;

    return {
      description: line.description,
      category: line.category ?? null,
      unitLabel: unitLabel(line.unit, qty, line.days),
      rate: moneyToString(rate),
      quantity: moneyToString(qty),
      discountAmount: moneyToString(discount),
      taxAmount: moneyToString(taxAmount),
      lineTotal: moneyToString(lineTotal),
      serviceItemId: line.serviceItemId ?? null,
      sourceChargeId: line.sourceChargeId ?? line.id ?? null,
      taxSnapshot,
    };
  });

  const grandTotal = roundMoney(subtotal.minus(discountTotal).plus(taxTotal));

  return {
    lines: computed,
    subtotal: moneyToString(subtotal),
    discountTotal: moneyToString(discountTotal),
    taxTotal: moneyToString(taxTotal),
    grandTotal: moneyToString(grandTotal),
    amountInWords: amountInWordsInr(grandTotal),
  };
}

/** Length of stay helpers — policy-aware. */
export function calculateLosDays(
  admittedAt: Date,
  dischargedAt: Date | null | undefined,
  policy: string = "CALENDAR_DAY",
): number {
  const end = dischargedAt ?? new Date();
  if (end < admittedAt) return 0;

  if (policy === "HOURS_24") {
    const ms = end.getTime() - admittedAt.getTime();
    const hours = ms / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(hours / 24));
  }

  const start = new Date(admittedAt);
  start.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);
  const span = Math.floor((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Discharge day not charged (common IPD room-rent convention; matches sample LOS=4).
  if (policy === "CALENDAR_DAY_EXCLUSIVE" || policy === "CUSTOM") {
    return Math.max(1, span);
  }

  // CALENDAR_DAY: inclusive of admission and discharge calendar dates; same-day = 1
  return Math.max(1, span + 1);
}
