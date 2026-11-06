/**
 * Demo seed — synthetic hospital / patient data for development and tests.
 * The reference bill layout from the product brief is reproduced with DEMO_* identifiers.
 * Do not treat this as real patient or hospital identity.
 */
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import { PrismaClient, ServiceCategory, ChargeUnit } from "@prisma/client";
import { moneyToString } from "../src/lib/money";

const prisma = new PrismaClient();

type LineSeed = {
  code: string;
  name: string;
  category: ServiceCategory;
  unit: ChargeUnit;
  rate: string;
  quantity: string;
  days?: string;
};

const REFERENCE_LINES: LineSeed[] = [
  {
    code: "ROOM-SAC",
    name: "Room Rent (Single AC Room)",
    category: "ROOM_RENT",
    unit: "PER_DAY",
    rate: "4500.00",
    quantity: "4",
    days: "4",
  },
  {
    code: "NURSING-RD",
    name: "Nursing & Resident Doctor Charges",
    category: "NURSING",
    unit: "PER_DAY",
    rate: "1500.00",
    quantity: "4",
    days: "4",
  },
  {
    code: "TREAT-CONS",
    name: "Treating Doctor Consultation Fees",
    category: "TREATING_DOCTOR",
    unit: "PER_DAY",
    rate: "1200.00",
    quantity: "4",
    days: "4",
  },
  {
    code: "SPEC-ENDO",
    name: "Specialist Cross-Consultation (Endo)",
    category: "SPECIALIST_CONSULTATION",
    unit: "PER_VISIT",
    rate: "1500.00",
    quantity: "1",
  },
  {
    code: "CATH-OT",
    name: "Cath Lab / Operation Theatre Charges",
    category: "CATH_LAB",
    unit: "LUMP_SUM",
    rate: "28000.00",
    quantity: "1",
  },
  {
    code: "PROC-ANGIO",
    name: "Procedure Fee (Interventional Angioplasty)",
    category: "PROCEDURE",
    unit: "LUMP_SUM",
    rate: "45000.00",
    quantity: "1",
  },
  {
    code: "ANES-1",
    name: "Anesthetist Charges",
    category: "ANESTHETIST",
    unit: "LUMP_SUM",
    rate: "8000.00",
    quantity: "1",
  },
  {
    code: "IMPL-DES",
    name: "Coronary Drug-Eluting Stent (DES)",
    category: "MEDICAL_IMPLANT",
    unit: "PER_ITEM",
    rate: "29600.00",
    quantity: "1",
  },
  {
    code: "PHARM-ANNEX",
    name: "Pharmacy & In-house Consumables (Annex-1)",
    category: "PHARMACY",
    unit: "AS_BILLED",
    rate: "18450.00",
    quantity: "1",
  },
  {
    code: "LAB-BLOOD",
    name: "Laboratory Investigations (Blood, Trop-I)",
    category: "LABORATORY",
    unit: "AS_BILLED",
    rate: "6200.00",
    quantity: "1",
  },
  {
    code: "RAD-ECG",
    name: "Radiology / Diagnostics (ECG, 2D Echo)",
    category: "RADIOLOGY",
    unit: "AS_BILLED",
    rate: "4500.00",
    quantity: "1",
  },
  {
    code: "MRD-DOC",
    name: "Medical Record & Documentation Charges",
    category: "MEDICAL_RECORDS",
    unit: "LUMP_SUM",
    rate: "500.00",
    quantity: "1",
  },
];

