import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostStatus } from '@prisma/client';
import type { KycStatus, Prisma, Role } from '@prisma/client';
import { notificationService } from './notification.service';
import { auditService } from './audit.service';
import { storageService } from './storage.service';
import { invalidateUserSockets } from '../socket/sessionInvalidation';

/** Giá trị hợp lệ cho bộ lọc hàng đợi KYC; giá trị lạ bị BỎ QUA (không 500). */
const KYC_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
/** Chỉ các role này mới có hồ sơ KYC (TENANT/ADMIN nộp qua API cũ vẫn xem được khi không lọc). */
const KYC_ROLES = ['LANDLORD', 'STAFF'] as const;

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
  updatePostStatus: async (postId: string, status: PostStatus, reason?: string) => {
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
      const content = reason
        ? `Bài đăng "${post.title}" của bạn đã bị từ chối duyệt. Lý do: ${reason}`
        : `Bài đăng "${post.title}" của bạn đã bị từ chối duyệt. Vui lòng kiểm tra lại nội dung và hình ảnh.`;
      await notificationService.createNotification(
        post.authorId,
        'Bài đăng bị từ chối',
        content,
        'POST_REJECTED',
        postId
      );
    }

    return updatedPost;
  },

  deletePost: async (adminId: string, postId: string) => {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, images: { select: { imageUrl: true } } } });
    if (!post) throw new AppError('Không tìm thấy bài đăng', 404);
    const deleted = await prisma.post.delete({ where: { id: postId } });
    await Promise.all(post.images.map((image) => storageService.deleteImage(image.imageUrl)));
    await auditService.record({ userId: adminId, action: 'DELETE_REPORTED_POST', entityType: 'Post', entityId: postId });
    return deleted;
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

    // Đổi trạng thái và thu hồi refresh token trong CÙNG một transaction, cùng
    // thứ tự khóa users -> refresh_tokens với luồng cấp phiên. Nhờ vậy không có
    // phiên nào chen được vào giữa hai bước (và ngược lại).
    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (locked.length !== 1) throw new AppError('Không tìm thấy người dùng', 404);

      // H-05/Batch 2B1.1 (F-2): mọi thay đổi trạng thái do admin thực hiện đều tăng
      // `authVersion`, nên một "password-setup grant" đang bay bị vô hiệu vĩnh viễn —
      // kể cả trường hợp khóa rồi mở khóa lại trong TTL 10 phút của grant (khi đó
      // `establishPassword` thấy `authVersion` lệch và trả lỗi chung như mọi grant chết).
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive, authVersion: { increment: 1 } },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return user;
    });

    // H-05/Batch 2B2.2 (L1.2): đóng mọi socket realtime đang mở của user NGAY SAU khi
    // transaction commit. Transaction rollback thì hàm này không bao giờ chạy tới,
    // nên một lần đổi trạng thái thất bại không thể đá phiên hợp lệ. Đặt TRƯỚC bước
    // audit để lỗi ghi log (không được rollback thay đổi) cũng không thể giữ lại một
    // phiên đã bị vô hiệu hóa.
    invalidateUserSockets(userId);

    // Audit ghi SAU khi transaction commit: lỗi ghi log không được rollback việc
    // khóa tài khoản (giữ nguyên hành vi đã được duyệt của các luồng admin khác).
    await auditService.record({ userId: adminId, action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', entityType: 'User', entityId: userId });
    return updated;
  },

  /**
   * Hàng đợi KYC dùng CHUNG cho chủ trọ và thợ (một bảng `kyc_submissions`).
   *
   * - `status`: lọc theo trạng thái (`PENDING` mặc định ở UI).
   * - `role`: lọc theo role của người nộp. Không truyền = tất cả (giữ nguyên hành
   *   vi cũ cho các màn hình admin hiện có).
   * - Trả kèm `user.role` để admin phân biệt hồ sơ chủ trọ với hồ sơ thợ.
   */
  getKycSubmissions: async (status?: string, role?: string) => {
    const where: Prisma.KycSubmissionWhereInput = {};
    if (status && (KYC_STATUSES as readonly string[]).includes(status)) {
      where.status = status as KycStatus;
    }
    if (role && (KYC_ROLES as readonly string[]).includes(role)) {
      where.user = { role: role as Role };
    }

    const submissions = await prisma.kycSubmission.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return submissions.map((submission) => ({
      ...submission,
      frontIdUrl: storageService.getPrivateImageUrl(submission.frontIdUrl),
      backIdUrl: storageService.getPrivateImageUrl(submission.backIdUrl),
    }));
  },

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

  getAmenities: () => prisma.amenity.findMany({ orderBy: { name: 'asc' } }),

  createAmenity: async (name: string, iconUrl?: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) throw new AppError('Tên tiện ích không được để trống', 400);
    return prisma.amenity.create({
      data: { name: normalizedName, iconUrl: iconUrl?.trim() || null },
    });
  },

  deleteAmenity: async (id: string) => {
    const amenity = await prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new AppError('Không tìm thấy tiện ích', 404);
    return prisma.amenity.delete({ where: { id } });
  },
};