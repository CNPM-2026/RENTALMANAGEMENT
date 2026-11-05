import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostStatus } from '@prisma/client';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';

export const adminService = {
  // Lấy danh sách bài chờ duyệt
  getPendingPosts: async () => {
    return await prisma.post.findMany({
      where: { status: 'PENDING' },
      include: {
        author: { select: { fullName: true, email: true } },
        images: true,
        room: true
      },
      orderBy: { createdAt: 'asc' } // Cũ nhất xếp trước để duyệt
    });
  },

  // Duyệt hoặc từ chối bài
  updatePostStatus: async (postId: string, status: PostStatus) => {
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) throw new AppError('Không tìm thấy bài đăng', 404);

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { status }
    });

    // Gửi thông báo cho tác giả khi bài đăng được duyệt hoặc từ chối
    if (status === 'APPROVED') {
      await notificationService.createNotification(
        post.authorId,
        'Bài đăng được duyệt',
        `Bài đăng "${post.title}" của bạn đã được duyệt và hiển thị công khai.`,
        'POST_APPROVED',
        postId
      );
    } else if (status === 'REJECTED') {
      await notificationService.createNotification(
        post.authorId,
        'Bài đăng bị từ chối',
        `Bài đăng "${post.title}" của bạn đã bị từ chối duyệt.`,
        'POST_REJECTED',
        postId
      );
    }

    return updatedPost;
  },

  getUsers: async (query: { role?: string; search?: string }) => prisma.user.findMany({
    where: {
      ...(query.role && { role: query.role as never }),
      ...(query.search && {
        OR: [
          { fullName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    },
    select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  }),

  updateUserStatus: async (adminId: string, userId: string, isActive: boolean) => {
    if (adminId === userId) throw new AppError('Không thể tự khóa tài khoản admin hiện tại', 400);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);
    const updated = await prisma.user.update({ where: { id: userId }, data: { isActive } });
    await auditService.record({ userId: adminId, action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', entityType: 'User', entityId: userId });
    return updated;
  },

  getKycSubmissions: (status?: string) => prisma.kycSubmission.findMany({
    where: status ? { status: status as never } : undefined,
    include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  }),

  updateKyc: async (adminId: string, id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const submission = await prisma.kycSubmission.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!submission) throw new AppError('Không tìm thấy hồ sơ KYC', 404);
    const updated = await prisma.kycSubmission.update({
      where: { id },
      data: { status, rejectionReason: status === 'REJECTED' ? rejectionReason : null, reviewedById: adminId, reviewedAt: new Date() },
    });
    await auditService.record({ userId: adminId, action: `KYC_${status}`, entityType: 'KycSubmission', entityId: id });
    return updated;
  },

  getAuditLogs: (query: { search?: string; limit?: number }) => prisma.auditLog.findMany({
    where: query.search ? {
      OR: [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
      ],
    } : undefined,
    include: { user: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(query.limit ?? 100, 1), 200),
  }),

  getContentFilterKeywords: () => prisma.contentFilterKeyword.findMany({ orderBy: { keyword: 'asc' } }),

  addContentFilterKeyword: async (keyword: string) => {
    const normalized = keyword.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) throw new AppError('Từ khóa không được để trống', 400);
    return prisma.contentFilterKeyword.upsert({
      where: { keyword: normalized },
      update: {},
      create: { keyword: normalized },
    });
  },

  removeContentFilterKeyword: async (id: string) => {
    const existing = await prisma.contentFilterKeyword.findUnique({ where: { id } });
    if (!existing) throw new AppError('Không tìm thấy từ khóa', 404);
    return prisma.contentFilterKeyword.delete({ where: { id } });
  },
};