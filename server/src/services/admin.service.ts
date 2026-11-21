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
/** Chỉ các role này mới có hồ sơ KYC (role khác nộp qua API cũ vẫn xem được khi không lọc). */
const KYC_ROLES = ['TENANT', 'LANDLORD', 'STAFF'] as const;

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
  updatePostStatus: async (postId: string, status: PostStatus, reason?: string, adminId?: string) => {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, isActive: true } },
        room: { select: { id: true, status: true } },
      },
    });

    if (!post) throw new AppError('Không tìm thấy bài đăng', 404);

    if (status === 'APPROVED') {
      if (post.author && !post.author.isActive) {
        throw new AppError('Không thể duyệt bài của tài khoản đã bị khóa', 400);
      }
      if (post.room && post.room.status !== 'AVAILABLE') {
        throw new AppError('Không thể duyệt bài khi phòng không còn trống', 400);
      }
      if (post.expiredAt && post.expiredAt < new Date()) {
        throw new AppError('Bài đăng đã hết hạn, không thể duyệt', 400);
      }
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { status }
    });

    if (adminId) {
      await auditService.record({
        userId: adminId,
        action: status === 'APPROVED' ? 'APPROVE_POST' : 'REJECT_POST',
        entityType: 'Post',
        entityId: postId,
      }).catch(() => undefined);
    }

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
      const locked = await tx.$queryRaw<Array<{ id: string; role?: string; is_active?: boolean }>>`
        SELECT id, role, is_active FROM users WHERE id = ${userId} FOR UPDATE
      `;
      if (locked.length !== 1) throw new AppError('Không tìm thấy người dùng', 404);
      if (locked[0].role === 'ADMIN') {
        throw new AppError('Không thể thay đổi trạng thái của tài khoản admin khác', 400);
      }

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

      if (user.role === 'ADMIN') {
        throw new AppError('Không thể thay đổi trạng thái của tài khoản admin khác', 400);
      }

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
   * Hàng đợi KYC dùng CHUNG cho khách thuê, chủ trọ và thợ (một bảng
   * `kyc_submissions`).
   *
   * - `status`: lọc theo trạng thái (`PENDING` mặc định ở UI).
   * - `role`: lọc theo role của người nộp. Không truyền = tất cả (giữ nguyên
   *   hành vi cũ cho các màn hình admin hiện có).
   * - Trả kèm `user.role` để admin phân biệt hồ sơ khách thuê/chủ trọ/thợ.
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
      frontIdUrl: submission.frontIdUrl
        ? storageService.getPrivateImageUrl(submission.frontIdUrl)
        : null,
      backIdUrl: submission.backIdUrl
        ? storageService.getPrivateImageUrl(submission.backIdUrl)
        : null,
    }));
  },

  getKycSubmissionById: async (id: string) => {
    const submission = await prisma.kycSubmission.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            avatarUrl: true,
            createdAt: true,
            profile: true,
          },
        },
      },
    });
    if (!submission) throw new AppError('Không tìm thấy hồ sơ KYC', 404);
    return {
      ...submission,
      frontIdUrl: submission.frontIdUrl
        ? storageService.getPrivateImageUrl(submission.frontIdUrl)
        : null,
      backIdUrl: submission.backIdUrl
        ? storageService.getPrivateImageUrl(submission.backIdUrl)
        : null,
    };
  },

  updateKyc: async (adminId: string, id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const submission = await prisma.kycSubmission.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, idNumber: true, frontIdUrl: true, backIdUrl: true },
    });
    if (!submission) throw new AppError('Không tìm thấy hồ sơ KYC', 404);

    // Quyết định KYC là cuối cùng và chỉ áp dụng cho hồ sơ đang chờ. Điều kiện
    // này chặn việc admin thứ hai duyệt lại/đổi kết quả một hồ sơ đã xử lý.
    if (submission.status !== 'PENDING') {
      throw new AppError(
        'Hồ sơ KYC đã được xử lý, không thể đổi kết quả.',
        409,
        'KYC_ALREADY_REVIEWED',
      );
    }

    if (status === 'APPROVED' && submission.idNumber) {
      const duplicateApproved = typeof prisma.kycSubmission?.findFirst === 'function'
        ? await prisma.kycSubmission.findFirst({
            where: {
              idNumber: submission.idNumber,
              userId: { not: submission.userId },
              status: 'APPROVED',
            },
            select: { id: true },
          })
        : null;
      if (duplicateApproved) {
        throw new AppError('Số CMND/CCCD này đã được phê duyệt cho tài khoản khác', 409, 'KYC_ID_NUMBER_DUPLICATE');
      }
    }

    const claimed = await prisma.kycSubmission.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        'Hồ sơ KYC vừa được xử lý bởi quản trị viên khác.',
        409,
        'KYC_ALREADY_REVIEWED',
      );
    }
    let updated = await prisma.kycSubmission.findUniqueOrThrow({ where: { id } });

    if (status === 'APPROVED') {
      // Giữ ref cho tới khi Cloudinary xác nhận đã xoá. Nhờ vậy nếu xoá lỗi
      // (hoặc process dừng giữa chừng), hồ sơ vẫn còn `frontIdUrl`/`backIdUrl`
      // để script `db:kyc:purge-approved` thử lại — không tạo orphan âm thầm.
      const assets = [submission.frontIdUrl, submission.backIdUrl]
        .filter((asset): asset is string => Boolean(asset));
      const deleted = await Promise.all(
        assets.map(async (asset) => {
          try {
            await storageService.deleteImage(asset, 'authenticated');
            return true;
          } catch (error) {
            console.error(`[kyc] Không xoá được ảnh ${asset}:`, error);
            return false;
          }
        }),
      );

      if (deleted.every(Boolean)) {
        await prisma.kycSubmission.updateMany({
          where: { id, status: 'APPROVED' },
          data: { frontIdUrl: null, backIdUrl: null },
        });
        updated = await prisma.kycSubmission.findUniqueOrThrow({ where: { id } });
      }
    }

    await auditService.record({ userId: adminId, action: `KYC_${status}`, entityType: 'KycSubmission', entityId: id });

    // Thông báo kết quả xét duyệt KYC cho người dùng
    try {
      await notificationService.notifyUsers?.(
        [submission.userId],
        {
          title: status === 'APPROVED' ? 'Hồ sơ KYC đã được phê duyệt' : 'Hồ sơ KYC đã bị từ chối',
          content: status === 'APPROVED'
            ? 'Chúc mừng! Hồ sơ xác minh danh tính của bạn đã được phê duyệt thành công.'
            : `Hồ sơ xác minh danh tính của bạn đã bị từ chối.${rejectionReason ? ` Lý do: ${rejectionReason}` : ''}`,
          type: 'KYC',
          referenceId: id,
        },
        (userId) => `kyc:${id}:${status.toLowerCase()}:${userId}`,
      );
    } catch {
      // Lỗi gửi thông báo không làm hỏng kết quả duyệt KYC đã commit
    }

    return updated;
  },

  getAuditLogs: (query: {
    search?: string;
    limit?: number;
    page?: number;
    userId?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }) => {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const page = Math.max(query.page ?? 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { fullName: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    return prisma.auditLog.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  },

  getContentFilterKeywords: () => prisma.contentFilterKeyword.findMany({ orderBy: { keyword: 'asc' } }),

  addContentFilterKeyword: async (keyword: string, adminId?: string) => {
    const normalized = keyword.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) throw new AppError('Từ khóa không được để trống', 400);
    const created = await prisma.contentFilterKeyword.upsert({
      where: { keyword: normalized },
      update: {},
      create: { keyword: normalized },
    });
    await auditService.record({
      userId: adminId,
      action: 'ADD_CONTENT_FILTER_KEYWORD',
      entityType: 'ContentFilterKeyword',
      entityId: created.id,
      metadata: { keyword: normalized },
    }).catch(() => undefined);
    return created;
  },

  removeContentFilterKeyword: async (id: string, adminId?: string) => {
    const existing = await prisma.contentFilterKeyword.findUnique({ where: { id } });
    if (!existing) throw new AppError('Không tìm thấy từ khóa', 404);
    const deleted = await prisma.contentFilterKeyword.delete({ where: { id } });
    await auditService.record({
      userId: adminId,
      action: 'REMOVE_CONTENT_FILTER_KEYWORD',
      entityType: 'ContentFilterKeyword',
      entityId: id,
    }).catch(() => undefined);
    return deleted;
  },

  getAmenities: () => prisma.amenity.findMany({ orderBy: { name: 'asc' } }),

  createAmenity: async (name: string, iconUrl?: string, adminId?: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) throw new AppError('Tên tiện ích không được để trống', 400);
    const created = await prisma.amenity.create({
      data: { name: normalizedName, iconUrl: iconUrl?.trim() || null },
    });
    await auditService.record({
      userId: adminId,
      action: 'CREATE_AMENITY',
      entityType: 'Amenity',
      entityId: created.id,
      metadata: { name: normalizedName },
    }).catch(() => undefined);
    return created;
  },

  deleteAmenity: async (id: string, adminId?: string) => {
    const amenity = await prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new AppError('Không tìm thấy tiện ích', 404);
    const deleted = await prisma.amenity.delete({ where: { id } });
    await auditService.record({
      userId: adminId,
      action: 'DELETE_AMENITY',
      entityType: 'Amenity',
      entityId: id,
    }).catch(() => undefined);
    return deleted;
  },

  // ---------------------------------------------------------------------------
  // Câu hỏi khảo sát thói quen sinh hoạt cho tính năng tìm bạn ở ghép
  // ---------------------------------------------------------------------------
  getLifestyleQuestions: () => prisma.lifestyleQuestion.findMany({
    include: {
      options: { orderBy: { scoreValue: 'asc' } },
      _count: { select: { answers: true } },
    },
    orderBy: [{ category: 'asc' }, { questionText: 'asc' }],
  }),

  createLifestyleQuestion: async (data: {
    questionText: string;
    category: string;
    weight: number;
    options: Array<{ optionText: string; scoreValue: number }>;
  }) => {
    const created = await prisma.lifestyleQuestion.create({
      data: {
        questionText: data.questionText,
        category: data.category,
        weight: data.weight,
        options: {
          create: data.options.map((option) => ({
            optionText: option.optionText,
            scoreValue: option.scoreValue,
          })),
        },
      },
    });
    return prisma.lifestyleQuestion.findUnique({
      where: { id: created.id },
      include: {
        options: { orderBy: { scoreValue: 'asc' } },
        _count: { select: { answers: true } },
      },
    });
  },

  updateLifestyleQuestion: async (id: string, data: {
    questionText?: string;
    category?: string;
    weight?: number;
    options?: Array<{ id?: string; optionText: string; scoreValue: number }>;
  }) => {
    const existing = await prisma.lifestyleQuestion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError('Không tìm thấy câu hỏi sinh hoạt', 404);

    const { options, ...questionData } = data;
    await prisma.$transaction(async (tx) => {
      await tx.lifestyleQuestion.update({ where: { id }, data: questionData });

      if (options) {
        const keptIds = options
          .map((option) => option.id)
          .filter((optionId): optionId is string => Boolean(optionId));
        await tx.lifestyleOption.deleteMany({
          where: {
            questionId: id,
            ...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
          },
        });

        for (const option of options) {
          const current = option.id
            ? await tx.lifestyleOption.findFirst({
                where: { id: option.id, questionId: id },
                select: { id: true },
              })
            : null;
          if (current) {
            await tx.lifestyleOption.update({
              where: { id: current.id },
              data: {
                optionText: option.optionText,
                scoreValue: option.scoreValue,
              },
            });
          } else {
            await tx.lifestyleOption.create({
              data: {
                questionId: id,
                optionText: option.optionText,
                scoreValue: option.scoreValue,
              },
            });
          }
        }
      }
    });

    return prisma.lifestyleQuestion.findUnique({
      where: { id },
      include: {
        options: { orderBy: { scoreValue: 'asc' } },
        _count: { select: { answers: true } },
      },
    });
  },

  deleteLifestyleQuestion: async (id: string) => {
    const existing = await prisma.lifestyleQuestion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError('Không tìm thấy câu hỏi sinh hoạt', 404);
    return prisma.lifestyleQuestion.delete({ where: { id } });
  },
};