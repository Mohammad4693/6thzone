import { prisma } from '../prisma';

export async function logAudit(
  actorId: string | null | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: any
) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, details: details || undefined },
    });
  } catch (e) {
    console.error('[AuditLog error]', e);
  }
}
