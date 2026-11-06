import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { calcLineTotal, calcTaxAmount, money, moneyToString, roundMoney } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { created, ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const chargesRouter = Router();
chargesRouter.use(requireAuth);

const chargeSchema = z.object({
  admissionId: z.string().uuid(),
  serviceItemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  category: z.enum([
    "ROOM_RENT",
    "NURSING",
    "RESIDENT_DOCTOR",
    "TREATING_DOCTOR",
    "SPECIALIST_CONSULTATION",
    "CATH_LAB",
    "OPERATION_THEATRE",
    "PROCEDURE",
    "ANESTHETIST",
    "MEDICAL_IMPLANT",
    "PHARMACY",
    "CONSUMABLES",
    "LABORATORY",
    "RADIOLOGY",
    "MEDICAL_RECORDS",
    "OTHER",
  ]),
  unit: z.enum([
    "PER_DAY",
    "PER_VISIT",
    "PER_PROCEDURE",
    "PER_ITEM",
    "PER_UNIT",
    "LUMP_SUM",
    "AS_BILLED",
  ]),
  rate: z.union([z.string(), z.number()]),
  quantity: z.union([z.string(), z.number()]).default(1),
  days: z.union([z.string(), z.number()]).optional().nullable(),
  serviceDate: z.string().datetime().optional(),
  practitionerId: z.string().uuid().optional().nullable(),
  discountAmount: z.union([z.string(), z.number()]).optional().default(0),
  taxProfileId: z.string().uuid().optional().nullable(),
  sourceModule: z.string().optional().nullable(),
  sourceReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function resolveTax(taxProfileId: string | null | undefined) {
  if (!taxProfileId) return null;
  return prisma.taxProfile.findUnique({ where: { id: taxProfileId } });
}

function computeAmounts(input: {
  rate: string | number;
  quantity: string | number;
  days?: string | number | null;
  unit: string;
  discountAmount?: string | number;
  taxProfile: {
    isExempt: boolean;
    cgstRate: any;
    sgstRate: any;
    igstRate: any;
  } | null;
}) {
  const qty =
    input.unit === "PER_DAY" && input.days != null ? money(input.days) : money(input.quantity);
  const rate = money(input.rate);
  const discount = money(input.discountAmount || 0);
  const taxableBase = roundMoney(rate.mul(qty).minus(discount));
  const taxAmount = input.taxProfile
    ? calcTaxAmount({
        taxableBase,
        isExempt: input.taxProfile.isExempt,
        cgstRate: input.taxProfile.cgstRate,
        sgstRate: input.taxProfile.sgstRate,
        igstRate: input.taxProfile.igstRate,
      })
    : money(0);
  const lineTotal = calcLineTotal({
    rate,
    quantity: qty,
    discountAmount: discount,
    taxAmount,
  });
  return { qty, taxAmount, lineTotal, discount };
}

chargesRouter.get("/admissions/:admissionId/charges", async (req, res, next) => {
  try {
    const charges = await prisma.admissionCharge.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        admissionId: req.params.admissionId,
        status: { not: "CANCELLED" },
      },
      include: { serviceItem: true, taxProfile: true, practitioner: true },
      orderBy: [{ serviceDate: "asc" }, { createdAt: "asc" }],
    });
    return ok(
      res,
      charges.map((c) => ({
        ...c,
        rate: moneyToString(c.rate),
        quantity: moneyToString(c.quantity),
        days: c.days != null ? moneyToString(c.days) : null,
        discountAmount: moneyToString(c.discountAmount),
        taxAmount: moneyToString(c.taxAmount),
        lineTotal: moneyToString(c.lineTotal),
      })),
    );
  } catch (err) {
    next(err);
  }
});

