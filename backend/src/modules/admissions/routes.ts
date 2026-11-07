import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { created, ok, paginated } from "../../lib/response";
import { moneyToString } from "../../lib/money";
import { calculateLosDays } from "../billing/calculator";
import { nextNumber } from "../numbers/series";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const admissionsRouter = Router();
admissionsRouter.use(requireAuth);

const createSchema = z.object({
  patientId: z.string().uuid(),
  admittedAt: z.string().datetime().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  practitionerId: z.string().uuid().optional().nullable(),
  bedId: z.string().uuid().optional().nullable(),
  roomCategory: z.string().optional().nullable(),
  primaryDiagnosis: z.string().optional().nullable(),
  diagnosisCode: z.string().optional().nullable(),
  procedureInfo: z.string().optional().nullable(),
  policyholderName: z.string().optional().nullable(),
  insurerName: z.string().optional().nullable(),
  insuranceCardNo: z.string().optional().nullable(),
  policyNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

admissionsRouter.get("/", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const statusRaw = req.query.status ? String(req.query.status) : "";
    const statuses = statusRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));

    const where = {
      hospitalId,
      ...(statuses.length === 1
        ? { status: statuses[0] as any }
        : statuses.length > 1
          ? { status: { in: statuses as any[] } }
          : {}),
      ...(q
        ? {
            OR: [
              { ipNumber: { contains: q, mode: "insensitive" as const } },
              { patient: { displayName: { contains: q, mode: "insensitive" as const } } },
              { patient: { uhid: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.admission.count({ where }),
      prisma.admission.findMany({
        where,
        select: {
          id: true,
          ipNumber: true,
          status: true,
          admittedAt: true,
          dischargedAt: true,
          patientId: true,
          primaryDiagnosis: true,
          roomCategory: true,
          patient: { select: { displayName: true, uhid: true } },
          department: { select: { name: true } },
          practitioner: { select: { name: true } },
          currentBed: {
            select: {
              code: true,
              room: { select: { name: true, category: true } },
            },
          },
          advances: { select: { balance: true } },
          charges: { where: { status: "DRAFT" }, select: { lineTotal: true } },
          invoices: {
            where: { status: { not: "CANCELLED" } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, number: true, status: true, outstanding: true },
          },
        },
        orderBy: { admittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return paginated(
      res,
      rows.map((a) => {
        const advanceBalance = a.advances.reduce((s, adv) => s + Number(adv.balance), 0);
        const chargeTotal = a.charges.reduce((s, c) => s + Number(c.lineTotal), 0);
        return {
          id: a.id,
          ipNumber: a.ipNumber,
          status: a.status,
          admittedAt: a.admittedAt,
          dischargedAt: a.dischargedAt,
          patientId: a.patientId,
          patientName: a.patient.displayName,
          uhid: a.patient.uhid,
          department: a.department?.name || null,
          practitioner: a.practitioner?.name || null,
          room: a.currentBed?.room?.name || null,
          bed: a.currentBed?.code || null,
          roomCategory: a.roomCategory || a.currentBed?.room?.category || null,
          primaryDiagnosis: a.primaryDiagnosis,
          advanceBalance: moneyToString(advanceBalance),
          draftChargesTotal: moneyToString(chargeTotal),
          latestInvoice: a.invoices[0]
            ? {
                id: a.invoices[0].id,
                number: a.invoices[0].number,
                status: a.invoices[0].status,
                outstanding: moneyToString(a.invoices[0].outstanding),
              }
            : null,
        };
      }),
      { page, pageSize, total },
    );
  } catch (err) {
    next(err);
  }
});

admissionsRouter.post("/", requirePermission("admissions:write", "*"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;
    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });

    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, hospitalId },
    });
    if (!patient) throw new AppError("NOT_FOUND", "Patient not found", 404);

    const active = await prisma.admission.findFirst({
      where: {
        hospitalId,
        patientId: body.patientId,
        status: { in: ["ADMITTED", "BILLING"] },
      },
    });
    if (active) {
      throw new AppError(
        "ACTIVE_ADMISSION_EXISTS",
        `Patient already has active admission ${active.ipNumber}`,
        409,
      );
    }

    const admission = await prisma.$transaction(async (tx) => {
      if (body.bedId) {
        const bed = await tx.bed.findFirst({
          where: { id: body.bedId, hospitalId },
          include: { room: true },
        });
        if (!bed) throw new AppError("NOT_FOUND", "Bed not found", 404);
        if (bed.status !== "AVAILABLE") {
          throw new AppError("BED_UNAVAILABLE", "Bed is not available", 409);
        }
        const conflicting = await tx.occupancy.findFirst({
          where: { bedId: bed.id, status: "ACTIVE" },
        });
        if (conflicting) {
          throw new AppError("BED_OCCUPIED", "Bed is already occupied", 409);
        }
      }

      const ipNumber = await nextNumber(tx, {
        hospitalId,
        kind: "IP",
        fiscalYearStartMonth: hospital.financialYearStartMonth,
        useFiscalYear: false,
      });

      const admittedAt = body.admittedAt ? new Date(body.admittedAt) : new Date();
      let roomCategory = body.roomCategory || null;

      const createdAdmission = await tx.admission.create({
        data: {
          hospitalId,
          patientId: body.patientId,
          ipNumber,
          admittedAt,
          departmentId: body.departmentId || null,
          practitionerId: body.practitionerId || null,
          currentBedId: body.bedId || null,
          roomCategory,
          primaryDiagnosis: body.primaryDiagnosis || null,
          diagnosisCode: body.diagnosisCode || null,
          procedureInfo: body.procedureInfo || null,
          policyholderName: body.policyholderName || null,
          insurerName: body.insurerName || null,
          insuranceCardNo: body.insuranceCardNo || null,
          policyNo: body.policyNo || null,
          notes: body.notes || null,
          status: "ADMITTED",
        },
      });

      if (body.bedId) {
        const bed = await tx.bed.findUniqueOrThrow({
          where: { id: body.bedId },
          include: { room: true },
        });
        roomCategory = roomCategory || bed.room.category;
        await tx.occupancy.create({
          data: {
            hospitalId,
            admissionId: createdAdmission.id,
            bedId: body.bedId,
            checkIn: admittedAt,
            status: "ACTIVE",
          },
        });
        await tx.bed.update({
          where: { id: body.bedId },
          data: { status: "OCCUPIED" },
        });
        if (roomCategory !== createdAdmission.roomCategory) {
          await tx.admission.update({
            where: { id: createdAdmission.id },
            data: { roomCategory },
          });
        }
      }

      return tx.admission.findUniqueOrThrow({
        where: { id: createdAdmission.id },
        include: {
          patient: true,
          department: true,
          practitioner: true,
          currentBed: { include: { room: true } },
        },
      });
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "admission.create",
      entityType: "Admission",
      entityId: admission.id,
      afterJson: { id: admission.id, ipNumber: admission.ipNumber },
      ip: req.ip,
    });

    return created(res, admission);
  } catch (err) {
    next(err);
  }
});

admissionsRouter.get("/:id", async (req, res, next) => {
  try {
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
      include: {
        patient: true,
        department: true,
        practitioner: true,
        currentBed: { include: { room: { include: { ward: true } } } },
        occupancies: {
          include: { bed: { include: { room: true } } },
          orderBy: { checkIn: "asc" },
        },
        charges: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { serviceDate: "asc" },
        },
        advances: { orderBy: { receivedAt: "asc" } },
        invoices: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);

    const hospital = await prisma.hospital.findUniqueOrThrow({
      where: { id: req.user!.hospitalId },
    });
    const los = calculateLosDays(
      admission.admittedAt,
      admission.dischargedAt,
      hospital.losChargingPolicy,
    );

    return ok(res, {
      ...admission,
      lengthOfStayDays: los,
      totals: {
        draftCharges: moneyToString(
          admission.charges
            .filter((c) => c.status === "DRAFT")
            .reduce((s, c) => s + Number(c.lineTotal), 0),
        ),
        advanceBalance: moneyToString(
          admission.advances.reduce((s, a) => s + Number(a.balance), 0),
        ),
        advancesReceived: moneyToString(
          admission.advances.reduce((s, a) => s + Number(a.amount), 0),
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

admissionsRouter.post(
  "/:id/discharge",
  requirePermission("admissions:write", "*"),
  async (req, res, next) => {
    try {
      const dischargedAt = req.body?.dischargedAt
        ? new Date(req.body.dischargedAt)
        : new Date();
      const hospitalId = req.user!.hospitalId;

      const admission = await prisma.$transaction(async (tx) => {
        const existing = await tx.admission.findFirst({
          where: { id: req.params.id, hospitalId },
        });
        if (!existing) throw new AppError("NOT_FOUND", "Admission not found", 404);
        if (existing.status === "DISCHARGED") {
          throw new AppError("ALREADY_DISCHARGED", "Admission already discharged", 409);
        }

        if (existing.currentBedId) {
          await tx.occupancy.updateMany({
            where: { admissionId: existing.id, status: "ACTIVE" },
            data: { status: "CLOSED", checkOut: dischargedAt },
          });
          await tx.bed.update({
            where: { id: existing.currentBedId },
            data: { status: "AVAILABLE" },
          });
        }

        return tx.admission.update({
          where: { id: existing.id },
          data: {
            status: "BILLING",
            dischargedAt,
            currentBedId: null,
          },
          include: { patient: true, practitioner: true, department: true },
        });
      });

      await writeAudit({
        hospitalId,
        actorUserId: req.user!.id,
        action: "admission.discharge",
        entityType: "Admission",
        entityId: admission.id,
        afterJson: { status: admission.status, dischargedAt },
        ip: req.ip,
      });

      return ok(res, admission);
    } catch (err) {
      next(err);
    }
  },
);

admissionsRouter.get("/:id/summary", async (req, res, next) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const admission = await prisma.admission.findFirst({
      where: { id: req.params.id, hospitalId },
      include: {
        patient: true,
        charges: { where: { status: "DRAFT" } },
        advances: true,
        invoices: { where: { purpose: "FINAL", status: { not: "CANCELLED" } } },
      },
    });
    if (!admission) throw new AppError("NOT_FOUND", "Admission not found", 404);

    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });
    return ok(res, {
      admissionId: admission.id,
      ipNumber: admission.ipNumber,
      status: admission.status,
      patientName: admission.patient.displayName,
      lengthOfStayDays: calculateLosDays(
        admission.admittedAt,
        admission.dischargedAt,
        hospital.losChargingPolicy,
      ),
      draftChargeCount: admission.charges.length,
      draftChargeTotal: moneyToString(
        admission.charges.reduce((s, c) => s + Number(c.lineTotal), 0),
      ),
      advanceBalance: moneyToString(
        admission.advances.reduce((s, a) => s + Number(a.balance), 0),
      ),
      hasFinalInvoice: admission.invoices.length > 0,
    });
  } catch (err) {
    next(err);
  }
});
