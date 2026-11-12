import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { KycStatus, Prisma } from '@prisma/client';
import type { StaffProfileUpsertInput } from '../validations/staffProfile.validation';
import { assertKycApproved, kycStateOf, loadKycState } from './kycGate.service';

/**
 * Hồ sơ THỢ ĐỘC LẬP (staff marketplace).
 *
 * Ranh giới bảo mật:
 * - Role được kiểm tra ở route (`authorize('STAFF')`), dựa trên row `users` mà
 *   `authenticate` đọc lại từ DB ở mỗi request — không tin client.
 * - Payload CÔNG KHAI (`publicProfileSelect`) cố tình KHÔNG chứa email, số điện
 *   thoại, `latitude`/`longitude`: người lạ không được lấy toạ độ nhà của thợ.
 *   Toạ độ chỉ dùng server-side để tính khoảng cách (Batch 2).
 * - Mọi truy vấn công khai đều lọc `role = STAFF` + `isActive = true`, nên
 *   không thể dùng endpoint này để dò User của role khác (IDOR).
 * - Thêm điều kiện KYC đã duyệt: thợ chưa xác minh CCCD không thể nhận việc
 *   (`updateAvailability`) và không xuất hiện trong danh sách công khai.
 */

const skillSelect = { select: { category: true }, orderBy: { category: 'asc' } } as const;