chargesRouter.post("/", requirePermission("billing:write", "*"), async (req, res, next) => {
  try {
    const body = chargeSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;

    const admission = await prisma.admission.findFirst({
      where: { id: body.admissionId, hospitalId },
    });
    if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);
    if (admission.status === "DISCHARGED" || admission.status === "CANCELLED") {
      throw new AppError("INVALID_STATUS", "Cannot add charges to closed admission", 409);
    }

    if (body.sourceModule && body.sourceReference) {
      const dup = await prisma.admissionCharge.findFirst({
        where: {
          hospitalId,
          sourceModule: body.sourceModule,
          sourceReference: body.sourceReference,
          status: { not: "CANCELLED" },
        },
      });
      if (dup) {
        throw new AppError(
          "DUPLICATE_SOURCE_CHARGE",
          "Charge with this source reference already exists",
          409,
        );
      }
    }

    let rate = body.rate;
    let taxProfileId = body.taxProfileId || null;
    let description = body.description;
    let unit = body.unit;
    let category = body.category;

    if (body.serviceItemId) {
      const service = await prisma.serviceItem.findFirst({
        where: { id: body.serviceItemId, hospitalId },
        include: {
          tariffs: { where: { active: true }, orderBy: { version: "desc" }, take: 1 },
        },
      });
      if (!service) throw new AppError("NOT_FOUND", "Service not found", 404);
      if (!body.rate && service.tariffs[0]) rate = moneyToString(service.tariffs[0].rate);
      taxProfileId = taxProfileId || service.taxProfileId;
      description = description || service.name;
      unit = body.unit || service.unit;
      category = body.category || service.category;
    }

    const taxProfile = await resolveTax(taxProfileId);
    const amounts = computeAmounts({
      rate,
      quantity: body.quantity,
      days: body.days,
      unit,
      discountAmount: body.discountAmount,
      taxProfile,
    });

    const charge = await prisma.admissionCharge.create({
      data: {
        hospitalId,
        admissionId: body.admissionId,
        serviceItemId: body.serviceItemId || null,
        description,
        category,
        unit,
        rate: moneyToString(rate),
        quantity: moneyToString(amounts.qty),
        days: body.days != null ? moneyToString(body.days) : null,
        serviceDate: body.serviceDate ? new Date(body.serviceDate) : new Date(),
        practitionerId: body.practitionerId || null,
        discountAmount: moneyToString(amounts.discount),
        taxProfileId,
        taxAmount: moneyToString(amounts.taxAmount),
        lineTotal: moneyToString(amounts.lineTotal),
        status: "DRAFT",
        sourceModule: body.sourceModule || null,
        sourceReference: body.sourceReference || null,
        notes: body.notes || null,
      },
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "charge.create",
      entityType: "AdmissionCharge",
      entityId: charge.id,
      afterJson: { description: charge.description, lineTotal: moneyToString(charge.lineTotal) },
      ip: req.ip,
    });

    return created(res, {
      ...charge,
      rate: moneyToString(charge.rate),
      lineTotal: moneyToString(charge.lineTotal),
    });
  } catch (err) {
    next(err);
  }
});

chargesRouter.patch("/:id", requirePermission("billing:write", "*"), async (req, res, next) => {
  try {
    const body = chargeSchema.partial().omit({ admissionId: true }).parse(req.body);
    const existing = await prisma.admissionCharge.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Charge not found", 404);
    if (existing.status !== "DRAFT") {
      throw new AppError("IMMUTABLE", "Only draft charges can be updated", 409);
    }

    const taxProfileId =
      body.taxProfileId === undefined ? existing.taxProfileId : body.taxProfileId;
    const taxProfile = await resolveTax(taxProfileId);
    const unit = body.unit || existing.unit;
    const amounts = computeAmounts({
      rate: body.rate ?? moneyToString(existing.rate),
      quantity: body.quantity ?? moneyToString(existing.quantity),
      days: body.days === undefined ? existing.days : body.days,
      unit,
      discountAmount: body.discountAmount ?? moneyToString(existing.discountAmount),
      taxProfile,
    });

    const charge = await prisma.admissionCharge.update({
      where: { id: existing.id },
      data: {
        description: body.description,
        category: body.category,
        unit: body.unit,
        rate: body.rate != null ? moneyToString(body.rate) : undefined,
        quantity: moneyToString(amounts.qty),
        days: body.days === undefined ? undefined : body.days != null ? moneyToString(body.days) : null,
        practitionerId: body.practitionerId,
        discountAmount: moneyToString(amounts.discount),
        taxProfileId,
        taxAmount: moneyToString(amounts.taxAmount),
        lineTotal: moneyToString(amounts.lineTotal),
        notes: body.notes,
      },
    });

    await writeAudit({
      hospitalId: req.user!.hospitalId,
      actorUserId: req.user!.id,
      action: "charge.update",
      entityType: "AdmissionCharge",
      entityId: charge.id,
      ip: req.ip,
    });

    return ok(res, charge);
  } catch (err) {
    next(err);
  }
});

