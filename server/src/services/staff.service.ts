import prisma from '../config/db';
import { AppError } from '../utils/AppError';

const staffSelect = {
  id: true,
  permissions: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true } },
} as const;

export const staffService = {
  list: (landlordId: string) => prisma.staffMembership.findMany({
    where: { landlordId },
    select: staffSelect,
    orderBy: { createdAt: 'desc' },
  }),

  invite: async (landlordId: string, email: string, permissions: string[]) => {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError('Không tìm thấy tài khoản với email này', 404);
    if (user.role === 'LANDLORD') throw new AppError('Không thể thêm tài khoản chủ trọ làm nhân viên', 400);
    if (user.id === landlordId) throw new AppError('Không thể tự thêm chính mình', 400);
    const existing = await prisma.staffMembership.findUnique({
      where: { landlordId_userId: { landlordId, userId: user.id } },
    });
    if (existing) throw new AppError('Tài khoản này đã có trong danh sách nhân viên', 409);
    return prisma.staffMembership.create({
      data: { landlordId, userId: user.id, permissions: permissions as never[] },
      select: staffSelect,
    });
  },

  update: async (landlordId: string, id: string, data: { permissions?: string[]; isActive?: boolean }) => {
    const membership = await prisma.staffMembership.findFirst({ where: { id, landlordId } });
    if (!membership) throw new AppError('Không tìm thấy nhân viên', 404);
    return prisma.staffMembership.update({
      where: { id },
      data: { ...data, permissions: data.permissions as never[] | undefined },
      select: staffSelect,
    });
  },

  remove: async (landlordId: string, id: string) => {
    const membership = await prisma.staffMembership.findFirst({ where: { id, landlordId } });
    if (!membership) throw new AppError('Không tìm thấy nhân viên', 404);
    await prisma.staffMembership.delete({ where: { id } });
  },
};