async function main() {
  console.log("Seeding healthcare billing demo data...");

  // Clean demo tenant only (safe re-seed)
  const existing = await prisma.hospital.findUnique({ where: { code: "DEMO-HOSP" } });
  if (existing) {
    console.log("Demo hospital already present — wiping demo tenant rows for re-seed");
    const hid = existing.id;
    await prisma.refundAllocation.deleteMany({ where: { refund: { hospitalId: hid } } });
    await prisma.refund.deleteMany({ where: { hospitalId: hid } });
    await prisma.advanceAllocation.deleteMany({ where: { advance: { hospitalId: hid } } });
    await prisma.paymentAllocation.deleteMany({ where: { payment: { hospitalId: hid } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { hospitalId: hid } } });
    await prisma.invoiceAdjustment.deleteMany({ where: { invoice: { hospitalId: hid } } });
    await prisma.invoice.deleteMany({ where: { hospitalId: hid } });
    await prisma.payment.deleteMany({ where: { hospitalId: hid } });
    await prisma.advance.deleteMany({ where: { hospitalId: hid } });
    await prisma.admissionCharge.deleteMany({ where: { hospitalId: hid } });
    await prisma.occupancy.deleteMany({ where: { hospitalId: hid } });
    await prisma.admission.deleteMany({ where: { hospitalId: hid } });
    await prisma.encounter.deleteMany({ where: { hospitalId: hid } });
    await prisma.tariff.deleteMany({ where: { hospitalId: hid } });
    await prisma.serviceItem.deleteMany({ where: { hospitalId: hid } });
    await prisma.taxProfile.deleteMany({ where: { hospitalId: hid } });
    await prisma.bed.deleteMany({ where: { hospitalId: hid } });
    await prisma.room.deleteMany({ where: { hospitalId: hid } });
    await prisma.ward.deleteMany({ where: { hospitalId: hid } });
    await prisma.practitioner.deleteMany({ where: { hospitalId: hid } });
    await prisma.department.deleteMany({ where: { hospitalId: hid } });
    await prisma.patientIdentifier.deleteMany({ where: { hospitalId: hid } });
    await prisma.patient.deleteMany({ where: { hospitalId: hid } });
    await prisma.numberSeries.deleteMany({ where: { hospitalId: hid } });
    await prisma.auditLog.deleteMany({ where: { hospitalId: hid } });
    await prisma.financialTransaction.deleteMany({ where: { hospitalId: hid } });
    await prisma.userRole.deleteMany({ where: { user: { hospitalId: hid } } });
    await prisma.user.deleteMany({ where: { hospitalId: hid } });
    await prisma.hospital.delete({ where: { id: hid } });
  }

  const permissions = [
    { code: "*", description: "All permissions" },
    { code: "patients:write", description: "Create/update patients" },
    { code: "admissions:write", description: "Manage admissions" },
    { code: "catalogue:write", description: "Manage services/tariffs" },
    { code: "billing:write", description: "Manage charges" },
    { code: "invoices:finalise", description: "Finalize invoices" },
    { code: "invoices:cancel", description: "Cancel invoices" },
    { code: "payments:write", description: "Collect payments" },
    { code: "refunds:write", description: "Request refunds" },
    { code: "refunds:approve", description: "Approve refunds" },
    { code: "hospital:write", description: "Update hospital settings" },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      create: p,
      update: { description: p.description },
    });
  }

  const hospital = await prisma.hospital.create({
    data: {
      code: "DEMO-HOSP",
      name: "DEMO City General Hospital (Synthetic)",
      addressLine1: "123 Demo Healthcare Avenue",
      addressLine2: "Medical District",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      phone: "+91 44-0000-0000",
      email: "demo.billing@example.hospital",
      registrationNumber: "DEMO/MED/2018/000",
      gstin: "33DEMO0000A1Z5",
      identifierLabel: "ROHINI ID",
      identifierValue: "DEMO890012345",
      declarationText:
        "Certified that the services and treatments billed above were administered to the patient during the inpatient stay.",
      defaultNotes:
        "Stent pricing is strictly in compliance with NPPA guidelines. Implant sticker/pouch attached with MRD file. [DEMO DATA]",
      authorizedSignatory: "Authorized Signatory & Hospital Seal",
      invoiceFooter: "This is a computer-generated demo invoice for software verification.",
      invoicePrefix: "DEMO",
      financialYearStartMonth: 4,
      losChargingPolicy: "CALENDAR_DAY_EXCLUSIVE",
      isDemo: true,
    },
  });

  const role = await prisma.role.create({
    data: {
      hospitalId: hospital.id,
      code: "BILLING_ADMIN",
      name: "Billing Administrator",
      permissions: {
        create: (await prisma.permission.findMany()).map((p) => ({
          permissionId: p.id,
        })),
      },
    },
  });

  const passwordHash = await bcrypt.hash("billing123", 10);
  const user = await prisma.user.create({
    data: {
      hospitalId: hospital.id,
      email: "billing@demo.hospital",
      username: "billing",
      passwordHash,
      name: "Demo Billing Clerk",
      roles: { create: [{ roleId: role.id }] },
    },
  });

  const fy = "2026-27";
  const series = [
    { kind: "UHID" as const, prefix: "DEMO-UHID-", pad: 4, fiscalYear: null as string | null },
    { kind: "IP" as const, prefix: "IP-", pad: 5, fiscalYear: null },
    { kind: "INVOICE_IP" as const, prefix: "DEMO/IP/{FY}/", pad: 4, fiscalYear: fy },
    { kind: "INVOICE_OP" as const, prefix: "DEMO/OP/{FY}/", pad: 4, fiscalYear: fy },
    { kind: "RECEIPT" as const, prefix: "REC-{FY}/", pad: 4, fiscalYear: fy },
    { kind: "REFUND" as const, prefix: "REF-{FY}/", pad: 4, fiscalYear: fy },
  ];
  for (const s of series) {
    await prisma.numberSeries.create({
      data: {
        hospitalId: hospital.id,
        kind: s.kind,
        prefix: s.prefix,
        pad: s.pad,
        nextValue: s.kind === "IP" ? 94021 : s.kind === "UHID" ? 8831 : 1,
        fiscalYear: s.fiscalYear,
      },
    });
  }

  const taxExempt = await prisma.taxProfile.create({
    data: {
      hospitalId: hospital.id,
      code: "EXEMPT",
      name: "Healthcare Exempt (review with CA)",
      isExempt: true,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
    },
  });

  const cardiology = await prisma.department.create({
    data: { hospitalId: hospital.id, code: "CARD", name: "Cardiology" },
  });

  const consultant = await prisma.practitioner.create({
    data: {
      hospitalId: hospital.id,
      name: "Dr. R. Sundaram (DEMO)",
      qualification: "MD, DM (Cardiology)",
      departmentId: cardiology.id,
      registrationNo: "DEMO-MCI-0001",
    },
  });

  const ward = await prisma.ward.create({
    data: { hospitalId: hospital.id, code: "W1", name: "Ward A" },
  });
  const room = await prisma.room.create({
    data: {
      hospitalId: hospital.id,
      wardId: ward.id,
      code: "R304",
      name: "Room 304",
      category: "Single Private Room",
      dailyRent: "4500.00",
    },
  });
  const bed = await prisma.bed.create({
    data: {
      hospitalId: hospital.id,
      roomId: room.id,
      code: "304-A",
      status: "AVAILABLE",
    },
  });

  // Extra available beds
  for (const code of ["305-A", "306-A", "ICU-1"]) {
    const r = await prisma.room.create({
      data: {
        hospitalId: hospital.id,
        wardId: ward.id,
        code: `R-${code}`,
        name: code.startsWith("ICU") ? "ICU Bay" : `Room ${code.split("-")[0]}`,
        category: code.startsWith("ICU") ? "ICU" : "Single Private Room",
        dailyRent: code.startsWith("ICU") ? "8000.00" : "4500.00",
      },
    });
    await prisma.bed.create({
      data: { hospitalId: hospital.id, roomId: r.id, code, status: "AVAILABLE" },
    });
  }

  for (const line of REFERENCE_LINES) {
    const service = await prisma.serviceItem.create({
      data: {
        hospitalId: hospital.id,
        code: line.code,
        name: line.name,
        category: line.category,
        unit: line.unit,
        departmentId: cardiology.id,
        taxProfileId: taxExempt.id,
      },
    });
    await prisma.tariff.create({
      data: {
        hospitalId: hospital.id,
        serviceItemId: service.id,
        version: 1,
        rate: line.rate,
        roomCategory: line.category === "ROOM_RENT" ? "Single Private Room" : null,
        taxProfileId: taxExempt.id,
        effectiveFrom: new Date("2026-04-01"),
        active: true,
      },
    });
  }

  // Synthetic reference patient (not a real person)
  const patient = await prisma.patient.create({
    data: {
      hospitalId: hospital.id,
      uhid: "DEMO-2024-8831",
      firstName: "Ramesh",
      lastName: "Kumar (DEMO)",
      displayName: "Mr. Ramesh Kumar (DEMO)",
      sex: "MALE",
      ageYears: 54,
      phone: "9000000001",
      addressLine1: "Demo Address Line",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
    },
  });

  // Bump UHID series past seeded value
  await prisma.numberSeries.updateMany({
    where: { hospitalId: hospital.id, kind: "UHID" },
    data: { nextValue: 8832 },
  });
  await prisma.numberSeries.updateMany({
    where: { hospitalId: hospital.id, kind: "IP" },
    data: { nextValue: 94022 },
  });

  const admittedAt = new Date("2026-10-24T10:15:00+05:30");
  const dischargedAt = new Date("2026-10-28T14:30:00+05:30");

  const admission = await prisma.admission.create({
    data: {
      hospitalId: hospital.id,
      patientId: patient.id,
      ipNumber: "IP-94021",
      departmentId: cardiology.id,
      practitionerId: consultant.id,
      admittedAt,
      dischargedAt,
      status: "BILLING",
      roomCategory: "Single Private Room",
      currentBedId: null,
      primaryDiagnosis: "Acute Coronary Syndrome (Unstable Angina)",
      diagnosisCode: "I20.0",
      procedureInfo: "Coronary Angiogram (CAG) + Stent (DES)",
      policyholderName: "Mr. Ramesh Kumar (DEMO)",
      insurerName: "Star Health & Allied Insurance (DEMO)",
      insuranceCardNo: "DEMO0029384719",
      policyNo: "DEMO/SH/2025/00",
    },
  });

  // Occupancy history (closed — patient in billing)
  await prisma.occupancy.create({
    data: {
      hospitalId: hospital.id,
      admissionId: admission.id,
      bedId: bed.id,
      checkIn: admittedAt,
      checkOut: dischargedAt,
      status: "CLOSED",
    },
  });

  const services = await prisma.serviceItem.findMany({ where: { hospitalId: hospital.id } });
  for (const line of REFERENCE_LINES) {
    const service = services.find((s) => s.code === line.code)!;
    const qty = line.days || line.quantity;
    const lineTotal = moneyToString(Number(line.rate) * Number(qty));
    await prisma.admissionCharge.create({
      data: {
        hospitalId: hospital.id,
        admissionId: admission.id,
        serviceItemId: service.id,
        description: line.name,
        category: line.category,
        unit: line.unit,
        rate: line.rate,
        quantity: qty,
        days: line.days || null,
        serviceDate: admittedAt,
        practitionerId: consultant.id,
        discountAmount: "0.00",
        taxProfileId: taxExempt.id,
        taxAmount: "0.00",
        lineTotal,
        status: "DRAFT",
      },
    });
  }

  // ₹30,000 advance on admission
  await prisma.advance.create({
    data: {
      hospitalId: hospital.id,
      patientId: patient.id,
      admissionId: admission.id,
      number: "REC-2026-27/0411",
      method: "UPI",
      amount: "30000.00",
      balance: "30000.00",
      status: "OPEN",
      receivedAt: admittedAt,
      receivedById: user.id,
      notes: "Admission advance (DEMO)",
    },
  });
  await prisma.numberSeries.updateMany({
    where: { hospitalId: hospital.id, kind: "RECEIPT" },
    data: { nextValue: 412 },
  });

  console.log("Seed complete.");
  console.log("Login: username=billing  password=billing123");
  console.log(`Hospital: ${hospital.name} (${hospital.id})`);
  console.log(`Demo admission: ${admission.ipNumber} / patient ${patient.uhid}`);
  console.log("Expected gross total from draft charges: 170550.00 (sum of line items)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
