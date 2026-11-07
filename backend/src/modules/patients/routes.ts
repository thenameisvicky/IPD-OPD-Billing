import { Router } from "express";
import { z } from "zod";
import { writeAudit } from "../../lib/audit";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { created, ok, paginated } from "../../lib/response";
import { nextNumber } from "../numbers/series";
import { requireAuth, requirePermission } from "../../middleware/auth";

export const patientsRouter = Router();
patientsRouter.use(requireAuth);

const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  sex: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  dob: z.string().datetime().optional().nullable(),
  ageYears: z.number().int().min(0).max(150).optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  identifiers: z
    .array(z.object({ system: z.string(), value: z.string() }))
    .optional(),
});

patientsRouter.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const name = String(req.query.name || "").trim();
    const phone = String(req.query.phone || "").trim();
    const dob = String(req.query.dob || "").trim(); // YYYY-MM-DD
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 50)));
    const hospitalId = req.user!.hospitalId;

    const orFilters: any[] = [];

    if (name) {
      orFilters.push(
        { displayName: { contains: name, mode: "insensitive" as const } },
        { firstName: { contains: name, mode: "insensitive" as const } },
        { lastName: { contains: name, mode: "insensitive" as const } },
      );
    }
    if (phone) {
      orFilters.push({ phone: { contains: phone } });
    }
    if (dob) {
      const dayStart = new Date(`${dob}T00:00:00.000Z`);
      const dayEnd = new Date(`${dob}T23:59:59.999Z`);
      orFilters.push({ dob: { gte: dayStart, lte: dayEnd } });
    }
    if (q && !name && !phone && !dob) {
      orFilters.push(
        { uhid: { contains: q, mode: "insensitive" as const } },
        { displayName: { contains: q, mode: "insensitive" as const } },
        { phone: { contains: q } },
        { firstName: { contains: q, mode: "insensitive" as const } },
        { lastName: { contains: q, mode: "insensitive" as const } },
      );
    }

    const where =
      orFilters.length > 0
        ? { hospitalId, OR: orFilters }
        : { hospitalId };

    const [total, rows] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { identifiers: true },
      }),
    ]);

    return paginated(
      res,
      rows.map((p) => ({
        id: p.id,
        uhid: p.uhid,
        name: p.displayName,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        age: p.ageYears,
        dob: p.dob,
        sex: p.sex,
        address: [p.addressLine1, p.city, p.state, p.pincode].filter(Boolean).join(", "),
        status: p.status,
        identifiers: p.identifiers,
        createdAt: p.createdAt,
      })),
      { page, pageSize, total },
    );
  } catch (err) {
    next(err);
  }
});

patientsRouter.post("/", requirePermission("patients:write", "*"), async (req, res, next) => {
  try {
    const body = patientSchema.parse(req.body);
    const hospitalId = req.user!.hospitalId;
    const hospital = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId } });

    const patient = await prisma.$transaction(async (tx) => {
      const uhid = await nextNumber(tx, {
        hospitalId,
        kind: "UHID",
        fiscalYearStartMonth: hospital.financialYearStartMonth,
        useFiscalYear: false,
      });
      const displayName = [body.firstName, body.lastName].filter(Boolean).join(" ");
      const createdPatient = await tx.patient.create({
        data: {
          hospitalId,
          uhid,
          firstName: body.firstName,
          lastName: body.lastName || null,
          displayName,
          sex: body.sex,
          dob: body.dob ? new Date(body.dob) : null,
          ageYears: body.ageYears ?? null,
          phone: body.phone || null,
          email: body.email || null,
          addressLine1: body.addressLine1 || null,
          addressLine2: body.addressLine2 || null,
          city: body.city || null,
          state: body.state || null,
          pincode: body.pincode || null,
          identifiers: body.identifiers?.length
            ? {
                create: body.identifiers.map((id) => ({
                  hospitalId,
                  system: id.system,
                  value: id.value,
                })),
              }
            : undefined,
        },
        include: { identifiers: true },
      });
      return createdPatient;
    });

    await writeAudit({
      hospitalId,
      actorUserId: req.user!.id,
      action: "patient.create",
      entityType: "Patient",
      entityId: patient.id,
      afterJson: { id: patient.id, uhid: patient.uhid },
      ip: req.ip,
    });

    return created(res, patient);
  } catch (err) {
    next(err);
  }
});

patientsRouter.get("/:id", async (req, res, next) => {
  try {
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
      include: {
        identifiers: true,
        admissions: { orderBy: { admittedAt: "desc" }, take: 10 },
      },
    });
    if (!patient) throw new AppError("NOT_FOUND", "Patient not found", 404);
    return ok(res, patient);
  } catch (err) {
    next(err);
  }
});

patientsRouter.patch("/:id", requirePermission("patients:write", "*"), async (req, res, next) => {
  try {
    const body = patientSchema.partial().parse(req.body);
    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id, hospitalId: req.user!.hospitalId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Patient not found", 404);

    const displayName =
      body.firstName || body.lastName
        ? [body.firstName ?? existing.firstName, body.lastName ?? existing.lastName]
            .filter(Boolean)
            .join(" ")
        : undefined;

    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        ...body,
        dob: body.dob === undefined ? undefined : body.dob ? new Date(body.dob) : null,
        displayName,
        identifiers: undefined,
      },
    });

    await writeAudit({
      hospitalId: req.user!.hospitalId,
      actorUserId: req.user!.id,
      action: "patient.update",
      entityType: "Patient",
      entityId: patient.id,
      beforeJson: { id: existing.id },
      afterJson: { id: patient.id },
      ip: req.ip,
    });

    return ok(res, patient);
  } catch (err) {
    next(err);
  }
});
