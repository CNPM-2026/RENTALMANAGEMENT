import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { KycStatus } from '@prisma/client';

/**
 * Cổng kiểm tra KYC dùng chung cho MỌI role cần xác minh danh tính.
 *
 * Tại sao không có bảng/status riêng cho thợ: `kyc_submissions` đã là
 * "1 hồ sơ / 1 user" (`user_id @unique`) và không có cột nào riêng của chủ trọ —
 * `id_number`, `permanent_address`, `front_id_url`, `back_id_url`, `status`,
 * `rejection_reason`, `reviewed_by_id`, `reviewed_at` đều trung tính về role.
 * Thêm `staff_kyc_status` hay `staff_id_front_url` sẽ tạo hai nguồn sự thật có
 * thể lệch nhau. Vì vậy role chỉ được đọc qua quan hệ `users.role`.
 *
 * Nguyên tắc: FAIL CLOSED. Chỉ `APPROVED` mới được coi là đã xác minh; `NONE`
 * (chưa nộp), `PENDING` (chờ duyệt) và `REJECTED` đều bị chặn.
 */

/** `NONE` = tài khoản chưa từng nộp hồ sơ KYC. */
export type KycState = KycStatus | 'NONE';

/** Mã lỗi máy đọc được để client phân biệt "thiếu KYC" với các lỗi 403 khác. */
export const STAFF_KYC_REQUIRED = 'STAFF_KYC_REQUIRED';

/** Trạng thái KYC lấy từ quan hệ đã include sẵn (không tốn thêm query). */
export const kycStateOf = (relation?: { status: KycStatus } | null): KycState =>
  relation?.status ?? 'NONE';

/** Hàm THUẦN, không chạm DB — dễ test và dùng được trong transaction. */
export const isKycApproved = (state: KycState | null | undefined): boolean =>
  state === 'APPROVED';

/**
 * Chặn thao tác khi chưa được duyệt KYC.
 * @param action cụm động từ tiếng Việt, vd. `'nhận việc'`, `'ứng tuyển công việc'`.
 */
export const assertKycApproved = (state: KycState | null | undefined, action: string): void => {
  if (isKycApproved(state)) return;
  throw new AppError(
    `Bạn cần được duyệt xác minh CCCD (KYC) trước khi ${action}.`,
    403,
    STAFF_KYC_REQUIRED,
  );
};

/**
 * Đọc trạng thái KYC từ DB. Nhận cả `prisma` và `tx` để dùng được bên trong
 * transaction (Batch 2: ứng tuyển/nhận việc phải kiểm tra trong cùng transaction
 * với thao tác ghi, tránh TOCTOU giữa lúc kiểm tra và lúc ghi).
 */
export const loadKycState = async (
  userId: string,
  client: Pick<typeof prisma, 'kycSubmission'> = prisma,
): Promise<KycState> => {
  const row = await client.kycSubmission.findUnique({
    where: { userId },
    select: { status: true },
  });
  return kycStateOf(row);
};
