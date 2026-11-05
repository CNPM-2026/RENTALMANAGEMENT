import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const supportService = {
  create: async (userId: string, data: {
    roomId?: string;
    category: string;
    subject: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }) => {
    if (data.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: data.roomId, contracts: { some: { tenantId: userId, status: 'ACTIVE' } } },
        select: { id: true },
      });
      if (!room) throw new AppError('Bạn không có hợp đồng thuê đang hoạt động ở phòng này', 403);
    }
    return prisma.supportTicket.create({ data: { ...data, userId } });
  },

  getMine: (userId: string) => prisma.supportTicket.findMany({
    where: { userId },
    include: { room: { select: { roomNumber: true } } },
    orderBy: { updatedAt: 'desc' },
  }),

  getById: async (userId: string, id: string, isAdmin = false) => {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { id: true, fullName: true, email: true } }, room: true },
    });
    if (!ticket) throw new AppError('Không tìm thấy phiếu hỗ trợ', 404);
    if (!isAdmin && ticket.userId !== userId) throw new AppError('Bạn không có quyền xem phiếu này', 403);
    return ticket;
  },

  getAll: (status?: string) => prisma.supportTicket.findMany({
    where: status ? { status: status as never } : undefined,
    include: { user: { select: { fullName: true, email: true } }, room: { select: { roomNumber: true } } },
    orderBy: { updatedAt: 'desc' },
  }),

  update: async (id: string, data: { status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'; adminReply?: string }) => {
    const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!ticket) throw new AppError('Không tìm thấy phiếu hỗ trợ', 404);
    return prisma.supportTicket.update({
      where: { id },
      data: {
        ...data,
        resolvedAt: data.status === 'RESOLVED' || data.status === 'CLOSED' ? new Date() : undefined,
      },
    });
  },
};
