import { Router } from "express";
import { money, moneyToString } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { timed } from "../../lib/requestContext";
import { ok } from "../../lib/response";
import { requireAuth } from "../../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/dashboard", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfDay(addDays(weekStart, 6));

    // 11 parallel Prisma ops — wall time ≈ slowest branch; dbMsSum in logs is sum of SQL durations.
    const [
      activeAdmissions,
      billingPending,
      draftChargeAgg,
      advanceOpen,
      outstandingInvoices,
      recentInvoices,
      weekPayments,
      weekAdvances,
      recentAdmissions,
      recentPayments,
      recentAdvanceRows,
    ] = await timed("dashboard.parallel_queries", () =>
      Promise.all([
        timed("metrics.active_admissions", () =>
          prisma.admission.count({ where: { hospitalId, status: "ADMITTED" } }),
        ),
        timed("metrics.billing_pending", () =>
          prisma.admission.count({ where: { hospitalId, status: "BILLING" } }),
        ),
        timed("metrics.draft_charges", () =>
          prisma.admissionCharge.aggregate({
            where: { hospitalId, status: "DRAFT" },
            _sum: { lineTotal: true },
            _count: true,
          }),
        ),
        timed("metrics.advance_balance", () =>
          prisma.advance.aggregate({
            where: {
              hospitalId,
              status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] },
            },
            _sum: { balance: true },
          }),
        ),
        timed("metrics.outstanding", () =>
          prisma.invoice.aggregate({
            where: {
              hospitalId,
              status: { in: ["ISSUED", "PARTIALLY_PAID"] },
            },
            _sum: { outstanding: true },
            _count: true,
          }),
        ),
        timed("list.recent_invoices", () =>
          prisma.invoice.findMany({
            where: {
              hospitalId,
              purpose: "FINAL",
              status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] },
            },
            take: 12,
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              number: true,
              status: true,
              issuedAt: true,
              createdAt: true,
              grandTotal: true,
              outstanding: true,
              patient: { select: { displayName: true, uhid: true } },
              admission: { select: { ipNumber: true } },
            },
          }),
        ),
        timed("chart.week_payments", () =>
          prisma.payment.findMany({
            where: {
              hospitalId,
              status: "COMPLETED",
              receivedAt: { gte: weekStart, lte: weekEnd },
            },
            select: { amount: true, receivedAt: true },
          }),
        ),
        timed("chart.week_advances", () =>
          prisma.advance.findMany({
            where: {
              hospitalId,
              receivedAt: { gte: weekStart, lte: weekEnd },
            },
            select: { amount: true, receivedAt: true },
          }),
        ),
        timed("list.active_admissions", () =>
          prisma.admission.findMany({
            where: { hospitalId, status: { in: ["ADMITTED", "BILLING"] } },
            select: {
              id: true,
              ipNumber: true,
              status: true,
              admittedAt: true,
              patient: { select: { displayName: true, uhid: true } },
              practitioner: { select: { name: true } },
              currentBed: {
                select: { code: true, room: { select: { name: true } } },
              },
              advances: { select: { balance: true } },
              charges: { where: { status: "DRAFT" }, select: { lineTotal: true } },
              invoices: {
                where: { purpose: "FINAL", status: { not: "CANCELLED" } },
                orderBy: { issuedAt: "desc" },
                take: 1,
                select: { id: true, number: true },
              },
            },
            orderBy: { admittedAt: "desc" },
            take: 12,
          }),
        ),
        timed("activity.recent_payments", () =>
          prisma.payment.findMany({
            where: { hospitalId, status: "COMPLETED" },
            select: {
              id: true,
              number: true,
              amount: true,
              receivedAt: true,
              patient: { select: { displayName: true } },
            },
            orderBy: { receivedAt: "desc" },
            take: 8,
          }),
        ),
        timed("activity.recent_advances", () =>
          prisma.advance.findMany({
            where: { hospitalId },
            select: {
              id: true,
              number: true,
              amount: true,
              receivedAt: true,
              patient: { select: { displayName: true } },
            },
            orderBy: { receivedAt: "desc" },
            take: 8,
          }),
        ),
      ]),
    );

    const weeklyIncoming = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const from = startOfDay(day);
      const to = endOfDay(day);
      const paySum = weekPayments
        .filter((p) => p.receivedAt >= from && p.receivedAt <= to)
        .reduce((s, p) => s + Number(p.amount), 0);
      const advSum = weekAdvances
        .filter((a) => a.receivedAt >= from && a.receivedAt <= to)
        .reduce((s, a) => s + Number(a.amount), 0);
      return {
        date: from.toISOString().slice(0, 10),
        dayLabel: from.toLocaleDateString("en-IN", { weekday: "short" }),
        amount: moneyToString(paySum + advSum),
        amountNumber: paySum + advSum,
      };
    });

    const activities = [
      ...recentInvoices.map((inv) => ({
        id: `inv-${inv.id}`,
        type: "INVOICE",
        title: `Invoice ${inv.number}`,
        detail: `${inv.patient.displayName} · ${moneyToString(inv.grandTotal)}`,
        at: inv.issuedAt || inv.createdAt,
        refId: inv.id,
        refNumber: inv.number,
      })),
      ...recentPayments.map((p) => ({
        id: `pay-${p.id}`,
        type: "PAYMENT",
        title: `Payment ${p.number}`,
        detail: `${p.patient.displayName} · ${moneyToString(p.amount)}`,
        at: p.receivedAt,
        refId: p.id,
        refNumber: p.number,
      })),
      ...recentAdvanceRows.map((a) => ({
        id: `adv-${a.id}`,
        type: "ADVANCE",
        title: `Advance ${a.number}`,
        detail: `${a.patient.displayName} · ${moneyToString(a.amount)}`,
        at: a.receivedAt,
        refId: a.id,
        refNumber: a.number,
      })),
      ...recentAdmissions.map((a) => ({
        id: `adm-${a.id}`,
        type: "ADMISSION",
        title: `Admission ${a.ipNumber}`,
        detail: `${a.patient.displayName} · ${a.status}`,
        at: a.admittedAt,
        refId: a.id,
        refNumber: a.ipNumber,
      })),
    ]
      .sort((a, b) => new Date(b.at!).getTime() - new Date(a.at!).getTime())
      .slice(0, 20);

    return ok(res, {
      metrics: {
        activeAdmissions,
        dischargesPendingBilling: billingPending,
        draftChargeCount: draftChargeAgg._count,
        draftChargesTotal: moneyToString(draftChargeAgg._sum.lineTotal || 0),
        advanceBalance: moneyToString(advanceOpen._sum.balance || 0),
        outstandingTotal: moneyToString(outstandingInvoices._sum.outstanding || 0),
        outstandingInvoiceCount: outstandingInvoices._count,
        finalizedInvoiceCount: recentInvoices.length,
      },
      weeklyIncoming,
      activities,
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        patientName: inv.patient.displayName,
        uhid: inv.patient.uhid,
        ipNumber: inv.admission?.ipNumber || null,
        grandTotal: moneyToString(inv.grandTotal),
        outstanding: moneyToString(inv.outstanding),
        status: inv.status,
        issuedAt: inv.issuedAt,
      })),
      recentAdmissions: recentAdmissions.map((a) => ({
        id: a.id,
        ipNumber: a.ipNumber,
        status: a.status,
        patientName: a.patient.displayName,
        uhid: a.patient.uhid,
        admittedAt: a.admittedAt,
        doctor: a.practitioner?.name || null,
        ward: a.currentBed?.room?.name || null,
        bed: a.currentBed?.code || null,
        deposit: moneyToString(a.advances.reduce((s, x) => s + Number(x.balance), 0)),
        estimatedBill: moneyToString(a.charges.reduce((s, x) => s + Number(x.lineTotal), 0)),
        invoiceNumber: a.invoices[0]?.number || null,
        invoiceId: a.invoices[0]?.id || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/daily-collection", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const from = startOfDay(date);
    const to = endOfDay(date);

    const [payments, advances, refunds] = await Promise.all([
      prisma.payment.findMany({
        where: { hospitalId, receivedAt: { gte: from, lte: to }, status: "COMPLETED" },
        include: { patient: true },
      }),
      prisma.advance.findMany({
        where: { hospitalId, receivedAt: { gte: from, lte: to } },
        include: { patient: true },
      }),
      prisma.refund.findMany({
        where: {
          hospitalId,
          paidAt: { gte: from, lte: to },
          status: "PAID",
        },
      }),
    ]);

    const byMethod: Record<string, ReturnType<typeof money>> = {};
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || money(0)).plus(p.amount);
    }
    for (const a of advances) {
      byMethod[a.method] = (byMethod[a.method] || money(0)).plus(a.amount);
    }

    return ok(res, {
      date: from.toISOString().slice(0, 10),
      payments: payments.map((p) => ({
        ...p,
        amount: moneyToString(p.amount),
        patientName: p.patient.displayName,
      })),
      advances: advances.map((a) => ({
        ...a,
        amount: moneyToString(a.amount),
        patientName: a.patient.displayName,
      })),
      totals: {
        payments: moneyToString(payments.reduce((s, p) => s + Number(p.amount), 0)),
        advances: moneyToString(advances.reduce((s, a) => s + Number(a.amount), 0)),
        refunds: moneyToString(refunds.reduce((s, r) => s + Number(r.amount), 0)),
        byMethod: Object.fromEntries(
          Object.entries(byMethod).map(([k, v]) => [k, moneyToString(v)]),
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
