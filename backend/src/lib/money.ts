import Decimal from "decimal.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export type MoneyInput = string | number | Decimal;

export function money(value: MoneyInput = 0): Decimal {
  return new Decimal(value || 0);
}

export function roundMoney(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function moneyToString(value: MoneyInput): string {
  return roundMoney(value).toFixed(2);
}

export function moneyToNumber(value: MoneyInput): number {
  return Number(moneyToString(value));
}

export function calcLineTotal(params: {
  rate: MoneyInput;
  quantity: MoneyInput;
  discountAmount?: MoneyInput;
  taxAmount?: MoneyInput;
}): Decimal {
  const gross = money(params.rate).mul(params.quantity);
  const afterDiscount = gross.minus(params.discountAmount || 0);
  return roundMoney(afterDiscount.plus(params.taxAmount || 0));
}

export function calcTaxAmount(params: {
  taxableBase: MoneyInput;
  cgstRate?: MoneyInput;
  sgstRate?: MoneyInput;
  igstRate?: MoneyInput;
  isExempt?: boolean;
}): Decimal {
  if (params.isExempt) return money(0);
  const base = money(params.taxableBase);
  const cgst = base.mul(params.cgstRate || 0).div(100);
  const sgst = base.mul(params.sgstRate || 0).div(100);
  const igst = base.mul(params.igstRate || 0).div(100);
  return roundMoney(cgst.plus(sgst).plus(igst));
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** Indian numbering system amount-in-words for whole rupees. */
export function amountInWordsInr(value: MoneyInput): string {
  const rounded = roundMoney(value);
  const [rupeesStr, paiseStr] = rounded.toFixed(2).split(".");
  let n = Number(rupeesStr);
  if (n === 0 && Number(paiseStr) === 0) return "Rupees Zero Only";

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = `Rupees ${parts.join(" ")}`;
  const paise = Number(paiseStr);
  if (paise > 0) {
    words += ` and ${twoDigits(paise)} Paise`;
  }
  return `${words} Only`;
}

export function formatInr(value: MoneyInput): string {
  const num = moneyToNumber(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
