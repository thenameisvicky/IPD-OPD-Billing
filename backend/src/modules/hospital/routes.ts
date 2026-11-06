import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const hospitalRouter = Router();

hospitalRouter.use(requireAuth);

hospitalRouter.get("/settings", async (req, res, next) => {
  try {
    const hospital = await prisma.hospital.findUnique({
      where: { id: req.user!.hospitalId },
    });
    if (!hospital) throw new AppError("NOT_FOUND", "Hospital not found", 404);
    return ok(res, hospital);
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  identifierLabel: z.string().nullable().optional(),
  identifierValue: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  invoiceFooter: z.string().nullable().optional(),
  declarationText: z.string().nullable().optional(),
  defaultNotes: z.string().nullable().optional(),
  authorizedSignatory: z.string().nullable().optional(),
  invoicePrefix: z.string().min(1).optional(),
  financialYearStartMonth: z.number().int().min(1).max(12).optional(),
  losChargingPolicy: z
    .enum(["CALENDAR_DAY", "CALENDAR_DAY_EXCLUSIVE", "HOURS_24", "CUSTOM"])
    .optional(),
});

hospitalRouter.put(
  "/settings",
  requirePermission("hospital:write", "*"),
  async (req, res, next) => {
    try {
      const body = settingsSchema.parse(req.body);
      const before = await prisma.hospital.findUnique({
        where: { id: req.user!.hospitalId },
      });
      const hospital = await prisma.hospital.update({
        where: { id: req.user!.hospitalId },
        data: body,
      });
      await writeAudit({
        hospitalId: req.user!.hospitalId,
        actorUserId: req.user!.id,
        action: "hospital.settings.update",
        entityType: "Hospital",
        entityId: hospital.id,
        beforeJson: before,
        afterJson: hospital,
        ip: req.ip,
      });
      return ok(res, hospital);
    } catch (err) {
      next(err);
    }
  },
);

hospitalRouter.get("/departments", async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { hospitalId: req.user!.hospitalId, active: true },
      orderBy: { name: "asc" },
    });
    return ok(res, departments);
  } catch (err) {
    next(err);
  }
});

hospitalRouter.get("/practitioners", async (req, res, next) => {
  try {
    const practitioners = await prisma.practitioner.findMany({
      where: { hospitalId: req.user!.hospitalId, active: true },
      include: { department: true },
      orderBy: { name: "asc" },
    });
    return ok(res, practitioners);
  } catch (err) {
    next(err);
  }
});
