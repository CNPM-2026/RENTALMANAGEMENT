import { z } from 'zod';
import { addDays, dateInput } from './date.validation';

const MIN_ADVANCE_MS = 60 * 60 * 1000;
const MAX_ADVANCE_DAYS = 365;

export const createAppointmentSchema = z.object({
  roomId: z.string().uuid('ID phòng không hợp lệ').optional(),
  postId: z.string().uuid('ID bài đăng không hợp lệ').optional(),
  // Bắt buộc phải có 1 trong 2 cái trên
  appointmentTime: dateInput('Thời gian hẹn không hợp lệ')
    .refine(
      (value) => value.getTime() >= Date.now() + MIN_ADVANCE_MS,
      'Thời gian hẹn phải cách thời điểm hiện tại ít nhất 1 tiếng',
    )
    .refine(
      (value) => value.getTime() <= addDays(new Date(), MAX_ADVANCE_DAYS).getTime(),
      `Chỉ được đặt lịch trong vòng ${MAX_ADVANCE_DAYS} ngày tới`,
    ),
  note: z.string().trim().max(2000, 'Ghi chú tối đa 2000 ký tự').optional(),
}).refine(data => data.roomId || data.postId, {
  message: 'Vui lòng truyền roomId hoặc postId để đặt lịch',
  path: ['roomId'], // Báo lỗi ở field roomId
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    message: 'Trạng thái không hợp lệ'
  })
});