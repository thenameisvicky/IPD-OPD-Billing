import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { moneyToString } from "../../lib/money";
import { prisma } from "../../lib/prisma";
import { created, ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const catalogueRouter = Router();
catalogueRouter.use(requireAuth);

const serviceSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
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
  description: z.string().optional().nullable(),
  unit: z
    .enum(["PER_DAY", "PER_VISIT", "PER_PROCEDURE", "PER_ITEM", "PER_UNIT", "LUMP_SUM", "AS_BILLED"])
    .default("PER_ITEM"),
  departmentId: z.string().uuid().optional().nullable(),
  taxProfileId: z.string().uuid().optional().nullable(),
  standardRate: z.union([z.string(), z.number()]),
  roomCategory: z.string().optional().nullable(),
  effectiveFrom: z.string().datetime().optional(),
});

catalogueRouter.get("/services", async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    const services = await prisma.serviceItem.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        ...(category ? { category: category as any } : {}),
        active: true,
      },
      include: {
        taxProfile: true,
        tariffs: {
          where: { active: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });
    return ok(
      res,
      services.map((s) => ({
        ...s,
        currentRate: s.tariffs[0] ? moneyToString(s.tariffs[0].rate) : null,
        tariffVersion: s.tariffs[0]?.version ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

catalogueRouter.post(
  "/services",
  requirePermission("catalogue:write", "*"),
  async (req, res, next) => {
    try {
      const body = serviceSchema.parse(req.body);
      const hospitalId = req.user!.hospitalId;
      const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();

      const service = await prisma.$transaction(async (tx) => {
        const createdService = await tx.serviceItem.create({
          data: {
            hospitalId,
            code: body.code,
            name: body.name,
            category: body.category,
            description: body.description || null,
            unit: body.unit,
            departmentId: body.departmentId || null,
            taxProfileId: body.taxProfileId || null,
          },
        });
        await tx.tariff.create({
          data: {
            hospitalId,
            serviceItemId: createdService.id,
            version: 1,
            rate: String(body.standardRate),
            roomCategory: body.roomCategory || null,
            taxProfileId: body.taxProfileId || null,
            effectiveFrom,
            active: true,
          },
        });
        return tx.serviceItem.findUniqueOrThrow({
          where: { id: createdService.id },
          include: { tariffs: true, taxProfile: true },
        });
      });

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "service.create",
        entityType: "ServiceItem",
        entityId: service.id,
        afterJson: { code: service.code, name: service.name },
        ip: req.ip,
      });

      return created(res, service);
    } catch (err) {
      next(err);
    }
  },
);

const tariffSchema = z.object({
  rate: z.union([z.string(), z.number()]),
  roomCategory: z.string().optional().nullable(),
  taxProfileId: z.string().uuid().optional().nullable(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

catalogueRouter.post(
  "/services/:id/tariffs",
  requirePermission("catalogue:write", "*"),
  async (req, res, next) => {
    try {
      const body = tariffSchema.parse(req.body);
      const hospitalId = req.user!.hospitalId;
      const service = await prisma.serviceItem.findFirst({
        where: { id: req.params.id, hospitalId },
      });
      if (!service) throw new AppError("NOT_FOUND", "Service not found", 404);

      const latest = await prisma.tariff.findFirst({
        where: { serviceItemId: service.id },
        orderBy: { version: "desc" },
      });

      const tariff = await prisma.$transaction(async (tx) => {
        if (latest?.active) {
          await tx.tariff.update({
            where: { id: latest.id },
            data: {
              active: false,
              effectiveTo: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
            },
          });
        }
        return tx.tariff.create({
          data: {
            hospitalId,
            serviceItemId: service.id,
            version: (latest?.version || 0) + 1,
            rate: String(body.rate),
            roomCategory: body.roomCategory || null,
            taxProfileId: body.taxProfileId || service.taxProfileId,
            effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
            effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
            active: true,
          },
        });
      });

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "tariff.create",
        entityType: "Tariff",
        entityId: tariff.id,
        afterJson: {
          serviceItemId: service.id,
          version: tariff.version,
          rate: moneyToString(tariff.rate),
        },
        ip: req.ip,
      });

      return created(res, tariff);
    } catch (err) {
      next(err);
    }
  },
);

catalogueRouter.get("/services/:id/tariffs", async (req, res, next) => {
  try {
    const tariffs = await prisma.tariff.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        serviceItemId: req.params.id,
      },
      orderBy: { version: "desc" },
    });
    return ok(
      res,
      tariffs.map((t) => ({
        ...t,
        rate: moneyToString(t.rate),
      })),
    );
  } catch (err) {
    next(err);
  }
});

catalogueRouter.get("/tax-profiles", async (req, res, next) => {
  try {
    const profiles = await prisma.taxProfile.findMany({
      where: { hospitalId: req.user!.hospitalId, active: true },
      orderBy: { code: "asc" },
    });
    return ok(res, profiles);
  } catch (err) {
    next(err);
  }
});
