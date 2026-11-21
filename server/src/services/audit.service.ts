import prisma from '../config/db';

export const auditService = {
  record: async (data: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (typeof prisma.auditLog?.create === 'function') {
      return prisma.auditLog.create({ data: { ...data, metadata: data.metadata as object | undefined } });
    }
    return null;
  },
};
