import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const maintenanceService = {
  create: async (tenantId: string, data: { roomId: string; title: string; description: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) => {
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, contracts: { some: { tenantId, status: 'ACTIVE' } } },
      include: { property: { select: { landlordId: true } } },
    });
    if (!room) throw new AppError('Bạn không có hợp đồng thuê đang hoạt động ở phòng này', 403);
    return prisma.maintenanceRequest.create({ data: { ...data, tenantId, landlordId: room.property.landlordId } });
  },
  getMine: (userId: string, role: string) => prisma.maintenanceRequest.findMany({
    where: role === 'LANDLORD' ? { landlordId: userId } : { tenantId: userId },
    include: { room: { select: { roomNumber: true } }, tenant: { select: { fullName: true } } },
    orderBy: { updatedAt: 'desc' },
  }),
  update: async (landlordId: string, id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    const item = await prisma.maintenanceRequest.findFirst({ where: { id, landlordId } });
    if (!item) throw new AppError('Không tìm thấy phiếu bảo trì hoặc bạn không có quyền', 404);
    return prisma.maintenanceRequest.update({
      where: { id },
      data: { status, resolvedAt: status === 'COMPLETED' ? new Date() : null },
    });
  },
};
