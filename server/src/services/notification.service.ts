import prisma from '../config/db';
import { io } from '../socket/socket.instance';
import { NotificationType, Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';

/**
 * THÔNG BÁO (Batch 6).
 *
 * Bất biến:
 * 1. LƯU TRƯỚC, PHÁT SAU. Row trong `notifications` là nguồn sự thật; socket chỉ
 *    là kênh đẩy nhanh. Người dùng offline vẫn thấy đủ thông báo khi mở lại (kể
 *    cả sau reconnect); một sự kiện realtime bị mất không làm mất dữ liệu.
 * 2. `dedupeKey` (unique ở DB) chống trùng: handler chạy lại hoặc hai request
 *    song song cùng commit chỉ tạo đúng một thông báo. Va chạm unique được coi là
 *    "đã có" — không phải lỗi, và KHÔNG phát lại sự kiện realtime.
 * 3. Không gửi cho tài khoản đã bị khoá: `notifyUsers` lọc theo `users.is_active`
 *    trước khi ghi.
 */
export const notificationService = {
  /**
   * Ghi DB rồi phát realtime tới đúng phòng riêng `user_<id>`.
   * Trả về row đã tồn tại nếu `dedupeKey` trùng.
   */
  createNotification: async (
    userId: string,
    title: string,
    content: string,
    type: NotificationType,
    referenceId?: string,
    dedupeKey?: string,
  ) => {
    if (dedupeKey) {
      const existing = await prisma.notification.findUnique({ where: { dedupeKey } });
      if (existing) return existing;
    }

    let noti;
    try {
      noti = await prisma.notification.create({
        data: { userId, title, content, type, referenceId, dedupeKey },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && dedupeKey) {
        return await prisma.notification.findUnique({ where: { dedupeKey } });
      }
      throw error;
    }

    if (io) io.to(`user_${userId}`).emit('new_notification', noti);
    return noti;
  },

  /**
   * Gửi cùng một sự kiện cho nhiều người nhận (tự lọc trùng id), bỏ qua tài
   * khoản đã bị khoá. `dedupeKeyFor` cho phép mỗi người một khoá riêng.
   */
  notifyUsers: async (
    userIds: string[],
    payload: { title: string; content: string; type: NotificationType; referenceId?: string },
    dedupeKeyFor?: (userId: string) => string,
  ) => {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (!unique.length) return [];

    const active = await prisma.user.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    const activeIds = new Set(active.map((user) => user.id));

    const results = await Promise.all(
      unique
        .filter((id) => activeIds.has(id))
        .map((id) =>
          notificationService
            .createNotification(
              id,
              payload.title,
              payload.content,
              payload.type,
              payload.referenceId,
              dedupeKeyFor?.(id),
            )
            .catch(() => null),
        ),
    );
    return results.filter(Boolean);
  },

  getMyNotifications: async (
    userId: string,
    options: { since?: Date; unreadOnly?: boolean; limit?: number } = {},
  ) => {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    return await prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { isRead: false } : {}),
        ...(options.since ? { createdAt: { gt: options.since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  getById: async (userId: string, notificationId: string) => {
    const noti = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!noti || noti.userId !== userId) {
      throw new AppError('Không tìm thấy thông báo', 404);
    }
    return noti;
  },

  /** Số chưa đọc — dùng cho badge và để phục hồi trạng thái sau reconnect. */
  getUnreadCount: async (userId: string) => {
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    return { unreadCount: count };
  },

  markAsRead: async (userId: string, notificationId: string) => {
    const noti = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!noti || noti.userId !== userId) {
      throw new AppError('Không tìm thấy thông báo', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: noti.readAt ?? new Date() },
    });

    const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });
    if (io) io.to(`user_${userId}`).emit('notification_read', { id: notificationId, unreadCount });
    return updated;
  },

  markAllAsRead: async (userId: string) => {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    if (io) io.to(`user_${userId}`).emit('notifications_read', { unreadCount: 0 });
    return result;
  },
};