chargesRouter.delete("/:id", requirePermission("billing:write", "*"), async (req, res, next) => {
  try {
    const existing = await prisma.admissionCharge.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Charge not found", 404);
    if (existing.status !== "DRAFT") {
      throw new AppError("IMMUTABLE", "Only draft charges can be removed", 409);
    }
    const charge = await prisma.admissionCharge.update({
      where: { id: existing.id },
      data: { status: "CANCELLED" },
    });
    await writeAudit({
      hospitalId: req.user!.hospitalId,
      actorUserId: req.user!.id,
      action: "charge.cancel",
      entityType: "AdmissionCharge",
      entityId: charge.id,
      ip: req.ip,
    });
    return ok(res, charge);
  } catch (err) {
    next(err);
  }
});

chargesRouter.post("/import", requirePermission("billing:write", "*"), async (req, res, next) => {
  try {
    const body = z
      .object({
        admissionId: z.string().uuid(),
        charges: z.array(chargeSchema.omit({ admissionId: true })),
      })
      .parse(req.body);

    const createdCharges = [];
    for (const item of body.charges) {
      if (!item.sourceModule || !item.sourceReference) {
        throw new AppError(
          "SOURCE_REQUIRED",
          "Imported charges require sourceModule and sourceReference",
          400,
        );
      }
      // Reuse POST logic via internal call pattern — create individually for duplicate checks
      const dup = await prisma.admissionCharge.findFirst({
        where: {
          hospitalId: req.user!.hospitalId,
          sourceModule: item.sourceModule,
          sourceReference: item.sourceReference,
          status: { not: "CANCELLED" },
        },
      });
      if (dup) continue;

      const taxProfile = await resolveTax(item.taxProfileId);
      const amounts = computeAmounts({
        rate: item.rate,
        quantity: item.quantity,
        days: item.days,
        unit: item.unit,
        discountAmount: item.discountAmount,
        taxProfile,
      });
      const charge = await prisma.admissionCharge.create({
        data: {
          hospitalId: req.user!.hospitalId,
          admissionId: body.admissionId,
          serviceItemId: item.serviceItemId || null,
          description: item.description,
          category: item.category,
          unit: item.unit,
          rate: moneyToString(item.rate),
          quantity: moneyToString(amounts.qty),
          days: item.days != null ? moneyToString(item.days) : null,
          serviceDate: item.serviceDate ? new Date(item.serviceDate) : new Date(),
          practitionerId: item.practitionerId || null,
          discountAmount: moneyToString(amounts.discount),
          taxProfileId: item.taxProfileId || null,
          taxAmount: moneyToString(amounts.taxAmount),
          lineTotal: moneyToString(amounts.lineTotal),
          status: "DRAFT",
          sourceModule: item.sourceModule,
          sourceReference: item.sourceReference,
          notes: item.notes || null,
        },
      });
      createdCharges.push(charge);
    }
    return created(res, createdCharges);
  } catch (err) {
    next(err);
  }
});
