import { prisma } from "./prisma";

export async function writeAudit(params: {
  hospitalId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      hospitalId: params.hospitalId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeJson: params.beforeJson as object | undefined,
      afterJson: params.afterJson as object | undefined,
      ip: params.ip ?? null,
    },
  });
}
