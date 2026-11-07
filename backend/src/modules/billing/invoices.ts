import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { amountInWordsInr, money, moneyToString, roundMoney } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { created, ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { calculateBill, calculateLosDays, unitLabel } from "./calculator";
import { nextNumber } from "../numbers/series";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get("/", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const status = req.query.status ? String(req.query.status) : undefined;
    const purpose = req.query.purpose ? String(req.query.purpose) : "FINAL";
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));

    const where = {
      hospitalId,
      purpose: purpose as any,
      status: status
        ? (status as any)
        : { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] as const },
    };

    const [total, rows] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          patient: true,
          admission: true,
        },
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return ok(res, {
      items: rows.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        purpose: inv.purpose,
        billDate: inv.billDate || inv.issuedAt,
        issuedAt: inv.issuedAt,
        grandTotal: moneyToString(inv.grandTotal),
        paidTotal: moneyToString(inv.paidTotal),
        outstanding: moneyToString(inv.outstanding),
        patientName: inv.patient.displayName,
        uhid: inv.patient.uhid,
        ipNumber: inv.admission?.ipNumber || null,
        admissionId: inv.admissionId,
      })),
      meta: { page, pageSize, total },
    });
  } catch (err) {
    next(err);
  }
});

async function buildAdmissionBillPreview(admissionId: string, hospitalId: string) {
  const admission = await prisma.admission.findFirst({
    where: { id: admissionId, hospitalId },
    include: {
      patient: true,
      department: true,
      practitioner: true,
      currentBed: { include: { room: true } },
      charges: {
        where: { status: "DRAFT" },
        include: { taxProfile: true },
        orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
      },
      advances: { where: { status: { in: ["OPEN", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"] } } },
      invoices: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);

  const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });
  const los = calculateLosDays(
    admission.admittedAt,
    admission.dischargedAt,
    hospital.losChargingPolicy,
  );

  const bill = calculateBill(
    admission.charges.map((c) => ({
      id: c.id,
      description: c.description,
      category: c.category,
      unit: c.unit,
      rate: c.rate,
      quantity: c.quantity,
      days: c.days,
      discountAmount: c.discountAmount,
      taxProfile: c.taxProfile
        ? {
            isExempt: c.taxProfile.isExempt,
            cgstRate: c.taxProfile.cgstRate,
            sgstRate: c.taxProfile.sgstRate,
            igstRate: c.taxProfile.igstRate,
          }
        : null,
      serviceItemId: c.serviceItemId,
      sourceChargeId: c.id,
    })),
  );

  const advancesReceived = admission.advances.reduce((s, a) => s.plus(a.amount), money(0));
  const advanceBalance = admission.advances.reduce((s, a) => s.plus(a.balance), money(0));

  return {
    hospital,
    admission,
    los,
    bill,
    advancesReceived: moneyToString(advancesReceived),
    advanceBalance: moneyToString(advanceBalance),
    existingFinal: admission.invoices.find((i) => i.purpose === "FINAL") || null,
  };
}

invoicesRouter.get("/preview/:admissionId", async (req, res, next) => {
  try {
    const preview = await buildAdmissionBillPreview(req.params.admissionId, req.user!.hospitalId);
    const { hospital, admission, los, bill, advancesReceived, advanceBalance, existingFinal } =
      preview;

    return ok(res, {
      hospital: {
        name: hospital.name,
        addressLine1: hospital.addressLine1,
        addressLine2: hospital.addressLine2,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        phone: hospital.phone,
        email: hospital.email,
        registrationNumber: hospital.registrationNumber,
        gstin: hospital.gstin,
        identifierLabel: hospital.identifierLabel,
        identifierValue: hospital.identifierValue,
        declarationText: hospital.declarationText,
        defaultNotes: hospital.defaultNotes,
        authorizedSignatory: hospital.authorizedSignatory,
        invoiceFooter: hospital.invoiceFooter,
      },
      admission: {
        id: admission.id,
        ipNumber: admission.ipNumber,
        admittedAt: admission.admittedAt,
        dischargedAt: admission.dischargedAt,
        status: admission.status,
        roomCategory: admission.roomCategory,
        room: admission.currentBed?.room?.name || null,
        bed: admission.currentBed?.code || null,
        department: admission.department?.name || null,
        practitioner: admission.practitioner
          ? [admission.practitioner.name, admission.practitioner.qualification]
              .filter(Boolean)
              .join(", ")
          : null,
        primaryDiagnosis: admission.primaryDiagnosis,
        diagnosisCode: admission.diagnosisCode,
        procedureInfo: admission.procedureInfo,
        policyholderName: admission.policyholderName,
        insurerName: admission.insurerName,
        insuranceCardNo: admission.insuranceCardNo,
        policyNo: admission.policyNo,
        lengthOfStayDays: los,
      },
      patient: {
        id: admission.patient.id,
        uhid: admission.patient.uhid,
        name: admission.patient.displayName,
        ageYears: admission.patient.ageYears,
        sex: admission.patient.sex,
        phone: admission.patient.phone,
        address: [admission.patient.addressLine1, admission.patient.city, admission.patient.state]
          .filter(Boolean)
          .join(", "),
      },
      lines: bill.lines,
      totals: {
        subtotal: bill.subtotal,
        discountTotal: bill.discountTotal,
        taxTotal: bill.taxTotal,
        grandTotal: bill.grandTotal,
        amountInWords: bill.amountInWords,
        advancesReceived,
        advanceBalance,
        estimatedOutstanding: moneyToString(
          roundMoney(money(bill.grandTotal).minus(advanceBalance)),
        ),
      },
      existingFinalInvoiceId: existingFinal?.id || null,
    });
  } catch (err) {
    next(err);
  }
});

const finalizeSchema = z.object({
  admissionId: z.string().uuid(),
  notes: z.string().optional().nullable(),
  allocateAdvanceIds: z.array(z.string().uuid()).optional(),
  idempotencyKey: z.string().min(8).optional(),
});

invoicesRouter.post(
  "/finalize",
  requirePermission("invoices:finalise", "*"),
  async (req, res, next) => {
    try {
      const body = finalizeSchema.parse(req.body);
      const hospitalId = req.user!.hospitalId;

      if (body.idempotencyKey) {
        const existing = await prisma.invoice.findFirst({
          where: { hospitalId, idempotencyKey: body.idempotencyKey },
          include: { items: true },
        });
        if (existing) return ok(res, existing);
      }

      const invoice = await prisma.$transaction(
        async (tx) => {
        const admission = await tx.admission.findFirst({
          where: { id: body.admissionId, hospitalId },
          include: {
            patient: true,
            department: true,
            practitioner: true,
            currentBed: { include: { room: true } },
            charges: {
              where: { status: "DRAFT" },
              include: { taxProfile: true },
              orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
            },
            advances: {
              where: { status: { in: ["OPEN", "PARTIALLY_ALLOCATED"] } },
              orderBy: { receivedAt: "asc" },
            },
          },
        });
        if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);

        const priorFinal = await tx.invoice.findFirst({
          where: {
            hospitalId,
            admissionId: admission.id,
            purpose: "FINAL",
            status: { not: "CANCELLED" },
          },
        });
        if (priorFinal) {
          throw new AppError(
            "FINAL_EXISTS",
            `Final invoice ${priorFinal.number} already exists`,
            409,
          );
        }
        if (admission.charges.length === 0) {
          throw new AppError("NO_CHARGES", "No draft charges to bill", 400);
        }

        const hospital = await tx.hospital.findUniqueOrThrow({ where: { id: hospitalId } });
        const los = calculateLosDays(
          admission.admittedAt,
          admission.dischargedAt,
          hospital.losChargingPolicy,
        );
        const bill = calculateBill(
          admission.charges.map((c) => ({
            id: c.id,
            description: c.description,
            category: c.category,
            unit: c.unit,
            rate: c.rate,
            quantity: c.quantity,
            days: c.days,
            discountAmount: c.discountAmount,
            taxProfile: c.taxProfile
              ? {
                  isExempt: c.taxProfile.isExempt,
                  cgstRate: c.taxProfile.cgstRate,
                  sgstRate: c.taxProfile.sgstRate,
                  igstRate: c.taxProfile.igstRate,
                }
              : null,
            serviceItemId: c.serviceItemId,
            sourceChargeId: c.id,
          })),
        );

        const number = await nextNumber(tx, {
          hospitalId,
          kind: "INVOICE_IP",
          fiscalYearStartMonth: hospital.financialYearStartMonth,
        });

        const snapshot = {
          hospital: {
            name: hospital.name,
            addressLine1: hospital.addressLine1,
            addressLine2: hospital.addressLine2,
            city: hospital.city,
            state: hospital.state,
            pincode: hospital.pincode,
            phone: hospital.phone,
            email: hospital.email,
            registrationNumber: hospital.registrationNumber,
            gstin: hospital.gstin,
            identifierLabel: hospital.identifierLabel,
            identifierValue: hospital.identifierValue,
            declarationText: hospital.declarationText,
            defaultNotes: hospital.defaultNotes,
            authorizedSignatory: hospital.authorizedSignatory,
            invoiceFooter: hospital.invoiceFooter,
          },
          patient: {
            uhid: admission.patient.uhid,
            name: admission.patient.displayName,
            ageYears: admission.patient.ageYears,
            sex: admission.patient.sex,
            phone: admission.patient.phone,
          },
          admission: {
            ipNumber: admission.ipNumber,
            admittedAt: admission.admittedAt,
            dischargedAt: admission.dischargedAt,
            roomCategory: admission.roomCategory,
            room: admission.currentBed?.room?.name || null,
            bed: admission.currentBed?.code || null,
            department: admission.department?.name || null,
            practitioner: admission.practitioner
              ? [admission.practitioner.name, admission.practitioner.qualification]
                  .filter(Boolean)
                  .join(", ")
              : null,
            primaryDiagnosis: admission.primaryDiagnosis,
            diagnosisCode: admission.diagnosisCode,
            procedureInfo: admission.procedureInfo,
            policyholderName: admission.policyholderName,
            insurerName: admission.insurerName,
            insuranceCardNo: admission.insuranceCardNo,
            policyNo: admission.policyNo,
            lengthOfStayDays: los,
          },
          lines: bill.lines,
          totals: bill,
        };

        const createdInvoice = await tx.invoice.create({
          data: {
            hospitalId,
            patientId: admission.patientId,
            admissionId: admission.id,
            number,
            purpose: "FINAL",
            status: "ISSUED",
            billDate: new Date(),
            subtotal: bill.subtotal,
            discountTotal: bill.discountTotal,
            taxTotal: bill.taxTotal,
            grandTotal: bill.grandTotal,
            paidTotal: "0.00",
            advanceAllocated: "0.00",
            outstanding: bill.grandTotal,
            amountInWords: bill.amountInWords,
            notes: body.notes || hospital.defaultNotes,
            snapshotJson: snapshot,
            issuedAt: new Date(),
            finalizedById: req.user!.id,
            idempotencyKey: body.idempotencyKey || null,
            items: {
              create: bill.lines.map((line, idx) => ({
                serviceItemId: line.serviceItemId || null,
                description: line.description,
                category: line.category || null,
                unitLabel: line.unitLabel,
                rate: line.rate,
                quantity: line.quantity,
                discountAmount: line.discountAmount,
                taxAmount: line.taxAmount,
                taxSnapshotJson: line.taxSnapshot,
                lineTotal: line.lineTotal,
                sortOrder: idx + 1,
                sourceChargeId: line.sourceChargeId || null,
              })),
            },
          },
          include: { items: true },
        });

        await tx.admissionCharge.updateMany({
          where: {
            admissionId: admission.id,
            status: "DRAFT",
          },
          data: { status: "BILLED" },
        });

        // Allocate available advances (oldest first) up to outstanding
        let remaining = money(createdInvoice.grandTotal);
        let allocatedTotal = money(0);
        const advanceIds =
          body.allocateAdvanceIds && body.allocateAdvanceIds.length > 0
            ? body.allocateAdvanceIds
            : admission.advances.map((a) => a.id);

        for (const advanceId of advanceIds) {
          if (remaining.lte(0)) break;
          const advance = admission.advances.find((a) => a.id === advanceId);
          if (!advance || money(advance.balance).lte(0)) continue;

          const alloc = DecimalMin(money(advance.balance), remaining);
          await tx.advanceAllocation.create({
            data: {
              advanceId: advance.id,
              invoiceId: createdInvoice.id,
              amount: moneyToString(alloc),
            },
          });
          const newBalance = money(advance.balance).minus(alloc);
          await tx.advance.update({
            where: { id: advance.id },
            data: {
              balance: moneyToString(newBalance),
              status: newBalance.eq(0) ? "FULLY_ALLOCATED" : "PARTIALLY_ALLOCATED",
            },
          });
          remaining = remaining.minus(alloc);
          allocatedTotal = allocatedTotal.plus(alloc);
        }

        const outstanding = money(createdInvoice.grandTotal).minus(allocatedTotal);
        const status =
          outstanding.eq(0) ? "PAID" : allocatedTotal.gt(0) ? "PARTIALLY_PAID" : "ISSUED";

        const updated = await tx.invoice.update({
          where: { id: createdInvoice.id },
          data: {
            advanceAllocated: moneyToString(allocatedTotal),
            paidTotal: moneyToString(allocatedTotal),
            outstanding: moneyToString(outstanding),
            status,
          },
          include: {
            items: { orderBy: { sortOrder: "asc" } },
            patient: true,
            admission: true,
            advanceAllocations: { include: { advance: true } },
            paymentAllocations: { include: { payment: true } },
          },
        });

        await tx.admission.update({
          where: { id: admission.id },
          data: {
            status: outstanding.eq(0) ? "DISCHARGED" : "BILLING",
          },
        });

        await tx.financialTransaction.create({
          data: {
            hospitalId,
            patientId: admission.patientId,
            admissionId: admission.id,
            invoiceId: updated.id,
            type: "INVOICE_FINALIZED",
            amount: updated.grandTotal,
            referenceId: updated.id,
            referenceType: "Invoice",
            metaJson: { number: updated.number },
          },
        });

        return updated;
      },
        { timeout: 60000, maxWait: 15000 },
      );

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "invoice.finalize",
        entityType: "Invoice",
        entityId: invoice.id,
        afterJson: {
          number: invoice.number,
          grandTotal: moneyToString(invoice.grandTotal),
          outstanding: moneyToString(invoice.outstanding),
        },
        ip: req.ip,
      });

      return created(res, serializeInvoice(invoice));
    } catch (err) {
      next(err);
    }
  },
);

function DecimalMin(a: ReturnType<typeof money>, b: ReturnType<typeof money>) {
  return a.lt(b) ? a : b;
}

function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    subtotal: moneyToString(invoice.subtotal),
    discountTotal: moneyToString(invoice.discountTotal),
    taxTotal: moneyToString(invoice.taxTotal),
    grandTotal: moneyToString(invoice.grandTotal),
    paidTotal: moneyToString(invoice.paidTotal),
    advanceAllocated: moneyToString(invoice.advanceAllocated),
    outstanding: moneyToString(invoice.outstanding),
    items: invoice.items?.map((item: any) => ({
      ...item,
      rate: moneyToString(item.rate),
      quantity: moneyToString(item.quantity),
      discountAmount: moneyToString(item.discountAmount),
      taxAmount: moneyToString(item.taxAmount),
      lineTotal: moneyToString(item.lineTotal),
    })),
  };
}

