import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { storageService } from './storage.service';
import { notificationService } from './notification.service';

export const userService = {
  updateProfile: async (userId: string, data: any, file?: Express.Multer.File) => {
    const { fullName, phone, gender, dob, bio, occupation } = data;
    const previous = file ? await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } }) : null;
    const avatarUrl = file ? await storageService.uploadImage(file, 'rental-management/avatars') : undefined;
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(fullName && { fullName }),
            ...(phone && { phone }),
            ...(avatarUrl && { avatarUrl }),
          }
        });

        await tx.userProfile.upsert({
          where: { userId },
          create: {
            userId, gender, bio, occupation,
            dob: dob ? new Date(dob) : null
          },
          update: {
            ...(gender && { gender }),
            ...(bio && { bio }),
            ...(occupation && { occupation }),
            ...(dob && { dob: new Date(dob) }),
          }
        });

        return await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true, profile: true
          }
        });
      });
      if (avatarUrl && previous?.avatarUrl && previous.avatarUrl !== avatarUrl) {
        await storageService.deleteImage(previous.avatarUrl);
      }
      return result;
    } catch (error) {
      if (avatarUrl) await storageService.deleteImage(avatarUrl);
      throw error;
    }
  },

  submitKyc: async (userId: string, data: {
    idNumber: string;
    permanentAddress: string;
    frontIdUrl: string;
    backIdUrl: string;
  }) => (async () => {
    const previous = await prisma.kycSubmission.findUnique({ where: { userId }, select: { frontIdUrl: true, backIdUrl: true } });
    const result = await prisma.kycSubmission.upsert({
      where: { userId },
      create: { userId, ...data, status: 'PENDING' },
      update: { ...data, status: 'PENDING', rejectionReason: null, reviewedById: null, reviewedAt: null },
    });
    await Promise.all([
      previous?.frontIdUrl && storageService.deleteImage(previous.frontIdUrl, 'authenticated'),
      previous?.backIdUrl && storageService.deleteImage(previous.backIdUrl, 'authenticated'),
    ]);
    // ADMIN cần thấy hồ sơ KYC mới trong trung tâm thông báo để xử lý hàng đợi.
    // Lỗi thông báo không được làm hỏng việc nộp KYC đã commit.
    const admins = await prisma.user
      .findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
      .catch(() => []);
    await notificationService
      .notifyUsers(
        admins.map((admin) => admin.id),
        {
          title: 'Hồ sơ KYC mới',
          content: 'Có hồ sơ xác minh danh tính mới đang chờ duyệt.',
          type: 'SYSTEM',
          referenceId: result.id,
        },
        (adminId) => `kyc:${result.id}:submitted:${adminId}`,
      )
      .catch(() => undefined);
    return result;
  })(),

  /**
   * Hồ sơ CÔNG KHAI của một người dùng (mọi role).
   *
   * Nguyên tắc bảo mật: chỉ trả thông tin người khác được phép thấy. KHÔNG bao
   * giờ trả `email`, `phone`, toạ độ nhà của thợ hay dữ liệu KYC thô. Phần chi
   * tiết thay đổi theo role:
   *  - STAFF: kỹ năng, mô tả kinh nghiệm, khoảng giá, số việc đã hoàn thành,
   *    điểm đánh giá tổng hợp từ review TASK;
   *  - LANDLORD: số cơ sở / phòng đang quản lý, số công việc đã hoàn thành;
   *  - TENANT: mô tả bản thân + nghề nghiệp (nếu đã khai trong hồ sơ).
   */
  getPublicProfile: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        profile: { select: { bio: true, occupation: true } },
        kycSubmission: { select: { status: true } },
        staffProfile: {
          select: {
            description: true,
            serviceAddress: true,
            priceMin: true,
            priceMax: true,
            isAvailable: true,
            skills: { select: { category: true }, orderBy: { category: 'asc' } },
          },
        },
      },
    });
    if (!user || !user.isActive) throw new AppError('Không tìm thấy người dùng', 404);

    const base = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      joinedAt: user.createdAt,
      bio: user.profile?.bio ?? null,
      occupation: user.profile?.occupation ?? null,
      kycVerified: user.kycSubmission?.status === 'APPROVED',
    };

    if (user.role === 'STAFF') {
      const [completedTasks, taskIds] = await Promise.all([
        prisma.maintenanceTask.count({ where: { assignedStaffId: user.id, status: 'COMPLETED' } }),
        prisma.maintenanceTask.findMany({
          where: { assignedStaffId: user.id, status: 'COMPLETED' },
          select: { id: true },
        }),
      ]);
      const reviews = taskIds.length
        ? await prisma.review.aggregate({
            where: { targetType: 'TASK', targetId: { in: taskIds.map((task) => task.id) } },
            _avg: { rating: true },
            _count: { _all: true },
          })
        : null;

      return {
        ...base,
        stats: {
          completedTasks,
          reviewCount: reviews?._count._all ?? 0,
          averageRating: reviews?._avg.rating ? Number(reviews._avg.rating.toFixed(1)) : 0,
        },
        staffProfile: user.staffProfile
          ? {
              ...user.staffProfile,
              priceMin: user.staffProfile.priceMin?.toString() ?? null,
              priceMax: user.staffProfile.priceMax?.toString() ?? null,
            }
          : null,
      };
    }

    if (user.role === 'LANDLORD') {
      const [properties, rooms, completedTasks] = await Promise.all([
        prisma.property.count({ where: { landlordId: user.id } }),
        prisma.room.count({ where: { property: { landlordId: user.id } } }),
        prisma.maintenanceTask.count({ where: { landlordId: user.id, status: 'COMPLETED' } }),
      ]);
      return { ...base, stats: { properties, rooms, completedTasks } };
    }

    if (user.role === 'ADMIN') {
      return { ...base, stats: {} };
    }

    // TENANT: chỉ thống kê không nhạy cảm.
    const [activeContracts, completedTasks] = await Promise.all([
      prisma.contract.count({ where: { tenantId: user.id, status: 'ACTIVE' } }),
      prisma.maintenanceTask.count({ where: { landlordId: user.id, status: 'COMPLETED' } }),
    ]);
    return { ...base, stats: { activeContracts, completedTasks } };
  },

  getMyKyc: async (userId: string) => {
    const result = await prisma.kycSubmission.findUnique({ where: { userId } });
    return result && {
      ...result,
      frontIdUrl: storageService.getPrivateImageUrl(result.frontIdUrl),
      backIdUrl: storageService.getPrivateImageUrl(result.backIdUrl),
    };
  },
};