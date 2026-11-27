import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { BlacklistType } from '@prisma/client';
import { adminService } from './admin.service';

export const blacklistService = {
  getAll: async (params?: { search?: string; type?: string }) => {
    const where: any = {};
    if (params?.type && (params.type === 'PHONE' || params.type === 'EMAIL')) {
      where.type = params.type as BlacklistType;
    }
    if (params?.search) {
      where.value = { contains: params.search.trim().toLowerCase(), mode: 'insensitive' };
    }
    return prisma.blacklist.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  create: async (adminId: string, data: { type: BlacklistType; value: string; reason?: string }) => {
    const normalizedValue = data.value.trim().toLowerCase();
    if (!normalizedValue) {
      throw new AppError('Giá trị danh sách đen không được để trống', 400);
    }

    const existing = await prisma.blacklist.findUnique({
      where: { value: normalizedValue },
    });
    if (existing) {
      throw new AppError('Giá trị này đã tồn tại trong danh sách đen', 409);
    }

    const blacklistEntry = await prisma.blacklist.create({
      data: {
        type: data.type,
        value: normalizedValue,
        reason: data.reason?.trim() || null,
        createdById: adminId,
      },
    });

    // Nếu có tài khoản tương ứng đang hoạt động, lập tức khóa tài khoản đó (Ban)
    const matchedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { equals: normalizedValue, mode: 'insensitive' } },
          { phone: { equals: normalizedValue } },
        ],
        isActive: true,
      },
      select: { id: true, role: true },
    });

    for (const user of matchedUsers) {
      if (user.role !== 'ADMIN') {
        await adminService.updateUserStatus(
          adminId,
          user.id,
          false,
          `Đưa vào danh sách đen (${data.type}): ${data.reason || 'Vi phạm nghiêm trọng'}`
        ).catch(() => undefined);
      }
    }

    return blacklistEntry;
  },

  delete: async (adminId: string, id: string) => {
    const existing = await prisma.blacklist.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Không tìm thấy mục trong danh sách đen', 404);
    }
    await prisma.blacklist.delete({ where: { id } });
    return { success: true };
  },

  checkBlacklist: async (phone?: string | null, email?: string | null) => {
    if (typeof (prisma as any).blacklist?.findFirst !== 'function') return;
    const checks: string[] = [];
    if (email) checks.push(email.trim().toLowerCase());
    if (phone) checks.push(phone.trim().toLowerCase());

    if (checks.length === 0) return;

    const matched = await prisma.blacklist.findFirst({
      where: {
        value: { in: checks },
      },
    });

    if (matched) {
      throw new AppError(
        `Thông tin đăng ký (${matched.type === 'PHONE' ? 'Số điện thoại' : 'Email'}) đã bị đưa vào danh sách đen: ${matched.reason || 'Vi phạm điều khoản dịch vụ'}. Không thể đăng ký hoặc đăng nhập.`,
        403,
        'BLACKLISTED'
      );
    }
  },
};
