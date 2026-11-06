import type { NumberSeriesKind, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { getFiscalYear } from "../../lib/fiscalYear";

type Tx = Prisma.TransactionClient;

export async function nextNumber(
  tx: Tx,
  params: {
    hospitalId: string;
    kind: NumberSeriesKind;
    fiscalYearStartMonth?: number;
    useFiscalYear?: boolean;
  },
): Promise<string> {
  const useFy = params.useFiscalYear !== false;
  const fy = useFy
    ? getFiscalYear(new Date(), params.fiscalYearStartMonth ?? 4)
    : null;

  const existing = await tx.numberSeries.findFirst({
    where: {
      hospitalId: params.hospitalId,
      kind: params.kind,
      fiscalYear: fy,
    },
  });

  if (!existing) {
    throw new AppError(
      "NUMBER_SERIES_MISSING",
      `Number series ${params.kind} is not configured`,
      500,
    );
  }

  await tx.numberSeries.update({
    where: { id: existing.id },
    data: { nextValue: { increment: 1 } },
  });

  const seq = String(existing.nextValue).padStart(existing.pad, "0");
  // Patterns:
  // prefix "IP-" => IP-00001
  // prefix "DEMO/IP/{FY}/" => DEMO/IP/2026-27/0001
  // prefix "REC-{FY}/" => REC-2026-27/0001
  const prefix = existing.prefix.replace(/\{FY\}/g, fy || "");
  if (prefix.includes("{SEQ}")) {
    return prefix.replace(/\{SEQ\}/g, seq);
  }
  return `${prefix}${seq}`;
}
