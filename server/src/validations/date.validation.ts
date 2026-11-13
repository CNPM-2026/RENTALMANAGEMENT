import { z } from 'zod';

/**
 * Kiểm tra ngày/giờ dùng chung cho toàn bộ API.
 *
 * Mục tiêu:
 *  - Không chấp nhận chuỗi ngày không tồn tại (vd. 2026-02-30) hoặc `Invalid Date`.
 *  - So sánh theo ĐẦU NGÀY giờ máy chủ để một ngày được chọn hôm nay không bị coi
 *    là quá khứ chỉ vì input `type="date"` được gửi lên dưới dạng UTC.
 *  - Có trần thời gian hợp lý, tránh dữ liệu rác như hẹn xem phòng năm 2200.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfToday = (now = new Date()): Date =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const endOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

/** `z.coerce.date()` với thông báo tiếng Việt thống nhất. */
export const dateInput = (message = 'Ngày không hợp lệ') => z.coerce.date({ message });

/**
 * Ngày (không kèm giờ) không được trước hôm nay.
 * Dùng cho ngày dọn vào, hạn đăng tin.
 */
export const dateNotInPast = (message = 'Ngày không được ở quá khứ') =>
  dateInput().refine((value) => value.getTime() >= startOfToday().getTime(), message);

/** Ngày phải sau hôm nay (dùng cho ngày dọn vào dự kiến). */
export const dateAfterToday = (message = 'Ngày phải sau ngày hiện tại') =>
  dateInput().refine((value) => value.getTime() > startOfToday().getTime(), message);

/** Giới hạn ngày trong tương lai để tránh dữ liệu nhập sai. */
export const dateWithinFutureDays = (
  days: number,
  message = `Ngày không được vượt quá ${days} ngày kể từ hôm nay`,
) =>
  dateInput().refine(
    (value) => value.getTime() <= endOfDay(addDays(new Date(), days)).getTime(),
    message,
  );
