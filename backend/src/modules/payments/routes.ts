import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { money, moneyToString } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { created, ok, paginated } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { nextNumber } from "../numbers/series";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const methodEnum = z.enum([
  "CASH",
  "UPI",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "NET_BANKING",
  "BANK_TRANSFER",
  "OTHER",
]);

const advanceSchema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  method: methodEnum,
  receivedAt: z.string().datetime().optional(),
  transactionRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8).optional(),
});

paymentsRouter.post(
  "/advances",
  requirePermission("payments:write", "*"),
  async (req, res, next) => {
    try {
      const body = advanceSchema.parse(req.body);
      const hospitalId = req.user!.hospitalId;
      const amount = money(body.amount);
      if (amount.lte(0)) throw new AppError("INVALID_AMOUNT", "Amount must be positive", 400);

      if (body.idempotencyKey) {
        const existing = await prisma.advance.findFirst({
          where: { hospitalId, idempotencyKey: body.idempotencyKey },
        });
        if (existing) {
          return ok(res, {
            ...existing,
            amount: moneyToString(existing.amount),
            balance: moneyToString(existing.balance),
          });
        }
      }

      const patient = await prisma.patient.findFirst({
        where: { id: body.patientId, hospitalId },
      });
      if (!patient) throw new AppError("NOT_FOUND", "Patient not found", 404);

      if (body.admissionId) {
        const admission = await prisma.admission.findFirst({
          where: { id: body.admissionId, hospitalId, patientId: body.patientId },
        });
        if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);
      }

      const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });

      const advance = await prisma.$transaction(
        async (tx) => {
        const number = await nextNumber(tx, {
          hospitalId,
          kind: "RECEIPT",
          fiscalYearStartMonth: hospital.financialYearStartMonth,
        });
        const createdAdvance = await tx.advance.create({
          data: {
            hospitalId,
            patientId: body.patientId,
            admissionId: body.admissionId || null,
            number,
            method: body.method,
            amount: moneyToString(amount),
            balance: moneyToString(amount),
            status: "OPEN",
            receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
            receivedById: req.user!.id,
            transactionRef: body.transactionRef || null,
            notes: body.notes || null,
            idempotencyKey: body.idempotencyKey || null,
          },
        });
        await tx.financialTransaction.create({
          data: {
            hospitalId,
            patientId: body.patientId,
            admissionId: body.admissionId || null,
            type: "ADVANCE_RECEIVED",
            amount: moneyToString(amount),
            referenceId: createdAdvance.id,
            referenceType: "Advance",
            metaJson: { number, method: body.method },
          },
        });
        return createdAdvance;
      },
        { timeout: 30000, maxWait: 10000 },
      );

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "advance.collect",
        entityType: "Advance",
        entityId: advance.id,
        afterJson: { number: advance.number, amount: moneyToString(advance.amount) },
        ip: req.ip,
      });

      return created(res, {
        ...advance,
        amount: moneyToString(advance.amount),
        balance: moneyToString(advance.balance),
      });
    } catch (err) {
      next(err);
    }
  },
);

const paymentSchema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  amount: z.union([z.string(), z.number()]),
  method: methodEnum,
  kind: z.enum(["ADVANCE", "SETTLEMENT", "PARTIAL", "OTHER"]).default("SETTLEMENT"),
  receivedAt: z.string().datetime().optional(),
  transactionRef: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocateToInvoice: z.boolean().default(true),
  idempotencyKey: z.string().min(8).optional(),
});

