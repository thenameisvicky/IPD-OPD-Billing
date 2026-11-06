import { Router } from "express";
import { money, moneyToString } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { ok } from "../../lib/response";
import { requireAuth } from "../../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/dashboard", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const [
      activeAdmissions,
      billingPending,
      draftChargeAgg,
      finalizedToday,
      advanceOpen,
      outstandingInvoices,
    ] = await Promise.all([
      prisma.admission.count({
        where: { hospitalId, status: "ADMITTED" },
      }),
      prisma.admission.count({
        where: { hospitalId, status: "BILLING" },
      }),
      prisma.admissionCharge.aggregate({
        where: { hospitalId, status: "DRAFT" },
        _sum: { lineTotal: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: {
          hospitalId,
          purpose: "FINAL",
          status: { not: "CANCELLED" },
          issuedAt: { gte: startOfDay(new Date()) },
        },
        take: 20,
        orderBy: { issuedAt: "desc" },
        include: { patient: true },
      }),
      prisma.advance.aggregate({
        where: {
          hospitalId,
          status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] },
        },
        _sum: { balance: true },
      }),
      prisma.invoice.aggregate({
        where: {
          hospitalId,
          status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        },
        _sum: { outstanding: true },
        _count: true,
      }),
    ]);

    const recentAdmissions = await prisma.admission.findMany({
      where: { hospitalId, status: { in: ["ADMITTED", "BILLING"] } },
      include: {
        patient: true,
        practitioner: true,
        currentBed: { include: { room: true } },
        advances: true,
        charges: { where: { status: "DRAFT" } },
      },
      orderBy: { admittedAt: "desc" },
      take: 20,
    });

    return ok(res, {
      metrics: {
        activeAdmissions,
        dischargesPendingBilling: billingPending,
        draftChargeCount: draftChargeAgg._count,
        draftChargesTotal: moneyToString(draftChargeAgg._sum.lineTotal || 0),
        advanceBalance: moneyToString(advanceOpen._sum.balance || 0),
        outstandingTotal: moneyToString(outstandingInvoices._sum.outstanding || 0),
        outstandingInvoiceCount: outstandingInvoices._count,
        finalizedTodayCount: finalizedToday.length,
      },
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
      })),
      finalizedToday: finalizedToday.map((inv) => ({
        id: inv.id,
        number: inv.number,
        patientName: inv.patient.displayName,
        grandTotal: moneyToString(inv.grandTotal),
        outstanding: moneyToString(inv.outstanding),
        status: inv.status,
        issuedAt: inv.issuedAt,
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
