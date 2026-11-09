import { z } from 'zod';

export const createAppointmentSchema = z.object({
  roomId: z.string().uuid('ID phòng không hợp lệ').optional(),
  postId: z.string().uuid('ID bài đăng không hợp lệ').optional(),
  // Bắt buộc phải có 1 trong 2 cái trên
  appointmentTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Thời gian hẹn không hợp lệ (Vui lòng dùng định dạng ISO 8601, ví dụ: 2026-10-28T09:00:00.000Z)',
  }).refine((val) => new Date(val).getTime() >= Date.now() + 60 * 60 * 1000, {
    message: 'Thời gian hẹn phải cách thời điểm hiện tại ít nhất 1 tiếng',
  }),
  note: z.string().optional(),
}).refine(data => data.roomId || data.postId, {
  message: 'Vui lòng truyền roomId hoặc postId để đặt lịch',
  path: ['roomId'], // Báo lỗi ở field roomId
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    message: 'Trạng thái không hợp lệ'
  })
});