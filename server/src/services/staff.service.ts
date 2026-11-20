import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { auditService } from './audit.service';

const staffSelect = {
  id: true,
  permissions: true,
  isActive: true,
  createdAt: true,
  user: { select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true } },
} as const;

export const staffService = {
  /**
   * Quyền nhân viên của CHÍNH người đang đăng nhập.
   *
   * Dùng cho client biết được mình đang được chủ trọ nào cấp quyền gì (để hiện
   * đúng menu `/landlord/*`). Trả `null` nếu không phải nhân viên — không lỗi,
   * vì phần lớn tài khoản không có membership nào.
   */
  getMyMembership: async (userId: string) =>
    prisma.staffMembership.findFirst({
      where: { userId, isActive: true },
      select: {
        id: true,
        landlordId: true,
        permissions: true,
        createdAt: true,
        landlord: { select: { id: true, fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

  list: (landlordId: string) => prisma.staffMembership.findMany({
    where: { landlordId },
    select: staffSelect,
    orderBy: { createdAt: 'desc' },
  }),

  invite: async (landlordId: string, email: string, permissions: string[]) => {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new AppError('Không tìm thấy tài khoản với email này', 404);
    if (user.role === 'LANDLORD') throw new AppError('Không thể thêm tài khoản chủ trọ làm nhân viên', 400);
    // Thợ marketplace là nhà cung cấp ĐỘC LẬP: cấp cho họ quyền quản lý tài sản
    // của chủ trọ sẽ phá vỡ ranh giới độc lập (xem yêu cầu 2.2).
    if (user.role === 'STAFF') {
      throw new AppError('Tài khoản thợ độc lập không thể thêm làm nhân viên của chủ trọ', 400);
    }
    if (user.id === landlordId) throw new AppError('Không thể tự thêm chính mình', 400);
    const existing = await prisma.staffMembership.findUnique({
      where: { landlordId_userId: { landlordId, userId: user.id } },
    });
    if (existing) throw new AppError('Tài khoản này đã có trong danh sách nhân viên', 409);
    const created = await prisma.staffMembership.create({
      data: { landlordId, userId: user.id, permissions: permissions as never[] },
      select: staffSelect,
    });
    await auditService.record({ userId: landlordId, action: 'INVITE_STAFF', entityType: 'StaffMembership', entityId: created.id }).catch(() => undefined);
    return created;
  },

  update: async (landlordId: string, id: string, data: { permissions?: string[]; isActive?: boolean }) => {
    const membership = await prisma.staffMembership.findFirst({ where: { id, landlordId } });
    if (!membership) throw new AppError('Không tìm thấy nhân viên', 404);
    const updated = await prisma.staffMembership.update({
      where: { id },
      data: { ...data, permissions: data.permissions as never[] | undefined },
      select: staffSelect,
    });
    await auditService.record({ userId: landlordId, action: 'UPDATE_STAFF', entityType: 'StaffMembership', entityId: updated.id }).catch(() => undefined);
    return updated;
  },

  remove: async (landlordId: string, id: string) => {
    const membership = await prisma.staffMembership.findFirst({ where: { id, landlordId } });
    if (!membership) throw new AppError('Không tìm thấy nhân viên', 404);
    await prisma.staffMembership.delete({ where: { id } });
    await auditService.record({ userId: landlordId, action: 'REMOVE_STAFF', entityType: 'StaffMembership', entityId: id }).catch(() => undefined);
  },
};