invoicesRouter.get("/:id", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        patient: true,
        admission: {
          include: {
            department: true,
            practitioner: true,
            currentBed: { include: { room: true } },
          },
        },
        paymentAllocations: { include: { payment: true } },
        advanceAllocations: { include: { advance: true } },
        finalizedBy: { select: { id: true, name: true } },
      },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    return ok(res, serializeInvoice(invoice));
  } catch (err) {
    next(err);
  }
});

invoicesRouter.get("/:id/print", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        patient: true,
        admission: true,
        paymentAllocations: { include: { payment: true } },
        advanceAllocations: { include: { advance: true } },
        finalizedBy: { select: { name: true } },
      },
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
    if (!invoice.snapshotJson) {
      throw new AppError("NO_SNAPSHOT", "Invoice snapshot missing", 500);
    }

    const snapshot = invoice.snapshotJson as any;
    const payments = [
      ...invoice.advanceAllocations.map((a) => ({
        receiptNo: a.advance.number,
        date: a.advance.receivedAt,
        mode: `${a.advance.method.replace(/_/g, " ")} (Advance)`,
        amount: moneyToString(a.amount),
      })),
      ...invoice.paymentAllocations.map((p) => ({
        receiptNo: p.payment.number,
        date: p.payment.receivedAt,
        mode: `${p.payment.method.replace(/_/g, " ")}${
          p.payment.kind === "SETTLEMENT" ? " (Final Settlement)" : ""
        }`,
        amount: moneyToString(p.amount),
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return ok(res, {
      invoiceId: invoice.id,
      number: invoice.number,
      billDate: invoice.billDate || invoice.issuedAt,
      status: invoice.status,
      purpose: invoice.purpose,
      hospital: snapshot.hospital,
      patient: snapshot.patient,
      admission: snapshot.admission,
      lines: snapshot.lines || invoice.items.map((item, idx) => ({
        sno: idx + 1,
        description: item.description,
        rate: moneyToString(item.rate),
        quantity: moneyToString(item.quantity),
        unitLabel: item.unitLabel || unitLabel("PER_ITEM", item.quantity),
        lineTotal: moneyToString(item.lineTotal),
      })),
      totals: {
        subtotal: moneyToString(invoice.subtotal),
        discountTotal: moneyToString(invoice.discountTotal),
        taxTotal: moneyToString(invoice.taxTotal),
        grandTotal: moneyToString(invoice.grandTotal),
        paidTotal: moneyToString(invoice.paidTotal),
        advanceAllocated: moneyToString(invoice.advanceAllocated),
        outstanding: moneyToString(invoice.outstanding),
        amountInWords: invoice.amountInWords || amountInWordsInr(invoice.grandTotal),
      },
      payments,
      notes: invoice.notes,
      preparedBy: invoice.finalizedBy?.name || null,
      reprint: true,
    });
  } catch (err) {
    next(err);
  }
});

invoicesRouter.post(
  "/:id/cancel",
  requirePermission("invoices:cancel", "*"),
  async (req, res, next) => {
    try {
      const reason = String(req.body?.reason || "Cancelled by authorized user");
      const hospitalId = req.user!.hospitalId;

      const invoice = await prisma.$transaction(
        async (tx) => {
        const existing = await tx.invoice.findFirst({
          where: { id: req.params.id, hospitalId },
          include: {
            advanceAllocations: true,
            paymentAllocations: true,
          },
        });
        if (!existing) throw new AppError("NOT_FOUND", "Invoice not found", 404);
        if (existing.status === "CANCELLED") {
          throw new AppError("ALREADY_CANCELLED", "Invoice already cancelled", 409);
        }

        // Reverse advance allocations
        for (const alloc of existing.advanceAllocations) {
          const advance = await tx.advance.findUniqueOrThrow({ where: { id: alloc.advanceId } });
          const newBalance = money(advance.balance).plus(alloc.amount);
          await tx.advance.update({
            where: { id: advance.id },
            data: {
              balance: moneyToString(newBalance),
              status: newBalance.eq(advance.amount) ? "OPEN" : "PARTIALLY_ALLOCATED",
            },
          });
          await tx.advanceAllocation.delete({ where: { id: alloc.id } });
        }

        // Reverse payment allocations
        for (const alloc of existing.paymentAllocations) {
          const payment = await tx.payment.findUniqueOrThrow({ where: { id: alloc.paymentId } });
          const newUnalloc = money(payment.unallocatedAmount).plus(alloc.amount);
          const newAlloc = money(payment.allocatedAmount).minus(alloc.amount);
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              unallocatedAmount: moneyToString(newUnalloc),
              allocatedAmount: moneyToString(newAlloc),
            },
          });
          await tx.paymentAllocation.delete({ where: { id: alloc.id } });
        }

        // Restore charges to draft so they can be re-billed
        if (existing.admissionId) {
          await tx.admissionCharge.updateMany({
            where: { admissionId: existing.admissionId, status: "BILLED" },
            data: { status: "DRAFT" },
          });
          await tx.admission.update({
            where: { id: existing.admissionId },
            data: { status: "BILLING" },
          });
        }

        return tx.invoice.update({
          where: { id: existing.id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: reason,
            outstanding: "0.00",
            paidTotal: "0.00",
            advanceAllocated: "0.00",
          },
        });
      },
        { timeout: 60000, maxWait: 15000 },
      );

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "invoice.cancel",
        entityType: "Invoice",
        entityId: invoice.id,
        afterJson: { reason },
        ip: req.ip,
      });

      return ok(res, serializeInvoice(invoice));
    } catch (err) {
      next(err);
    }
  },
);
