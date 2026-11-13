import type { Prisma } from '@prisma/client';
import { notificationService } from './notification.service';

/**
 * DỌN NHU CẦU THUÊ / XEM PHÒNG KHI PHÒNG ĐÃ CÓ NGƯỜI THUÊ.
 *
 * Bất biến:
 * 1. Khoảnh khắc phòng chuyển sang `RENTED` (chủ trọ duyệt yêu cầu thuê, tạo hợp
 *    đồng, hoặc kích hoạt hợp đồng) là khoảnh khắc DUY NHẤT phải dọn nhu cầu:
 *    yêu cầu thuê còn `SUBMITTED`/`CONTRACT_READY` và lịch xem còn
 *    `PENDING`/`CONFIRMED` đều bị `CANCELLED`. Bỏ sót ⇒ tenant vẫn thấy "đang
 *    chờ" cho phòng đã thuê và chủ trọ vẫn nhận thêm lịch hẹn không thể diễn ra.
 * 2. Việc huỷ nằm TRONG cùng transaction đánh dấu phòng `RENTED`: nếu tách ra
 *    ngoài, một request đồng thời có thể chen vào giữa và tạo nhu cầu mới cho
 *    phòng vừa thuê.
 * 3. Chỉ đụng tới trạng thái còn hiệu lực. `APPROVED`/`SIGNED`/`REJECTED`/
 *    `CANCELLED` của yêu cầu thuê và lịch `COMPLETED`/`CANCELLED` là lịch sử,
 *    không phải nhu cầu đang mở ⇒ giữ nguyên.
 * 4. Lịch xem được khớp theo `roomId`, hoặc theo bài đăng của chính phòng đó
 *    (`post.roomId`) vì lịch tạo từ bài đăng vẫn có thể thiếu `roomId`.
 * 5. Thông báo gửi SAU commit, có `dedupeKey` theo từng bản ghi, và lỗi thông
 *    báo không được biến một giao dịch đã commit thành lỗi 500.
 */
const OPEN_RENTAL_REQUEST_STATUSES = ['SUBMITTED', 'CONTRACT_READY'] as const;
const OPEN_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED'] as const;

export type RoomDemandCancellation = {
  rentalRequests: { id: string; tenantId: string }[];
  appointments: { id: string; tenantId: string; appointmentTime: Date }[];
};

export const roomDemandService = {
  /**
   * Huỷ mọi yêu cầu thuê / lịch xem còn hiệu lực của một phòng vừa được thuê.
   * Phải được gọi bằng `tx` của transaction đã đánh dấu phòng `RENTED`.
   */
  cancelOpenDemand: async (
    tx: Prisma.TransactionClient,
    params: { roomId: string; excludeRentalRequestId?: string },
  ): Promise<RoomDemandCancellation> => {
    const rentalRequests = await tx.rentalRequest.findMany({
      where: {
        roomId: params.roomId,
        status: { in: [...OPEN_RENTAL_REQUEST_STATUSES] },
        ...(params.excludeRentalRequestId ? { id: { not: params.excludeRentalRequestId } } : {}),
      },
      select: { id: true, tenantId: true },
    });
    if (rentalRequests.length > 0) {
      await tx.rentalRequest.updateMany({
        where: {
          id: { in: rentalRequests.map((request) => request.id) },
          status: { in: [...OPEN_RENTAL_REQUEST_STATUSES] },
        },
        data: { status: 'CANCELLED' },
      });
    }

    const appointments = await tx.appointment.findMany({
      where: {
        status: { in: [...OPEN_APPOINTMENT_STATUSES] },
        OR: [{ roomId: params.roomId }, { post: { roomId: params.roomId } }],
      },
      select: { id: true, tenantId: true, appointmentTime: true },
    });
    if (appointments.length > 0) {
      await tx.appointment.updateMany({
        where: {
          id: { in: appointments.map((appointment) => appointment.id) },
          status: { in: [...OPEN_APPOINTMENT_STATUSES] },
        },
        data: { status: 'CANCELLED' },
      });
    }

    return { rentalRequests, appointments };
  },

  /**
   * Báo cho từng tenant bị huỷ. Gọi SAU khi transaction đã commit.
   * `roomLabel` nên là số phòng (vd `P.101`) để thông báo dễ hiểu.
   */
  notifyCancelledDemand: async (cancelled: RoomDemandCancellation, roomLabel: string) => {
    const jobs = [
      ...cancelled.rentalRequests.map((request) =>
        notificationService.createNotification(
          request.tenantId,
          'Yêu cầu thuê phòng đã bị huỷ',
          `Yêu cầu thuê phòng ${roomLabel} đã bị huỷ vì phòng đã được cho thuê.`,
          'SYSTEM',
          request.id,
          `room-rented:rental-request:${request.id}`,
        ),
      ),
      ...cancelled.appointments.map((appointment) =>
        notificationService.createNotification(
          appointment.tenantId,
          'Lịch xem phòng đã bị huỷ',
          `Lịch xem phòng ${roomLabel} lúc ${appointment.appointmentTime.toLocaleString('vi-VN')} đã bị huỷ vì phòng đã được cho thuê.`,
          'APPOINTMENT',
          appointment.id,
          `room-rented:appointment:${appointment.id}`,
        ),
      ),
    ];
    if (jobs.length === 0) return;
    await Promise.all(jobs.map((job) => job.catch(() => undefined)));
  },
};
