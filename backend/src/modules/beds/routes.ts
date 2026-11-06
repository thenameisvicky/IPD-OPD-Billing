import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { ok } from "../../lib/response";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const bedsRouter = Router();
bedsRouter.use(requireAuth);

bedsRouter.get("/rooms", async (req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { hospitalId: req.user!.hospitalId },
      include: {
        ward: true,
        beds: { orderBy: { code: "asc" } },
      },
      orderBy: { code: "asc" },
    });
    return ok(res, rooms);
  } catch (err) {
    next(err);
  }
});

bedsRouter.get("/availability", async (req, res, next) => {
  try {
    const beds = await prisma.bed.findMany({
      where: {
        hospitalId: req.user!.hospitalId,
        status: "AVAILABLE",
      },
      include: { room: { include: { ward: true } } },
      orderBy: { code: "asc" },
    });
    return ok(res, beds);
  } catch (err) {
    next(err);
  }
});

const assignSchema = z.object({
  admissionId: z.string().uuid(),
  bedId: z.string().uuid(),
  checkIn: z.string().datetime().optional(),
});

bedsRouter.post("/assign", requirePermission("admissions:write", "*"), async (req, res, next) => {
  try {
    const body = assignSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;
    const checkIn = body.checkIn ? new Date(body.checkIn) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({
        where: { id: body.admissionId, hospitalId },
      });
      if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);
      if (!["ADMITTED", "BILLING"].includes(admission.status)) {
        throw new AppError("INVALID_STATUS", "Cannot assign bed to this admission", 409);
      }

      const bed = await tx.bed.findFirst({
        where: { id: body.bedId, hospitalId },
        include: { room: true },
      });
      if (!bed) throw new AppError("NOT_FOUND", "Bed not found", 404);
      if (bed.status !== "AVAILABLE") {
        throw new AppError("BED_UNAVAILABLE", "Bed is not available", 409);
      }

      const occupied = await tx.occupancy.findFirst({
        where: { bedId: bed.id, status: "ACTIVE" },
      });
      if (occupied) throw new AppError("BED_OCCUPIED", "Bed already has an active occupancy", 409);

      if (admission.currentBedId) {
        await tx.occupancy.updateMany({
          where: { admissionId: admission.id, status: "ACTIVE" },
          data: { status: "CLOSED", checkOut: checkIn },
        });
        await tx.bed.update({
          where: { id: admission.currentBedId },
          data: { status: "AVAILABLE" },
        });
      }

      await tx.occupancy.create({
        data: {
          hospitalId,
          admissionId: admission.id,
          bedId: bed.id,
          checkIn,
          status: "ACTIVE",
        },
      });
      await tx.bed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });

      return tx.admission.update({
        where: { id: admission.id },
        data: {
          currentBedId: bed.id,
          roomCategory: bed.room.category,
        },
        include: {
          currentBed: { include: { room: true } },
          patient: true,
        },
      });
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "bed.assign",
      entityType: "Admission",
      entityId: result.id,
      afterJson: { bedId: body.bedId },
      ip: req.ip,
    });

    return ok(res, result);
  } catch (err) {
    next(err);
  }
});

bedsRouter.post("/transfer", requirePermission("admissions:write", "*"), async (req, res, next) => {
  try {
    const body = assignSchema.parse(req.body);
    req.url = "/assign";
    // Reuse assign which already closes previous occupancy
    const hospitalId = req.user!.hospitalId;
    const checkIn = body.checkIn ? new Date(body.checkIn) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findFirst({
        where: { id: body.admissionId, hospitalId },
      });
      if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);
      if (!admission.currentBedId) {
        throw new AppError("NO_CURRENT_BED", "Admission has no current bed to transfer from", 409);
      }
      if (admission.currentBedId === body.bedId) {
        throw new AppError("SAME_BED", "Patient is already on this bed", 409);
      }

      const bed = await tx.bed.findFirst({
        where: { id: body.bedId, hospitalId },
        include: { room: true },
      });
      if (!bed || bed.status !== "AVAILABLE") {
        throw new AppError("BED_UNAVAILABLE", "Target bed is not available", 409);
      }

      await tx.occupancy.updateMany({
        where: { admissionId: admission.id, status: "ACTIVE" },
        data: { status: "CLOSED", checkOut: checkIn },
      });
      await tx.bed.update({
        where: { id: admission.currentBedId },
        data: { status: "AVAILABLE" },
      });
      await tx.occupancy.create({
        data: {
          hospitalId,
          admissionId: admission.id,
          bedId: bed.id,
          checkIn,
          status: "ACTIVE",
        },
      });
      await tx.bed.update({ where: { id: bed.id }, data: { status: "OCCUPIED" } });

      return tx.admission.update({
        where: { id: admission.id },
        data: { currentBedId: bed.id, roomCategory: bed.room.category },
        include: { currentBed: { include: { room: true } }, patient: true },
      });
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "bed.transfer",
      entityType: "Admission",
      entityId: result.id,
      afterJson: { bedId: body.bedId },
      ip: req.ip,
    });

    return ok(res, result);
  } catch (err) {
    next(err);
  }
});