paymentsRouter.post("/", requirePermission("payments:write", "*"), async (req, res, next) => {
  try {
    const body = paymentSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;
    const amount = money(body.amount);
    if (amount.lte(0)) throw new AppError("INVALID_AMOUNT", "Amount must be positive", 400);

    if (body.idempotencyKey) {
      const existing = await prisma.payment.findFirst({
        where: { hospitalId, idempotencyKey: body.idempotencyKey },
        include: { allocations: true },
      });
      if (existing) {
        return ok(res, {
          ...existing,
          amount: moneyToString(existing.amount),
          allocatedAmount: moneyToString(existing.allocatedAmount),
          unallocatedAmount: moneyToString(existing.unallocatedAmount),
        });
      }
    }

    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });

    const payment = await prisma.$transaction(
      async (tx) => {
      const number = await nextNumber(tx, {
        hospitalId,
        kind: "RECEIPT",
        fiscalYearStartMonth: hospital.financialYearStartMonth,
      });

      let allocated = money(0);
      const createdPayment = await tx.payment.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          number,
          method: body.method,
          kind: body.kind,
          amount: moneyToString(amount),
          allocatedAmount: "0.00",
          unallocatedAmount: moneyToString(amount),
          transactionRef: body.transactionRef || null,
          receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
          status: "COMPLETED",
          receivedById: req.user!.id,
          admissionId: body.admissionId || null,
          notes: body.notes || null,
          idempotencyKey: body.idempotencyKey || null,
        },
      });

      if (body.allocateToInvoice && body.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: body.invoiceId,
            hospitalId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          },
        });
        if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found or not payable", 404);

        const outstanding = money(invoice.outstanding);
        if (amount.gt(outstanding)) {
          throw new AppError(
            "OVERPAYMENT",
            `Payment exceeds outstanding balance of ${moneyToString(outstanding)}`,
            400,
          );
        }

        allocated = amount;
        await tx.paymentAllocation.create({
          data: {
            paymentId: createdPayment.id,
            invoiceId: invoice.id,
            amount: moneyToString(allocated),
          },
        });

        const newPaid = money(invoice.paidTotal).plus(allocated);
        const newOutstanding = money(invoice.grandTotal).minus(newPaid);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidTotal: moneyToString(newPaid),
            outstanding: moneyToString(newOutstanding),
            status: newOutstanding.eq(0) ? "PAID" : "PARTIALLY_PAID",
          },
        });

        if (invoice.admissionId && newOutstanding.eq(0)) {
          await tx.admission.update({
            where: { id: invoice.admissionId },
            data: { status: "DISCHARGED" },
          });
        }

        await tx.payment.update({
          where: { id: createdPayment.id },
          data: {
            allocatedAmount: moneyToString(allocated),
            unallocatedAmount: moneyToString(amount.minus(allocated)),
          },
        });
      }

      await tx.financialTransaction.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          admissionId: body.admissionId || null,
          invoiceId: body.invoiceId || null,
          type: "PAYMENT_RECEIVED",
          amount: moneyToString(amount),
          referenceId: createdPayment.id,
          referenceType: "Payment",
          metaJson: { number, method: body.method, allocated: moneyToString(allocated) },
        },
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: createdPayment.id },
        include: { allocations: true },
      });
    },
      { timeout: 30000, maxWait: 10000 },
    );

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "payment.collect",
      entityType: "Payment",
      entityId: payment.id,
      afterJson: { number: payment.number, amount: moneyToString(payment.amount) },
      ip: req.ip,
    });

    return created(res, {
      ...payment,
      amount: moneyToString(payment.amount),
      allocatedAmount: moneyToString(payment.allocatedAmount),
      unallocatedAmount: moneyToString(payment.unallocatedAmount),
    });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post(
  "/allocate",
  requirePermission("payments:write", "*"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          paymentId: z.string().uuid(),
          invoiceId: z.string().uuid(),
          amount: z.union([z.string(), z.number()]),
        })
        .parse(req.body);
      const hospitalId = req.user!.hospitalId;
      const amount = money(body.amount);
      if (amount.lte(0)) throw new AppError("INVALID_AMOUNT", "Amount must be positive", 400);

      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findFirst({
          where: { id: body.paymentId, hospitalId, status: "COMPLETED" },
        });
        if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
        if (amount.gt(payment.unallocatedAmount)) {
          throw new AppError("INSUFFICIENT_UNALLOCATED", "Allocation exceeds unallocated balance", 400);
        }

        const invoice = await tx.invoice.findFirst({
          where: {
            id: body.invoiceId,
            hospitalId,
            status: { in: ["ISSUED", "PARTIALLY_PAID"] },
          },
        });
        if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
        if (amount.gt(invoice.outstanding)) {
          throw new AppError("EXCEEDS_OUTSTANDING", "Allocation exceeds invoice outstanding", 400);
        }

        const existingAlloc = await tx.paymentAllocation.findUnique({
          where: {
            paymentId_invoiceId: { paymentId: payment.id, invoiceId: invoice.id },
          },
        });
        if (existingAlloc) {
          throw new AppError("DUPLICATE_ALLOCATION", "Payment already allocated to this invoice", 409);
        }

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            amount: moneyToString(amount),
          },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            allocatedAmount: moneyToString(money(payment.allocatedAmount).plus(amount)),
            unallocatedAmount: moneyToString(money(payment.unallocatedAmount).minus(amount)),
          },
        });

        const newPaid = money(invoice.paidTotal).plus(amount);
        const newOutstanding = money(invoice.grandTotal).minus(newPaid);
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidTotal: moneyToString(newPaid),
            outstanding: moneyToString(newOutstanding),
            status: newOutstanding.eq(0) ? "PAID" : "PARTIALLY_PAID",
          },
        });

        return updatedInvoice;
      });

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "payment.allocate",
        entityType: "Invoice",
        entityId: result.id,
        afterJson: { paymentId: body.paymentId, amount: moneyToString(amount) },
        ip: req.ip,
      });

      return ok(res, {
        ...result,
        outstanding: moneyToString(result.outstanding),
        paidTotal: moneyToString(result.paidTotal),
      });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get("/history", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const patientId = req.query.patientId ? String(req.query.patientId) : undefined;
    const admissionId = req.query.admissionId ? String(req.query.admissionId) : undefined;
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));

    const [payments, advances] = await Promise.all([
      prisma.payment.findMany({
        where: {
          hospitalId,
          ...(patientId ? { patientId } : {}),
          ...(admissionId ? { admissionId } : {}),
        },
        include: { patient: true, allocations: true },
        orderBy: { receivedAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.advance.findMany({
        where: {
          hospitalId,
          ...(patientId ? { patientId } : {}),
          ...(admissionId ? { admissionId } : {}),
        },
        include: { patient: true, allocations: true },
        orderBy: { receivedAt: "desc" },
        take: pageSize,
      }),
    ]);

    return ok(res, {
      payments: payments.map((p) => ({
        ...p,
        amount: moneyToString(p.amount),
        allocatedAmount: moneyToString(p.allocatedAmount),
        unallocatedAmount: moneyToString(p.unallocatedAmount),
        patientName: p.patient.displayName,
        type: "PAYMENT",
      })),
      advances: advances.map((a) => ({
        ...a,
        amount: moneyToString(a.amount),
        balance: moneyToString(a.balance),
        patientName: a.patient.displayName,
        type: "ADVANCE",
      })),
    });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.get("/advances", async (req, res, next) => {
  try {
    const admissionId = req.query.admissionId ? String(req.query.admissionId) : undefined;
    const rows = await prisma.advance.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        ...(admissionId ? { admissionId } : {}),
      },
      include: { patient: true, allocations: true },
      orderBy: { receivedAt: "desc" },
    });
    return ok(
      res,
      rows.map((a) => ({
        ...a,
        amount: moneyToString(a.amount),
        balance: moneyToString(a.balance),
        patientName: a.patient.displayName,
      })),
    );
  } catch (err) {
    next(err);
  }
});
