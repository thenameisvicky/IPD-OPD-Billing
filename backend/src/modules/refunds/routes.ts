import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { money, moneyToString } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { created, ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { nextNumber } from "../numbers/series";

export const refundsRouter = Router();
refundsRouter.use(requireAuth);

const createSchema = z.object({
  patientId: z.string().uuid(),
  amount: z.union([z.string(), z.number()]),
  reason: z.string().min(1),
  paymentId: z.string().uuid().optional().nullable(),
  advanceId: z.string().uuid().optional().nullable(),
});

refundsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await prisma.refund.findMany({
      where: { hospitalId: req.user!.hospitalId },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(
      res,
      rows.map((r) => ({
        ...r,
        amount: moneyToString(r.amount),
        patientName: r.patient.displayName,
      })),
    );
  } catch (err) {
    next(err);
  }
});

refundsRouter.post("/", requirePermission("refunds:write", "*"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;
    const amount = money(body.amount);
    if (amount.lte(0)) throw new AppError("INVALID_AMOUNT", "Amount must be positive", 400);
    if (!body.paymentId && !body.advanceId) {
      throw new AppError("SOURCE_REQUIRED", "Refund must reference a payment or advance", 400);
    }

    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });

    const refund = await prisma.$transaction(async (tx) => {
      if (body.advanceId) {
        const advance = await tx.advance.findFirst({
          where: { id: body.advanceId, hospitalId },
        });
        if (!advance) throw new AppError("NOT_FOUND", "Advance not found", 404);
        if (amount.gt(advance.balance)) {
          throw new AppError("EXCEEDS_BALANCE", "Refund exceeds advance balance", 400);
        }
      }
      if (body.paymentId) {
        const payment = await tx.payment.findFirst({
          where: { id: body.paymentId, hospitalId },
        });
        if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
        if (amount.gt(payment.unallocatedAmount)) {
          throw new AppError(
            "EXCEEDS_UNALLOCATED",
            "Refund of allocated payments requires invoice adjustment first",
            400,
          );
        }
      }

      const number = await nextNumber(tx, {
        hospitalId,
        kind: "REFUND",
        fiscalYearStartMonth: hospital.financialYearStartMonth,
      });

      return tx.refund.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          number,
          paymentId: body.paymentId || null,
          advanceId: body.advanceId || null,
          amount: moneyToString(amount),
          reason: body.reason,
          status: "REQUESTED",
        },
      });
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "refund.create",
      entityType: "Refund",
      entityId: refund.id,
      afterJson: { number: refund.number, amount: moneyToString(refund.amount) },
      ip: req.ip,
    });

    return created(res, { ...refund, amount: moneyToString(refund.amount) });
  } catch (err) {
    next(err);
  }
});

refundsRouter.post(
  "/:id/approve",
  requirePermission("refunds:approve", "*"),
  async (req, res, next) => {
    try {
      const hospitalId = req.user!.hospitalId;
      const refund = await prisma.$transaction(async (tx) => {
        const existing = await tx.refund.findFirst({
          where: { id: req.params.id, hospitalId },
        });
        if (!existing) throw new AppError("NOT_FOUND", "Refund not found", 404);
        if (existing.status !== "REQUESTED") {
          throw new AppError("INVALID_STATUS", "Only requested refunds can be approved", 409);
        }

        if (existing.advanceId) {
          const advance = await tx.advance.findUniqueOrThrow({
            where: { id: existing.advanceId },
          });
          if (money(existing.amount).gt(advance.balance)) {
            throw new AppError("EXCEEDS_BALANCE", "Advance balance insufficient", 400);
          }
          const newBalance = money(advance.balance).minus(existing.amount);
          await tx.advance.update({
            where: { id: advance.id },
            data: {
              balance: moneyToString(newBalance),
              status: newBalance.eq(0) ? "REFUNDED" : "PARTIALLY_ALLOCATED",
            },
          });
        }

        if (existing.paymentId) {
          const payment = await tx.payment.findUniqueOrThrow({
            where: { id: existing.paymentId },
          });
          if (money(existing.amount).gt(payment.unallocatedAmount)) {
            throw new AppError("EXCEEDS_UNALLOCATED", "Payment unallocated balance insufficient", 400);
          }
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              unallocatedAmount: moneyToString(
                money(payment.unallocatedAmount).minus(existing.amount),
              ),
              status: "REFUNDED",
            },
          });
        }

        const updated = await tx.refund.update({
          where: { id: existing.id },
          data: {
            status: "PAID",
            approvedById: req.user!.id,
            approvedAt: new Date(),
            paidAt: new Date(),
          },
        });

        await tx.financialTransaction.create({
          data: {
            hospitalId,
            patientId: existing.patientId,
            type: "REFUND_PAID",
            amount: existing.amount,
            referenceId: updated.id,
            referenceType: "Refund",
            metaJson: { number: updated.number },
          },
        });

        return updated;
      });

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "refund.approve",
        entityType: "Refund",
        entityId: refund.id,
        ip: req.ip,
      });

      return ok(res, { ...refund, amount: moneyToString(refund.amount) });
    } catch (err) {
      next(err);
    }
  },
);