const publicProfileSelect = {
  id: true,
  userId: true,
  description: true,
  serviceAddress: true,
  priceMin: true,
  priceMax: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
  skills: skillSelect,
  user: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

/** Hồ sơ của CHÍNH thợ: thêm toạ độ (để sửa) nhưng vẫn không lộ gì của người khác. */
const ownProfileSelect = {
  ...publicProfileSelect,
  latitude: true,
  longitude: true,
  user: {
    select: {
      id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true, isActive: true,
      // Đọc KYC qua quan hệ sẵn có (dùng chung bảng `kyc_submissions` với chủ trọ),
      // không thêm cột `staff_profiles.kyc_status` để tránh hai nguồn sự thật.
      kycSubmission: { select: { status: true } },
    },
  },
} as const;

type OwnProfileRow = { user: { kycSubmission: { status: KycStatus } | null } };

/** Đưa `kycStatus` lên phẳng và bỏ quan hệ thô khỏi payload trả về client. */
const toOwnProfile = <T extends OwnProfileRow>(profile: T) => {
  const { kycSubmission, ...user } = profile.user;
  return { ...profile, user, kycStatus: kycStateOf(kycSubmission) };
};

/**
 * Điều kiện "thợ còn hoạt động VÀ đã được duyệt KYC" — dùng lại ở mọi truy vấn
 * đọc. Thợ chưa xác minh CCCD không thể nhận việc (xem `kycGate.service`), nên
 * cũng không xuất hiện trong danh sách cho chủ trọ: tránh việc chủ trọ liên hệ
 * một người không thể nhận công việc.
 */
const activeStaffUser: Prisma.UserWhereInput = {
  role: 'STAFF',
  isActive: true,
  kycSubmission: { is: { status: 'APPROVED' } },
};

export const staffProfileService = {
  /** Hồ sơ của chính mình; `null` = chưa hoàn thiện hồ sơ (không phải lỗi). */
  getMine: async (userId: string) => {
    const profile = await prisma.staffProfile.findUnique({ where: { userId }, select: ownProfileSelect });
    return profile ? toOwnProfile(profile) : null;
  },

  /**
   * Tạo/cập nhật hồ sơ của chính mình. Ghi hồ sơ + thay thế danh sách kỹ năng
   * trong CÙNG một transaction: không bao giờ có trạng thái "đã đổi kỹ năng
   * nhưng mô tả chưa đổi", và lỗi giữa chừng rollback cả hai.
   *
   * `skills` vắng mặt = giữ nguyên; `skills: []` = xoá hết; có mảng = thay thế.
   */
  upsertMine: async (userId: string, input: StaffProfileUpsertInput) => {
    const { skills, ...profileFields } = input;

    // Cùng một cổng KYC như `updateAvailability`: nếu không chặn ở đây, thợ có
    // thể "lách" bằng cách gửi `isAvailable: true` kèm hồ sơ và bỏ qua bước duyệt.
    if (profileFields.isAvailable === true) {
      assertKycApproved(await loadKycState(userId), 'nhận việc');
    }

    return prisma.$transaction(async (tx) => {
      const profile = await tx.staffProfile.upsert({
        where: { userId },
        create: { userId, ...profileFields },
        update: { ...profileFields },
        select: { id: true },
      });

      if (skills) {
        await tx.staffSkill.deleteMany({ where: { staffProfileId: profile.id } });
        if (skills.length > 0) {
          await tx.staffSkill.createMany({
            data: skills.map((category) => ({ staffProfileId: profile.id, category })),
          });
        }
      }

      const saved = await tx.staffProfile.findUniqueOrThrow({ where: { userId }, select: ownProfileSelect });
      return toOwnProfile(saved);
    });
  },

  /**
   * Bật/tắt trạng thái nhận việc. Yêu cầu hồ sơ đã tồn tại (fail closed).
   *
   * Bật `isAvailable = true` là cam kết "tôi có thể được giao việc" — tức là tiền
   * đề của việc thực hiện công việc — nên phải có KYC đã duyệt. Tắt thì luôn được
   * phép: thợ chưa xác minh vẫn có quyền ngừng nhận việc.
   *
   * Kiểm tra và ghi dùng CÙNG một lần đọc hồ sơ + KYC (`select` lồng nhau) nên
   * không có khe hở kiểu "kiểm tra xong mới ghi"; trạng thái KYC chỉ do admin
   * đổi qua `/admin/kyc/:id/status`, không đổi đồng thời trong request này.
   */
  updateAvailability: async (userId: string, isAvailable: boolean) => {
    const existing = await prisma.staffProfile.findUnique({
      where: { userId },
      select: { id: true, user: { select: { kycSubmission: { select: { status: true } } } } },
    });
    if (!existing) throw new AppError('Bạn chưa hoàn thiện hồ sơ thợ', 404);
    if (isAvailable) assertKycApproved(kycStateOf(existing.user?.kycSubmission), 'nhận việc');

    const updated = await prisma.staffProfile.update({
      where: { userId },
      data: { isAvailable },
      select: ownProfileSelect,
    });
    return toOwnProfile(updated);
  },

  /** Hồ sơ công khai của một thợ đang hoạt động. */
  getPublicProfile: async (staffUserId: string) => {
    const profile = await prisma.staffProfile.findFirst({
      where: { userId: staffUserId, user: activeStaffUser },
      select: publicProfileSelect,
    });
    if (!profile) throw new AppError('Không tìm thấy hồ sơ thợ', 404);
    return profile;
  },

  /**
   * Danh sách thợ cho chủ trọ khám phá: lọc theo kỹ năng + trạng thái.
   * Thứ tự xác định: sẵn sàng trước, mới cập nhật trước, rồi `id` để không bao
   * giờ phụ thuộc thứ tự ngẫu nhiên của DB. Sắp xếp theo khoảng cách được thêm
   * ở Batch 2 (khi có toạ độ bất động sản để so sánh).
   */
  browse: async (query: { category?: string; isAvailable?: boolean; search?: string; page?: number; limit?: number }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.StaffProfileWhereInput = {
      ...(typeof query.isAvailable === 'boolean' ? { isAvailable: query.isAvailable } : {}),
      ...(query.category ? { skills: { some: { category: query.category as never } } } : {}),
      user: {
        ...activeStaffUser,
        ...(query.search ? { fullName: { contains: query.search, mode: 'insensitive' } } : {}),
      },
    };

    const [total, items] = await prisma.$transaction([
      prisma.staffProfile.count({ where }),
      prisma.staffProfile.findMany({
        where,
        select: publicProfileSelect,
        orderBy: [{ isAvailable: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
};
