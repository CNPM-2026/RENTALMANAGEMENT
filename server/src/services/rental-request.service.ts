import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const rentalRequestService = {
  create: async (tenantId: string, data: { roomId: string; moveInDate: string; leaseTermMonths: number; occupantsCount?: number; note?: string }) => {
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, status: 'AVAILABLE' },
      include: { property: { select: { landlordId: true } } },
    });
    if (!room) throw new AppError('Phòng không tồn tại hoặc không còn trống', 400);
    const duplicate = await prisma.rentalRequest.findFirst({
      where: { tenantId, roomId: data.roomId, status: 'SUBMITTED' },
      select: { id: true },
    });
    if (duplicate) throw new AppError('Bạn đã gửi yêu cầu cho phòng này', 409);
    return prisma.rentalRequest.create({
      data: { ...data, tenantId, landlordId: room.property.landlordId, moveInDate: new Date(data.moveInDate) },
      include: { room: { include: { property: true } } },
    });
  },
  getMine: (userId: string, role: string) => prisma.rentalRequest.findMany({
    where: role === 'LANDLORD' ? { landlordId: userId } : { tenantId: userId },
    include: { room: { include: { property: true } }, tenant: { select: { fullName: true, phone: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
  }),
  updateStatus: async (userId: string, role: string, id: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    const request = await prisma.rentalRequest.findUnique({ where: { id } });
    if (!request) throw new AppError('Không tìm thấy yêu cầu thuê phòng', 404);
    const allowed = role === 'LANDLORD'
      ? request.landlordId === userId
      : role === 'TENANT'
        ? request.tenantId === userId && status === 'CANCELLED'
        : false;
    if (!allowed) throw new AppError('Bạn không có quyền cập nhật yêu cầu này', 403);
    if (request.status !== 'SUBMITTED') throw new AppError('Yêu cầu đã được xử lý', 400);
    return prisma.rentalRequest.update({ where: { id }, data: { status } });
  },
};
